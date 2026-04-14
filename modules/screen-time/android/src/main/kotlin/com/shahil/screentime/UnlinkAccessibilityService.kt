package com.shahil.screentime

import android.accessibilityservice.AccessibilityService
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
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
    
    private val pulseHandler = Handler(Looper.getMainLooper())
    private var currentBlockedApps: Set<String> = emptySet()
    
    private val pulseRunnable = object : Runnable {
        override fun run() {
            try {
                performDualLayerScan()
            } catch (e: Exception) {
                Log.e("UnlinkEnforcement", "Pulse error", e)
            } finally {
                pulseHandler.postDelayed(this, 500)
            }
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        
        try {
            createNotificationChannel()
            startForeground(NOTIFICATION_ID, createNotification())
            
            // Initializing the "Ghost Wall" lazy loader
            refreshFromDiskInternal()
            pulseHandler.postDelayed(pulseRunnable, 500)
            
            Toast.makeText(this, "ENGINE_ONLINE: Snap Ready", Toast.LENGTH_SHORT).show()
        } catch (e: Exception) {
            Log.e("UnlinkEnforcement", "Service start failure", e)
        }
    }

    fun updateBlockedApps(newList: Set<String>) {
        currentBlockedApps = newList
        Toast.makeText(this, "DATA_SYNC: Monitoring ${currentBlockedApps.size} apps", Toast.LENGTH_SHORT).show()
        performDualLayerScan()
    }

    private fun refreshFromDiskInternal() {
        try {
            val prefs = getSharedPreferences("UnlinkBlockingPrefs", Context.MODE_PRIVATE)
            currentBlockedApps = prefs.getStringSet("blocked_apps", emptySet()) ?: emptySet()
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

            if (isTarget && !isSafeZone) {
                // NOISY ALERT: If you see this but no wall, then showOverlay is failing
                Log.d("UnlinkEnforcement", "TARGET_DETECTED: $pkg")
                setWallVisibility(true)
            } else {
                setWallVisibility(false)
            }
        }
    }

    private fun setWallVisibility(visible: Boolean) {
        pulseHandler.post {
            try {
                if (visible) {
                    if (overlayView == null) {
                        Log.d("UnlinkEnforcement", "Lazy-creating wall...")
                        createGhostWallNow()
                    }
                    if (overlayView?.visibility != View.VISIBLE) {
                        overlayView?.visibility = View.VISIBLE
                        Toast.makeText(this, "BLOCK_ACTIVE", Toast.LENGTH_SHORT).show()
                    }
                } else {
                    if (overlayView?.visibility != View.GONE) {
                        overlayView?.visibility = View.GONE
                    }
                }
            } catch (e: Exception) {
                Log.e("UnlinkEnforcement", "Visibility toggle failure", e)
            }
        }
    }

    private fun createGhostWallNow() {
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
                overlayView = createFailsafeView("SYSTEM")
            }

            val params = WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or 
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT
            )

            windowManager?.addView(overlayView, params)
            Log.d("UnlinkEnforcement", "Wall added to window manager")
        } catch (e: Exception) {
            Log.e("UnlinkEnforcement", "Wall creation failed", e)
            Toast.makeText(this, "WALL_ERROR: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }

    private fun getForegroundAppViaUsageStats(): String? {
        return try {
            val usageStatsManager = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val time = System.currentTimeMillis()
            val usageEvents = usageStatsManager.queryEvents(time - 3000, time)
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

    private fun createFailsafeView(pkg: String): View {
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
        try { windowManager?.removeView(overlayView) } catch (e: Exception) {}
        instance = null
        pulseHandler.removeCallbacks(pulseRunnable)
        super.onDestroy()
    }

    override fun onInterrupt() {}
}
