package com.shahil.screentime

import android.accessibilityservice.AccessibilityService
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.widget.Button
import android.widget.FrameLayout
import android.widget.TextView
import android.widget.Toast
import androidx.core.app.NotificationCompat

class UnlinkAccessibilityService : AccessibilityService() {

    companion object {
        @Volatile
        var instance: UnlinkAccessibilityService? = null
            private set
    }

    private val CHANNEL_ID = "unlink_protection_channel"
    private val NOTIFICATION_ID = 1001
    
    private var windowManager: WindowManager? = null
    private var overlayView: View? = null
    private var isWallActive = false

    private val pulseHandler = Handler(Looper.getMainLooper())
    private var currentBlockedApps: Set<String> = emptySet()
    
    private var currentFocusMessage = "FOCUS_PROTOCOL_ENGAGED"
    private var currentTimeRemaining = ""

    private var detectionThread: Thread? = null
    private var shouldRunDetection = false

    private val syncReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            refreshFromDiskInternal()
            performDualLayerScan()
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        
        try {
            createNotificationChannel()
            startForeground(NOTIFICATION_ID, createNotification())
            
            val filter = IntentFilter("com.shahil.unlink.SYNC_LIST")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                registerReceiver(syncReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
            } else {
                registerReceiver(syncReceiver, filter)
            }

            refreshFromDiskInternal()
            startDetectionHeartbeat()
            
            Toast.makeText(this, "REVERTED: Switcher Shadow Removed", Toast.LENGTH_SHORT).show()
        } catch (e: Exception) {
            Log.e("UnlinkEnforcement", "Service start failure", e)
        }
    }

    private fun startDetectionHeartbeat() {
        shouldRunDetection = true
        detectionThread = Thread {
            while (shouldRunDetection) {
                try {
                    // ATOMIC_HEARTBEAT: Still refreshing every beat to keep timer alive
                    refreshFromDiskInternal()
                    performDualLayerScan()
                    Thread.sleep(150)
                } catch (e: InterruptedException) {
                    break
                } catch (e: Exception) {
                    Log.e("UnlinkEnforcement", "Heartbeat error", e)
                }
            }
        }
        detectionThread?.start()
    }

    fun updateBlockedApps(newList: Set<String>) {
        currentBlockedApps = newList
        performDualLayerScan()
    }

    private fun refreshFromDiskInternal() {
        try {
            val prefs = getSharedPreferences("UnlinkBlockingPrefs", Context.MODE_PRIVATE)
            currentBlockedApps = prefs.getStringSet("blocked_apps", emptySet()) ?: emptySet()
            currentFocusMessage = prefs.getString("focus_message", "FOCUS_PROTOCOL_ENGAGED") ?: "FOCUS_PROTOCOL_ENGAGED"
            currentTimeRemaining = prefs.getString("time_remaining", "00:00") ?: "00:00"
        } catch (e: Exception) {
            currentBlockedApps = emptySet()
        }
    }

    private fun performDualLayerScan() {
        if (currentBlockedApps.isEmpty()) {
            setWallVisibility(false)
            return
        }

        var foregroundPkg: String? = null
        try {
            foregroundPkg = rootInActiveWindow?.packageName?.toString()
        } catch (e: Exception) {}

        if (foregroundPkg == null || foregroundPkg == "com.android.systemui") {
            foregroundPkg = getForegroundAppViaUsageStats()
        }

        foregroundPkg?.let { pkg ->
            val isTarget = currentBlockedApps.any { blocked -> pkg.contains(blocked, ignoreCase = true) }
            val isSafeZone = pkg == "com.android.systemui" || 
                             pkg.contains("launcher", ignoreCase = true) || 
                             pkg == getPackageName()

            // REVERTED: We only block if we are actually in the target app
            // We NO LONGER "shadow" the task switcher
            if (isTarget && !isSafeZone) {
                setWallVisibility(true)
            } else {
                setWallVisibility(false)
            }
        } ?: run {
            setWallVisibility(false)
        }
    }

    private val visibilityHandler = Handler(Looper.getMainLooper())
    private var hideRunnable: Runnable? = null

    private fun setWallVisibility(visible: Boolean) {
        pulseHandler.post {
            try {
                if (visible) {
                    hideRunnable?.let { visibilityHandler.removeCallbacks(it) }
                    hideRunnable = null
                    
                    if (overlayView == null) createAbsoluteWall()
                    updateWallContent()
                    
                    if (!isWallActive) {
                        overlayView?.visibility = View.VISIBLE
                        overlayView?.alpha = 0f
                        overlayView?.animate()?.alpha(1f)?.setDuration(100)?.start()
                        isWallActive = true
                    }
                } else {
                    if (isWallActive && hideRunnable == null) {
                        hideRunnable = Runnable {
                            overlayView?.animate()?.alpha(0f)?.setDuration(150)?.withEndAction {
                                overlayView?.visibility = View.GONE
                                isWallActive = false
                                hideRunnable = null
                            }?.start()
                        }
                        visibilityHandler.postDelayed(hideRunnable!!, 150)
                    }
                }
            } catch (e: Exception) {
                Log.e("UnlinkEnforcement", "Visibility toggle failure", e)
            }
        }
    }

    private fun updateWallContent() {
        try {
            val myPackageName = getPackageName()
            val messageId = resources.getIdentifier("messageText", "id", myPackageName)
            val timerId = resources.getIdentifier("timerText", "id", myPackageName)
            
            if (messageId != 0) overlayView?.findViewById<TextView>(messageId)?.text = currentFocusMessage
            if (timerId != 0) overlayView?.findViewById<TextView>(timerId)?.text = currentTimeRemaining
        } catch (e: Exception) {}
    }

    private fun createAbsoluteWall() {
        try {
            val myPackageName = getPackageName()
            val inflater = getSystemService(Context.LAYOUT_INFLATER_SERVICE) as LayoutInflater
            val layoutId = resources.getIdentifier("blocking_overlay_full", "layout", myPackageName)

            if (layoutId != 0) {
                overlayView = inflater.inflate(layoutId, null)
                overlayView?.findViewById<Button>(resources.getIdentifier("goHomeButton", "id", myPackageName))?.setOnClickListener {
                    goHome()
                }
            } else {
                overlayView = createFailsafeView()
            }

            val params = WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or 
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_SECURE,
                PixelFormat.TRANSLUCENT
            )

            overlayView?.visibility = View.GONE
            windowManager?.addView(overlayView, params)
        } catch (e: Exception) {
            Log.e("UnlinkEnforcement", "Wall creation failed", e)
        }
    }

    private fun getForegroundAppViaUsageStats(): String? {
        return try {
            val usageStatsManager = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val time = System.currentTimeMillis()
            val usageEvents = usageStatsManager.queryEvents(time - 2000, time)
            val event = UsageEvents.Event()
            var lastPkg: String? = null
            
            while (usageEvents.hasNextEvent()) {
                usageEvents.getNextEvent(event)
                if (event.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND) {
                    lastPkg = event.packageName
                }
            }
            lastPkg
        } catch (e: Exception) {
            null
        }
    }

    private fun createFailsafeView(): View {
        val root = FrameLayout(this)
        root.setBackgroundColor(Color.BLACK)
        val tv = TextView(this)
        tv.text = "FOCUS_PROTOCOL_ENGAGED"
        tv.setTextColor(Color.WHITE)
        tv.gravity = Gravity.CENTER
        tv.textSize = 24f
        root.addView(tv, FrameLayout.LayoutParams(FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.CENTER))
        
        val btn = Button(this)
        btn.text = "GO HOME"
        btn.setOnClickListener { goHome() }
        val bP = FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, 200, Gravity.BOTTOM)
        bP.setMargins(50, 50, 50, 100)
        root.addView(btn, bP)
        return root
    }

    private fun goHome() {
        try {
            val intent = Intent(Intent.ACTION_MAIN)
            intent.addCategory(Intent.CATEGORY_HOME)
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
            startActivity(intent)
            setWallVisibility(false)
        } catch (e: Exception) {
            Log.e("UnlinkEnforcement", "Go home failed", e)
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        if (event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            performDualLayerScan()
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL_ID, "Unlink Protection", NotificationManager.IMPORTANCE_LOW)
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    private fun createNotification(): Notification {
        val pendingIntent = PendingIntent.getActivity(this, 0, packageManager.getLaunchIntentForPackage(packageName), PendingIntent.FLAG_IMMUTABLE)
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Unlink Protection Active")
            .setContentText("Airtight Focus Protocol is engaged.")
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()
    }

    override fun onDestroy() {
        shouldRunDetection = false
        detectionThread?.interrupt()
        try { unregisterReceiver(syncReceiver) } catch (e: Exception) {}
        try { windowManager?.removeView(overlayView) } catch (e: Exception) {}
        instance = null
        super.onDestroy()
    }

    override fun onInterrupt() {}
}
