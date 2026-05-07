package com.shahil.screentime

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
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
            val now = System.currentTimeMillis()

            if (expiryTime > now) {
                Log.d("UnlinkBoot", "Active Session Found. Re-triggering refresh pulse.")

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
                Log.d("UnlinkBoot", "No active session on boot.")
            }

            // Hard reboot watchdog: detect if session should have expired during the downtime
            val lastShutdown = prefs.getLong("last_shutdown_watchdog", 0L)
            val shutdownGraceMs = 10_000L
            if (startTime > 0 && durationMins > 0 && lastShutdown > 0) {
                val expectedExpiry = startTime + (durationMins * 60 * 1000L)
                val bootTime = System.currentTimeMillis()
                if (bootTime > expectedExpiry + shutdownGraceMs) {
                    val suspiciousCount = prefs.getInt("suspicious_reboot_count", 0) + 1
                    prefs.edit().putInt("suspicious_reboot_count", suspiciousCount)
                        .putLong("last_suspicious_reboot_time", bootTime).apply()
                    Log.d("UnlinkBoot", "SUSPICIOUS_REBOOT: Session should have expired. Count=$suspiciousCount")
                }
            }
        }

        // Store shutdown marker for watchdog on next boot
        if (action != Intent.ACTION_BOOT_COMPLETED && action != "android.intent.action.QUICKBOOT_POWERON"
            && action != Intent.ACTION_MY_PACKAGE_REPLACED && action != "com.shahil.ACTION_REFRESH_BLOCKS") {
            // This is not tracked through a separate shutdown receiver, but saved via the service's lifecycle
        }
    }
}