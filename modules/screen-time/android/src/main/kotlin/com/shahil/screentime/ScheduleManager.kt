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
                
                // Check all 7 days to find the absolute next event
                for (dayOffset in 0..7) {
                    val checkDate = (now.clone() as Calendar).apply { add(Calendar.DAY_OF_YEAR, dayOffset) }
                    val dayName = getDayName(checkDate.get(Calendar.DAY_OF_WEEK))
                    
                    if (!daysSet.contains(dayName)) continue
                    
                    // Possible events: Start of block and End of block
                    val possibleEvents = mutableListOf<Int>()
                    possibleEvents.add(startMins)
                    possibleEvents.add(endMins)
                    
                    for (eventMins in possibleEvents) {
                        val eventTime = (checkDate.clone() as Calendar).apply {
                            set(Calendar.HOUR_OF_DAY, eventMins / 60)
                            set(Calendar.MINUTE, eventMins % 60)
                            set(Calendar.SECOND, 0)
                            set(Calendar.MILLISECOND, 0)
                        }
                        
                        if (eventTime.after(now)) {
                            if (nextTriggerTime == null || eventTime.before(nextTriggerTime)) {
                                nextTriggerTime = eventTime
                            }
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

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, time.timeInMillis, pendingIntent)
        } else {
            alarmManager.setExact(AlarmManager.RTC_WAKEUP, time.timeInMillis, pendingIntent)
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
