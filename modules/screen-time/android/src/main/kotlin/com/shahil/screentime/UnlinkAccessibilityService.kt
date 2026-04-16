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
            setSuspendedState(null) // null triggers read from disk
        }
    }

    /**
     * DIRECT_SERVICE_LINK: Allows the UI to instantly kill all blocks
     * passing 'null' forces a disk refresh.
     */
    fun setSuspendedState(suspended: Boolean?) {
        if (suspended == null) {
            refreshFromDiskInternal()
        } else {
            isBlockingSuspended = suspended
        }
        
        // IMMEDIATE_REACTION: Execute on Main Thread to kill walls instantly
        val mainHandler = Handler(Looper.getMainLooper())
        if (Looper.myLooper() == Looper.getMainLooper()) {
            if (isBlockingSuspended) {
                setWallVisibility(false, false)
            } else {
                performDualLayerScan()
            }
        } else {
            mainHandler.post {
                if (isBlockingSuspended) {
                    setWallVisibility(false, false)
                } else {
                    performDualLayerScan()
                }
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
                    // ATOMIC_HEARTBEAT: Force refresh on every beat to ensure no state lag
                    refreshFromDiskInternal()
                    performDualLayerScan()
                    Thread.sleep(50)
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

    @Volatile
    private var surgicalYoutube = false
    @Volatile
    private var surgicalInstagram = false
    @Volatile
    private var studyModeActive = false
    @Volatile
    private var isBlockingSuspended = false

    private var countdownTimer: android.os.CountDownTimer? = null

    private fun refreshFromDiskInternal() {
        try {
            val prefs = getSharedPreferences("UnlinkBlockingPrefs", Context.MODE_PRIVATE)
            currentBlockedApps = prefs.getStringSet("blocked_apps", emptySet()) ?: emptySet()
            currentFocusMessage = prefs.getString("focus_message", "FOCUS_PROTOCOL_ENGAGED") ?: "FOCUS_PROTOCOL_ENGAGED"
            currentTimeRemaining = prefs.getString("time_remaining", "00:00") ?: "00:00"
            
            surgicalYoutube = prefs.getBoolean("surgical_youtube", false)
            surgicalInstagram = prefs.getBoolean("surgical_instagram", false)
            studyModeActive = prefs.getBoolean("study_mode_active", false)
            isBlockingSuspended = prefs.getBoolean("is_blocking_suspended", false)
        } catch (e: Exception) {
            currentBlockedApps = emptySet()
        }
    }

    fun startNativeTimer(minutes: Int, startTime: Long) {
        pulseHandler.post {
            countdownTimer?.cancel()
            val totalMillis = minutes * 60 * 1000L
            val elapsed = System.currentTimeMillis() - startTime
            val remaining = totalMillis - elapsed

            if (remaining > 0) {
                countdownTimer = object : android.os.CountDownTimer(remaining, 10000) {
                    override fun onTick(millisUntilFinished: Long) {
                        // Periodic refresh handled by heartbeat
                    }
                    override fun onFinish() {
                        teardownAllBlocks()
                    }
                }.start()
            } else {
                teardownAllBlocks()
            }
        }
    }

    private fun teardownAllBlocks() {
        val prefs = getSharedPreferences("UnlinkBlockingPrefs", Context.MODE_PRIVATE)
        prefs.edit().apply {
            putStringSet("blocked_apps", emptySet())
            putBoolean("surgical_youtube", false)
            putBoolean("surgical_instagram", false)
            putBoolean("is_uninstall_protected", false)
            putBoolean("is_blocking_suspended", false)
            commit()
        }
        refreshFromDiskInternal()
        setWallVisibility(false, false)
    }

    private fun performDualLayerScan() {
        if (isBlockingSuspended) {
            setWallVisibility(false, false)
            return
        }

        var foregroundPkg: String? = null
        try {
            val root = rootInActiveWindow
            foregroundPkg = root?.packageName?.toString()
            if (foregroundPkg != null) {
                Log.d("UnlinkEnforcement", "Detected Window: $foregroundPkg")
            }
        } catch (e: Exception) {}

        if (foregroundPkg == null || foregroundPkg == "com.android.systemui") {
            foregroundPkg = getForegroundAppViaUsageStats()
        }

        foregroundPkg?.let { pkg ->
            val isFullBlock = currentBlockedApps.any { blocked -> pkg.contains(blocked, ignoreCase = true) }
            val isSafeZone = pkg == "com.android.systemui" || 
                             pkg.contains("launcher", ignoreCase = true) || 
                             pkg == getPackageName()

            if (isFullBlock && !isSafeZone) {
                // LAYER_1: FULL_APP_BLOCK
                setWallVisibility(true, false)
            } else if (!isSafeZone && isSurgicalApp(pkg)) {
                // LAYER_2: SURGICAL_BLOCK
                val surgicalTriggered = detectSurgicalTriggers(pkg)
                setWallVisibility(surgicalTriggered, true)
            } else {
                setWallVisibility(false, false)
            }
        } ?: run {
            setWallVisibility(false, false)
        }
    }

    private fun isSurgicalApp(pkg: String): Boolean {
        return (pkg == "com.google.android.youtube" && surgicalYoutube) ||
               (pkg == "com.instagram.android" && surgicalInstagram)
    }

    private fun detectSurgicalTriggers(pkg: String): Boolean {
        val rootNode = rootInActiveWindow ?: return false
        
        // 1. YouTube Shorts Detection
        if (pkg == "com.google.android.youtube") {
            val shortsNodes = rootNode.findAccessibilityNodeInfosByText("Shorts")
            if (shortsNodes != null && shortsNodes.isNotEmpty()) {
                // Many times "Shorts" text exists on the home tab, we need to check if it's the SELECTED tab
                for (node in shortsNodes) {
                    if (node.isSelected || node.isFocused || node.className?.contains("Button") == true) {
                        // If it's a selected tab or a focused player area
                        return true
                    }
                }
            }
            
            // Fallback: Check for common Shorts view IDs or structural markers
            if (rootNode.viewIdResourceName?.contains("shorts_player") == true) return true
            
            // Study Mode: Check video titles
            if (studyModeActive) {
                return detectNonStudyContent(rootNode)
            }
        }

        // 2. Instagram Reels Detection
        if (pkg == "com.instagram.android") {
            val reelsNodes = rootNode.findAccessibilityNodeInfosByText("Reels")
            if (reelsNodes != null && reelsNodes.isNotEmpty()) {
                for (node in reelsNodes) {
                    if (node.isSelected || node.className?.contains("Tab") == true) return true
                }
            }
            if (rootNode.viewIdResourceName?.contains("reels_video_container") == true) return true
        }

        return false
    }

    private fun detectNonStudyContent(root: android.view.accessibility.AccessibilityNodeInfo): Boolean {
        // Implementation for Study Mode: Scans for non-educational titles
        // For now, if we match common distractors
        val distractorKeywords = listOf("Gaming", "Prank", "Challenge", "Funny")
        val allNodes = mutableListOf<android.view.accessibility.AccessibilityNodeInfo>()
        findTextNodes(root, allNodes)
        
        for (node in allNodes) {
            val text = node.text?.toString() ?: continue
            for (keyword in distractorKeywords) {
                if (text.contains(keyword, ignoreCase = true)) return true
            }
        }
        return false
    }

    private fun findTextNodes(node: android.view.accessibility.AccessibilityNodeInfo?, results: MutableList<android.view.accessibility.AccessibilityNodeInfo>) {
        if (node == null) return
        if (node.text != null) results.add(node)
        for (i in 0 until node.childCount) {
            findTextNodes(node.getChild(i), results)
        }
    }

    private val visibilityHandler = Handler(Looper.getMainLooper())
    private var hideRunnable: Runnable? = null
    private var isSurgicalWall = false

    private fun setWallVisibility(visible: Boolean, surgical: Boolean) {
        val action = Runnable {
            try {
                if (visible) {
                    hideRunnable?.let { visibilityHandler.removeCallbacks(it) }
                    hideRunnable = null
                    
                    // RE-CREATE WALL IF TYPE CHANGES (Full vs Surgical)
                    if (isSurgicalWall != surgical && overlayView != null) {
                        windowManager?.removeView(overlayView)
                        overlayView = null
                    }
                    isSurgicalWall = surgical

                    if (overlayView == null) createAbsoluteWall(surgical)
                    updateWallContent()
                    
                    if (!isWallActive) {
                        overlayView?.visibility = View.VISIBLE
                        overlayView?.alpha = 0f
                        overlayView?.animate()?.alpha(1f)?.setDuration(100)?.start()
                        isWallActive = true
                    }
                } else {
                    // AGGRESSIVE_HIDE: Close animation gap
                    if (hideRunnable == null) {
                        if (isWallActive || (overlayView != null && overlayView?.visibility == View.VISIBLE)) {
                            hideRunnable = Runnable {
                                overlayView?.animate()?.alpha(0f)?.setDuration(100)?.withEndAction {
                                    overlayView?.visibility = View.GONE
                                    isWallActive = false
                                    hideRunnable = null
                                }?.start()
                            }
                            visibilityHandler.postDelayed(hideRunnable!!, 10)
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e("UnlinkEnforcement", "Visibility toggle failure", e)
            }
        }

        if (Looper.myLooper() == Looper.getMainLooper()) {
            action.run()
        } else {
            pulseHandler.post(action)
        }
    }

    private fun updateWallContent() {
        try {
            val myPackageName = getPackageName()
            val messageId = resources.getIdentifier("messageText", "id", myPackageName)
            val timerId = resources.getIdentifier("timerText", "id", myPackageName)
            
            // Also surgical labels
            val surgicalTitleId = resources.getIdentifier("surgicalTitle", "id", myPackageName)
            
            if (messageId != 0) overlayView?.findViewById<TextView>(messageId)?.text = currentFocusMessage
            if (timerId != 0) overlayView?.findViewById<TextView>(timerId)?.text = currentTimeRemaining
            if (surgicalTitleId != 0) overlayView?.findViewById<TextView>(surgicalTitleId)?.text = "SECTION_RESTRICTED"
        } catch (e: Exception) {}
    }

    private fun createAbsoluteWall(surgical: Boolean) {
        if (isBlockingSuspended) return
        
        try {
            val myPackageName = getPackageName()
            val inflater = getSystemService(Context.LAYOUT_INFLATER_SERVICE) as LayoutInflater
            
            val layoutName = if (surgical) "blocking_overlay_surgical" else "blocking_overlay_full"
            val layoutId = resources.getIdentifier(layoutName, "layout", myPackageName)

            if (layoutId != 0) {
                overlayView = inflater.inflate(layoutId, null)
                
                // Common Home Button
                val homeBtnId = resources.getIdentifier(if (surgical) "surgicalGoHome" else "goHomeButton", "id", myPackageName)
                if (homeBtnId != 0) {
                    overlayView?.findViewById<Button>(homeBtnId)?.setOnClickListener {
                        goHome()
                    }
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
            // Widen window to 5s to catch slow events
            val usageEvents = usageStatsManager.queryEvents(time - 5000, time)
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
            setWallVisibility(false, false)
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
