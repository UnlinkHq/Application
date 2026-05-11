package com.shahil.screentime

import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import androidx.work.ListenableWorker
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

class UnlinkGuardianWorker(context: Context, workerParams: WorkerParameters) :
    CoroutineWorker(context, workerParams) {

    override suspend fun doWork(): ListenableWorker.Result {
        Log.d("UnlinkGuardian", "Guardian Heartbeat Triggered")
        
        val prefs = applicationContext.getSharedPreferences("UnlinkBlockingPrefs", Context.MODE_PRIVATE)
        val now = System.currentTimeMillis()
        
        // 1. Check if a Manual Session is active
        val blockExpiryTime = prefs.getLong("block_expiry_time", 0L)
        val isManualActive = blockExpiryTime > now && !prefs.getBoolean("is_blocking_suspended", false)
        
        // 2. Check if a Schedule is active
        val isScheduleActive = checkSchedules(prefs)
        
        if (isManualActive || isScheduleActive) {
            Log.d("UnlinkGuardian", "Focus session should be active. Ensuring service health.")
            ensureServiceRunning()
        }
        
        return ListenableWorker.Result.success()
    }

    private fun checkSchedules(prefs: android.content.SharedPreferences): Boolean {
        try {
            val schedulesJson = prefs.getString("native_schedules", null) ?: return false
            val schedulesArray = JSONArray(schedulesJson)
            
            val calendar = Calendar.getInstance()
            val dayNames = arrayOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat")
            val currentDayName = dayNames[calendar.get(Calendar.DAY_OF_WEEK) - 1]
            val currentDateStr = String.format(java.util.Locale.US, "%04d-%02d-%02d", calendar.get(Calendar.YEAR), calendar.get(Calendar.MONTH) + 1, calendar.get(Calendar.DAY_OF_MONTH))
            val yesterdayDayName = dayNames[(calendar.get(Calendar.DAY_OF_WEEK) - 2 + 7) % 7]
            val yesterdayCal = calendar.clone() as Calendar
            yesterdayCal.add(Calendar.DAY_OF_YEAR, -1)
            val yesterdayDateStr = String.format(java.util.Locale.US, "%04d-%02d-%02d", yesterdayCal.get(Calendar.YEAR), yesterdayCal.get(Calendar.MONTH) + 1, yesterdayCal.get(Calendar.DAY_OF_MONTH))
            val currentMinutes = calendar.get(Calendar.HOUR_OF_DAY) * 60 + calendar.get(Calendar.MINUTE)

            val stopRecordsStr = prefs.getString("native_stop_records", "{}") ?: "{}"
            val stopRecordsJson = JSONObject(stopRecordsStr)

            for (i in 0 until schedulesArray.length()) {
                val block = schedulesArray.getJSONObject(i)
                val id = block.optString("id")

                if (block.optString("type") != "schedule") continue
                if (block.optBoolean("enabled", true) == false) continue

                val schedule = block.optJSONObject("schedule") ?: continue
                val daysArray = schedule.optJSONArray("days") ?: continue

                val startMins = parseTimeToMinutes(schedule.optString("startTime", ""))
                val endMins = parseTimeToMinutes(schedule.optString("endTime", ""))
                val isMidnightCrossing = endMins <= startMins
                val isPostMidnight = isMidnightCrossing && currentMinutes < endMins
                val effectiveDayName = if (isPostMidnight) yesterdayDayName else currentDayName
                val effectiveDateStr = if (isPostMidnight) yesterdayDateStr else currentDateStr

                if (stopRecordsJson.optString(id) == effectiveDateStr) continue

                var dayMatch = false
                for (j in 0 until daysArray.length()) {
                    if (daysArray.getString(j) == effectiveDayName) {
                        dayMatch = true
                        break
                    }
                }
                if (!dayMatch) continue

                if (isMidnightCrossing) {
                    if (currentMinutes >= startMins || currentMinutes < endMins) {
                        return true
                    }
                } else {
                    if (currentMinutes in startMins until endMins) {
                        return true
                    }
                }
            }
        } catch (e: Exception) {
            Log.e("UnlinkGuardian", "Schedule check failed: ${e.message}")
        }
        return false
    }

    private fun parseTimeToMinutes(timeStr: String): Int {
        val parts = timeStr.split(":")
        if (parts.size < 2) return 0
        return (parts[0].toIntOrNull() ?: 0) * 60 + (parts[1].toIntOrNull() ?: 0)
    }

    private fun ensureServiceRunning() {
        // We ensure the FallbackBlockingService is running as a backup
        // AccessibilityService is harder to "force-start" but Android usually handles it if enabled.
        val context = applicationContext
        val intent = Intent(context, FallbackBlockingService::class.java)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
            Log.d("UnlinkGuardian", "Guardian successfully verified service state.")
        } catch (e: Exception) {
            Log.e("UnlinkGuardian", "Guardian failed to ping service: ${e.message}")
        }
    }
}
