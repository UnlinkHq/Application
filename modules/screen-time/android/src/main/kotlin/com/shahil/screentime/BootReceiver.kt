package com.shahil.screentime

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        if (action == Intent.ACTION_BOOT_COMPLETED || 
            action == "android.intent.action.QUICKBOOT_POWERON" ||
            action == Intent.ACTION_MY_PACKAGE_REPLACED) {
            
            Log.d("UnlinkBoot", "Survival Event Detected: $action. Resuming Focus Engine...")
            
            val prefs = context.getSharedPreferences("UnlinkBlockingPrefs", Context.MODE_PRIVATE)
            val expiryTime = prefs.getLong("block_expiry_time", 0L)
            
            if (expiryTime > System.currentTimeMillis()) {
                Log.d("UnlinkBoot", "Active Session Found. Igniting Watchdog Foreground Service.")
                val serviceIntent = Intent(context, FallbackBlockingService::class.java)
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent)
                } else {
                    context.startService(serviceIntent)
                }
            } else {
                Log.d("UnlinkBoot", "No active session on boot.")
            }
        }
    }
}
