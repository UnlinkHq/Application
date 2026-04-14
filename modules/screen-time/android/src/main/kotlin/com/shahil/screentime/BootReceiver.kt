package com.shahil.screentime

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        if (action == Intent.ACTION_BOOT_COMPLETED || 
            action == "android.intent.action.QUICKBOOT_POWERON") {
            
            Log.d("UnlinkBoot", "System Reboot Detected. Resuming Focus Engine...")
            
            val prefs = context.getSharedPreferences("UnlinkBlockingPrefs", Context.MODE_PRIVATE)
            val startTime = prefs.getLong("session_start_time", 0)
            val durationMins = prefs.getLong("session_duration_mins", 0)
            
            if (startTime > 0 && durationMins > 0) {
                val elapsedTimeMs = System.currentTimeMillis() - startTime
                val durationMs = durationMins * 60 * 1000
                
                if (elapsedTimeMs < durationMs) {
                    Log.d("UnlinkBoot", "Active Session Found. Re-triggering refresh pulse.")
                    // Trigger the refresh pulse to wake up the service
                    val refreshIntent = Intent("com.shahil.ACTION_REFRESH_BLOCKS")
                    refreshIntent.setPackage(context.packageName)
                    context.sendBroadcast(refreshIntent)
                } else {
                    Log.d("UnlinkBoot", "Session has naturally expired.")
                }
            }
        }
    }
}
