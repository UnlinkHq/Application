package com.shahil.screentime

import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import androidx.work.ListenableWorker

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
        val isScheduleActive = ScheduleEvaluator.isAnyActiveNow(prefs)
        
        if (isManualActive || isScheduleActive) {
            Log.d("UnlinkGuardian", "Focus session should be active. Ensuring service health.")
            ensureServiceRunning()
        }
        
        return ListenableWorker.Result.success()
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
