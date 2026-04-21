package com.shahil.screentime

import android.app.*
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.WindowManager
import android.widget.TextView
import androidx.core.app.NotificationCompat
import java.util.Timer
import java.util.TimerTask

/**
 * FALLBACK_BLOCKING_ENGINE: 
 * This service runs when Accessibility is NOT granted.
 * It uses UsageStats polling to detect blocked apps and shows the overlay.
 */
class FallbackBlockingService : Service() {

    private var windowManager: WindowManager? = null
    private var overlayView: View? = null
    private val handler = Handler(Looper.getMainLooper())
    private var pollingTimer: Timer? = null

    private var currentBlockedApps: Set<String> = emptySet()
    private var blockExpiryTime: Long = 0L
    private var isBlockingSuspended: Boolean = false

    companion object {
        private const val NOTIFICATION_ID = 1002
        private const val CHANNEL_ID = "unlink_fallback_channel"
    }

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, createNotification())
        startPolling()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        refreshConfig()
        return START_STICKY
    }

    private fun refreshConfig() {
        val prefs = getSharedPreferences("UnlinkBlockingPrefs", Context.MODE_PRIVATE)
        currentBlockedApps = prefs.getStringSet("blocked_apps", emptySet()) ?: emptySet()
        blockExpiryTime = prefs.getLong("block_expiry_time", 0L)
        isBlockingSuspended = prefs.getBoolean("is_blocking_suspended", false)
    }

    private fun startPolling() {
        pollingTimer?.cancel()
        pollingTimer = Timer()
        pollingTimer?.scheduleAtFixedRate(object : TimerTask() {
            override fun run() {
                checkForegroundApp()
            }
        }, 0, 1000) // Poll every 1 second
    }

    private fun checkForegroundApp() {
        if (isBlockingSuspended || System.currentTimeMillis() >= blockExpiryTime) {
            handler.post { setWallVisibility(false) }
            return
        }

        val usageStatsManager = getSystemService(Context.USAGE_STATS_SERVICE) as android.app.usage.UsageStatsManager
        val time = System.currentTimeMillis()
        val stats = usageStatsManager.queryUsageStats(android.app.usage.UsageStatsManager.INTERVAL_DAILY, time - 1000 * 10, time)
        
        if (stats != null) {
            val sortedStats = stats.sortedByDescending { it.lastTimeUsed }
            if (sortedStats.isNotEmpty()) {
                val topPackage = sortedStats[0].packageName
                
                // Don't block our own app or the launcher
                if (topPackage == packageName) {
                    handler.post { setWallVisibility(false) }
                    return
                }

                val isBlocked = currentBlockedApps.any { blocked -> topPackage.contains(blocked, ignoreCase = true) }
                handler.post { setWallVisibility(isBlocked) }
            }
        }
    }

    private fun setWallVisibility(visible: Boolean) {
        if (visible) {
            if (overlayView == null) {
                createOverlay()
            }
            if (overlayView?.parent == null) {
                try {
                    val params = overlayView?.layoutParams as WindowManager.LayoutParams
                    windowManager?.addView(overlayView, params)
                } catch (e: Exception) {
                    Log.e("UnlinkFallback", "Error showing overlay: ${e.message}")
                }
            }
            updateOverlayContent()
        } else {
            if (overlayView?.parent != null) {
                try {
                    windowManager?.removeView(overlayView)
                } catch (e: Exception) {
                    Log.e("UnlinkFallback", "Error removing overlay: ${e.message}")
                }
            }
        }
    }

    private fun createOverlay() {
        val inflater = getSystemService(Context.LAYOUT_INFLATER_SERVICE) as LayoutInflater
        val layoutId = resources.getIdentifier("blocking_overlay_full", "layout", packageName)
        overlayView = inflater.inflate(layoutId, null)

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            else
                @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_SYSTEM_ALERT,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        )
        overlayView?.layoutParams = params

        // Handle the Go Home button
        val btnId = resources.getIdentifier("goHomeButton", "id", packageName)
        overlayView?.findViewById<View>(btnId)?.setOnClickListener {
            val homeIntent = Intent(Intent.ACTION_MAIN)
            homeIntent.addCategory(Intent.CATEGORY_HOME)
            homeIntent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
            startActivity(homeIntent)
        }
    }

    private fun updateOverlayContent() {
        val messageId = resources.getIdentifier("messageText", "id", packageName)
        val prefs = getSharedPreferences("UnlinkBlockingPrefs", Context.MODE_PRIVATE)
        val message = prefs.getString("focus_message", "FOCUS_PROTOCOL_ENFORCED")
        overlayView?.findViewById<TextView>(messageId)?.text = message
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val serviceChannel = NotificationChannel(
                CHANNEL_ID,
                "Unlink Fallback Protection",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(serviceChannel)
        }
    }

    private fun createNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Unlink Focus Protection")
            .setContentText("Lite Engine Active (Usage Stats mode)")
            .setSmallIcon(android.R.drawable.ic_dialog_info) // Should be replaced by app icon
            .build()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        pollingTimer?.cancel()
        setWallVisibility(false)
        super.onDestroy()
    }
}
