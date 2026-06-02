package com.shahil.screentime

import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar
import java.util.Locale

/**
 * SINGLE SOURCE OF TRUTH for "is a schedule block currently active?".
 *
 * This logic (day matching, midnight-crossing windows, per-day stop records) used to be
 * copy-pasted into UnlinkAccessibilityService, FallbackBlockingService, BootReceiver,
 * UnlinkGuardianWorker and ScreenTimeModule. A fix in one place silently left the other
 * four wrong (see the "midnight-crossing schedule logic" bug). Everything now routes here.
 *
 * Hot path (accessibility events) should call [parse]/[parseStops] once, cache the result,
 * and pass the cached lists into [isAnyActive] / [matchesPackage] so we don't re-read prefs
 * or re-parse JSON on every event. Cold callers can use [isAnyActiveNow] / [matchesPackageNow].
 */
object ScheduleEvaluator {

    private val DAY_NAMES = arrayOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat")

    data class Schedule(
        val id: String,
        val enabled: Boolean,
        val startMins: Int,
        val endMins: Int,
        val days: Set<String>,
        val appPackages: List<String>
    )

    /** Computes the day/time context once so a batch check doesn't allocate per-schedule. */
    private class NowContext(now: Long) {
        val nowMins: Int
        val todayName: String
        val todayDate: String
        val yesterdayName: String
        val yesterdayDate: String

        init {
            val cal = Calendar.getInstance().apply { timeInMillis = now }
            nowMins = cal.get(Calendar.HOUR_OF_DAY) * 60 + cal.get(Calendar.MINUTE)
            todayName = DAY_NAMES[cal.get(Calendar.DAY_OF_WEEK) - 1]
            todayDate = fmtDate(cal)
            yesterdayName = DAY_NAMES[(cal.get(Calendar.DAY_OF_WEEK) - 2 + 7) % 7]
            val yCal = (cal.clone() as Calendar).apply { add(Calendar.DAY_OF_YEAR, -1) }
            yesterdayDate = fmtDate(yCal)
        }
    }

    fun parse(prefs: SharedPreferences): List<Schedule> {
        val json = prefs.getString("native_schedules", null) ?: return emptyList()
        return try {
            val array = JSONArray(json)
            (0 until array.length()).mapNotNull { i ->
                val block = array.getJSONObject(i)
                if (block.optString("type") != "schedule") return@mapNotNull null
                val sched = block.optJSONObject("schedule") ?: return@mapNotNull null
                val daysArr = sched.optJSONArray("days") ?: return@mapNotNull null
                val days = (0 until daysArr.length()).mapTo(mutableSetOf()) { daysArr.getString(it) }
                val appsArr = block.optJSONArray("apps") ?: return@mapNotNull null
                val apps = (0 until appsArr.length()).map { appsArr.getString(it) }
                Schedule(
                    id = block.optString("id"),
                    enabled = block.optBoolean("enabled", true),
                    startMins = parseTimeToMinutes(sched.optString("startTime", "")),
                    endMins = parseTimeToMinutes(sched.optString("endTime", "")),
                    days = days,
                    appPackages = apps
                )
            }
        } catch (e: Exception) {
            emptyList()
        }
    }

    fun parseStops(prefs: SharedPreferences): Map<String, String> {
        val json = prefs.getString("native_stop_records", "{}") ?: "{}"
        return try {
            val obj = JSONObject(json)
            buildMap { obj.keys().forEach { put(it, obj.getString(it)) } }
        } catch (e: Exception) {
            emptyMap()
        }
    }

    fun parseTimeToMinutes(t: String): Int {
        val p = t.split(":")
        return if (p.size >= 2) (p[0].toIntOrNull() ?: 0) * 60 + (p[1].toIntOrNull() ?: 0) else 0
    }

    /** True if ANY enabled schedule is currently inside its active window. */
    fun isAnyActive(
        schedules: List<Schedule>,
        stops: Map<String, String>,
        now: Long = System.currentTimeMillis()
    ): Boolean {
        if (schedules.isEmpty()) return false
        val ctx = NowContext(now)
        return schedules.any { isWindowActive(it, stops, ctx) }
    }

    /** True if an active schedule window currently targets [pkg]. */
    fun matchesPackage(
        schedules: List<Schedule>,
        stops: Map<String, String>,
        pkg: String,
        now: Long = System.currentTimeMillis()
    ): Boolean {
        if (schedules.isEmpty()) return false
        val ctx = NowContext(now)
        return schedules.any { s ->
            isWindowActive(s, stops, ctx) && s.appPackages.any { pkg.contains(it, ignoreCase = true) }
        }
    }

    /** Convenience for cold callers (boot, worker, JS bridge) — parses prefs then evaluates. */
    fun isAnyActiveNow(prefs: SharedPreferences): Boolean =
        isAnyActive(parse(prefs), parseStops(prefs))

    fun matchesPackageNow(prefs: SharedPreferences, pkg: String): Boolean =
        matchesPackage(parse(prefs), parseStops(prefs), pkg)

    private fun isWindowActive(s: Schedule, stops: Map<String, String>, ctx: NowContext): Boolean {
        if (!s.enabled) return false
        val midnightCrossing = s.endMins <= s.startMins
        val postMidnight = midnightCrossing && ctx.nowMins < s.endMins
        val effectiveDay = if (postMidnight) ctx.yesterdayName else ctx.todayName
        val effectiveDate = if (postMidnight) ctx.yesterdayDate else ctx.todayDate
        if (stops[s.id] == effectiveDate) return false
        if (!s.days.contains(effectiveDay)) return false
        return if (midnightCrossing) {
            ctx.nowMins >= s.startMins || ctx.nowMins < s.endMins
        } else {
            ctx.nowMins >= s.startMins && ctx.nowMins < s.endMins
        }
    }

    private fun fmtDate(cal: Calendar): String =
        String.format(
            Locale.US, "%04d-%02d-%02d",
            cal.get(Calendar.YEAR), cal.get(Calendar.MONTH) + 1, cal.get(Calendar.DAY_OF_MONTH)
        )
}
