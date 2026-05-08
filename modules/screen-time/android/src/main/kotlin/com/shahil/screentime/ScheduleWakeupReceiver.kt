package com.shahil.screentime

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

/**
 * Receiver triggered by AlarmManager to wake up the focus engine
 * at the exact start or end of a scheduled block.
 */
class ScheduleWakeupReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        Log.d("UnlinkWakeup", "Alarm triggered — Re-evaluating focus engine state...")
        
        val prefs = context.getSharedPreferences("UnlinkBlockingPrefs", Context.MODE_PRIVATE)
        
        // 1. Sync the state
        val syncIntent = Intent(context, FallbackBlockingService::class.java)
        try {
            // Re-evaluating blocking state happens inside the services on start/refresh
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(syncIntent)
            } else {
                context.startService(syncIntent)
            }
        } catch (e: Exception) {
            Log.e("UnlinkWakeup", "Failed to start service from alarm: ${e.message}")
        }
        
        // 2. Refresh Accessibility Service if running
        UnlinkAccessibilityService.instance?.refreshServiceConfig()
        
        // 3. Schedule the NEXT wakeup alarm to keep the chain going
        ScheduleManager.scheduleNextAlarm(context)
    }
}
