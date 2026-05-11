package com.shahil.screentime

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        if (action == Intent.ACTION_BOOT_COMPLETED ||
            action == "android.intent.action.QUICKBOOT_POWERON" ||
            action == Intent.ACTION_MY_PACKAGE_REPLACED ||
            action == "android.intent.action.LOCKED_BOOT_COMPLETED") {

            Log.d("UnlinkBoot", "Survival Event Detected: $action. Resuming Focus Engine...")

            val prefs = context.getSharedPreferences("UnlinkBlockingPrefs", Context.MODE_PRIVATE)
            val expiryTime = prefs.getLong("block_expiry_time", 0L)
            val now = System.currentTimeMillis()

            val isManualSessionActive = expiryTime > now
            val isScheduleActive = isAnyScheduleActiveNow(prefs)

            if (isManualSessionActive || isScheduleActive) {
                val reason = if (isManualSessionActive) "Active Manual Session" else "Active Schedule"
                Log.d("UnlinkBoot", "$reason Found. Starting FallbackBlockingService and broadcasting refresh.")

                // Start FallbackBlockingService immediately to close the boot gap
                val svcIntent = Intent(context, FallbackBlockingService::class.java)
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        context.startForegroundService(svcIntent)
                    } else {
                        context.startService(svcIntent)
                    }
                    Log.d("UnlinkBoot", "FallbackBlockingService started for immediate boot protection.")
                } catch (e: Exception) {
                    Log.e("UnlinkBoot", "Failed to start FallbackBlockingService: ${e.message}")
                }

                // Broadcast for accessibility service (will pick up once Android restarts it)
                val refreshIntent = Intent("com.shahil.ACTION_REFRESH_BLOCKS")
                refreshIntent.setPackage(context.packageName)
                context.sendBroadcast(refreshIntent)
            } else {
                Log.d("UnlinkBoot", "No active session or schedule on boot.")
            }

            // Hard reboot watchdog: detect if session should have expired during the downtime
            val lastShutdown = prefs.getLong("last_shutdown_watchdog", 0L)
            val shutdownGraceMs = 10_000L
            if (expiryTime > 0 && lastShutdown > 0) {
                val bootTime = System.currentTimeMillis()
                if (bootTime > expiryTime + shutdownGraceMs) {
                    val suspiciousCount = prefs.getInt("suspicious_reboot_count", 0) + 1
                    prefs.edit().putInt("suspicious_reboot_count", suspiciousCount)
                        .putLong("last_suspicious_reboot_time", bootTime).apply()
                    Log.d("UnlinkBoot", "SUSPICIOUS_REBOOT: Session should have expired. Count=$suspiciousCount")
                }
            }

            // Always reschedule alarms on boot
            ScheduleManager.scheduleNextAlarm(context)
        }
    }

    /**
     * Checks if any schedule block window is currently active.
     * Mirrors the same logic in FallbackBlockingService / ScreenTimeModule.
     */
    private fun isAnyScheduleActiveNow(prefs: android.content.SharedPreferences): Boolean {
        val schedulesJson = prefs.getString("native_schedules", null) ?: return false
        return try {
            val array = JSONArray(schedulesJson)
            val cal = Calendar.getInstance()
            val dayNames = arrayOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat")
            val todayDayName = dayNames[cal.get(Calendar.DAY_OF_WEEK) - 1]
            val todayDateStr = String.format(java.util.Locale.US, "%04d-%02d-%02d", cal.get(Calendar.YEAR), cal.get(Calendar.MONTH) + 1, cal.get(Calendar.DAY_OF_MONTH))
            val yesterdayDayName = dayNames[(cal.get(Calendar.DAY_OF_WEEK) - 2 + 7) % 7]
            val yesterdayCal = cal.clone() as Calendar
            yesterdayCal.add(Calendar.DAY_OF_YEAR, -1)
            val yesterdayDateStr = String.format(java.util.Locale.US, "%04d-%02d-%02d", yesterdayCal.get(Calendar.YEAR), yesterdayCal.get(Calendar.MONTH) + 1, yesterdayCal.get(Calendar.DAY_OF_MONTH))
            val nowMins = cal.get(Calendar.HOUR_OF_DAY) * 60 + cal.get(Calendar.MINUTE)
            val stopsJson = JSONObject(prefs.getString("native_stop_records", "{}") ?: "{}")

            for (i in 0 until array.length()) {
                val block = array.getJSONObject(i)
                if (block.optString("type") != "schedule") continue
                if (!block.optBoolean("enabled", true)) continue
                val id = block.optString("id")
                val sched = block.optJSONObject("schedule") ?: continue
                val daysArr = sched.optJSONArray("days") ?: continue
                fun parseMins(t: String): Int {
                    val p = t.split(":"); return if (p.size >= 2) (p[0].toIntOrNull() ?: 0) * 60 + (p[1].toIntOrNull() ?: 0) else 0
                }
                val startMins = parseMins(sched.optString("startTime", ""))
                val endMins   = parseMins(sched.optString("endTime", ""))
                val isMidnightCrossing = endMins <= startMins
                val isPostMidnight = isMidnightCrossing && nowMins < endMins
                val effectiveDayName = if (isPostMidnight) yesterdayDayName else todayDayName
                val effectiveDateStr = if (isPostMidnight) yesterdayDateStr else todayDateStr
                if (stopsJson.optString(id) == effectiveDateStr) continue
                var dayMatch = false
                for (j in 0 until daysArr.length()) {
                    if (daysArr.getString(j) == effectiveDayName) { dayMatch = true; break }
                }
                if (!dayMatch) continue
                val inWindow = if (isMidnightCrossing) nowMins >= startMins || nowMins < endMins
                               else nowMins >= startMins && nowMins < endMins
                if (inWindow) return true
            }
            false
        } catch (e: Exception) {
            Log.e("UnlinkBoot", "Schedule check error: ${e.message}")
            false
        }
    }
}