package com.shahil.screentime

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import org.json.JSONArray
import java.util.*

object ScheduleManager {
    private const val TAG = "UnlinkScheduleManager"
    private const val REQUEST_CODE = 100

    fun scheduleNextAlarm(context: Context) {
        val prefs = context.getSharedPreferences("UnlinkBlockingPrefs", Context.MODE_PRIVATE)
        val schedulesJson = prefs.getString("native_schedules", null) ?: return
        
        try {
            val array = JSONArray(schedulesJson)
            val now = Calendar.getInstance()
            val nowMins = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE)
            val todayDay = now.get(Calendar.DAY_OF_WEEK)
            
            var nextTriggerTime: Calendar? = null

            for (i in 0 until array.length()) {
                val block = array.getJSONObject(i)
                if (block.optString("type") != "schedule") continue
                if (!block.optBoolean("enabled", true)) continue
                
                val sched = block.optJSONObject("schedule") ?: continue
                val daysArr = sched.optJSONArray("days") ?: continue
                val daysSet = mutableSetOf<String>()
                for (j in 0 until daysArr.length()) daysSet.add(daysArr.getString(j))
                
                val startMins = parseMins(sched.optString("startTime", ""))
                val endMins = parseMins(sched.optString("endTime", ""))
                val isMidnightCrossing = endMins <= startMins

                // Scan enough days to cover a full week plus the midnight-crossing overshoot
                for (dayOffset in 0..8) {
                    val checkDate = (now.clone() as Calendar).apply { add(Calendar.DAY_OF_YEAR, dayOffset) }
                    val dayName = getDayName(checkDate.get(Calendar.DAY_OF_WEEK))

                    if (!daysSet.contains(dayName)) continue

                    // Start event: always on the schedule day itself
                    val startEvent = (checkDate.clone() as Calendar).apply {
                        set(Calendar.HOUR_OF_DAY, startMins / 60)
                        set(Calendar.MINUTE, startMins % 60)
                        set(Calendar.SECOND, 0)
                        set(Calendar.MILLISECOND, 0)
                    }
                    if (startEvent.after(now)) {
                        if (nextTriggerTime == null || startEvent.before(nextTriggerTime)) {
                            nextTriggerTime = startEvent
                        }
                    }

                    // End event: NEXT day for midnight-crossing schedules, same day otherwise.
                    // This ensures the 8am end alarm is placed on Monday when the schedule
                    // day is Sunday (e.g. a 7pm–8am window).
                    val endEventBase: Calendar = if (isMidnightCrossing) {
                        (checkDate.clone() as Calendar).apply { add(Calendar.DAY_OF_YEAR, 1) }
                    } else {
                        checkDate.clone() as Calendar
                    }
                    endEventBase.set(Calendar.HOUR_OF_DAY, endMins / 60)
                    endEventBase.set(Calendar.MINUTE, endMins % 60)
                    endEventBase.set(Calendar.SECOND, 0)
                    endEventBase.set(Calendar.MILLISECOND, 0)
                    if (endEventBase.after(now)) {
                        if (nextTriggerTime == null || endEventBase.before(nextTriggerTime)) {
                            nextTriggerTime = endEventBase
                        }
                    }
                }
            }

            if (nextTriggerTime != null) {
                setAlarm(context, nextTriggerTime)
            } else {
                Log.d(TAG, "No future schedule events found to set alarm.")
            }

        } catch (e: Exception) {
            Log.e(TAG, "Failed to schedule next alarm: ${e.message}")
        }
    }

    private fun setAlarm(context: Context, time: Calendar) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, ScheduleWakeupReceiver::class.java)
        val pendingIntent = PendingIntent.getBroadcast(
            context, REQUEST_CODE, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        Log.d(TAG, "Setting next wakeup alarm for: ${time.time}")

        try {
            when {
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
                    // Android 12+: must check SCHEDULE_EXACT_ALARM permission at runtime
                    if (alarmManager.canScheduleExactAlarms()) {
                        alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, time.timeInMillis, pendingIntent)
                    } else {
                        // Graceful fallback — inexact but still doze-exempt
                        alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, time.timeInMillis, pendingIntent)
                        Log.w(TAG, "SCHEDULE_EXACT_ALARM not granted — using inexact alarm")
                    }
                }
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ->
                    alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, time.timeInMillis, pendingIntent)
                else ->
                    alarmManager.setExact(AlarmManager.RTC_WAKEUP, time.timeInMillis, pendingIntent)
            }
        } catch (e: SecurityException) {
            Log.w(TAG, "Exact alarm denied — falling back to inexact: ${e.message}")
            alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, time.timeInMillis, pendingIntent)
        }
    }

    private fun parseMins(t: String): Int {
        val p = t.split(":")
        return if (p.size >= 2) (p[0].toIntOrNull() ?: 0) * 60 + (p[1].toIntOrNull() ?: 0) else 0
    }

    private fun getDayName(dayOfWeek: Int): String {
        return arrayOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat")[dayOfWeek - 1]
    }
}
