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
import android.os.VibrationEffect
import android.os.Vibrator
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
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
    private var isBlockingSuspended = false
    private var lastSurgicalPackage: String? = null
    
    private var lastShortsDetectedTime: Long = 0
    private var breadcrumbDetectedShorts = false
    private var lastBackActionTime: Long = 0 
    private val BACK_ACTION_COOLDOWN = 100L 
    private val STICKY_DELAY_MS = 1500L 
    
    private val pulseHandler = Handler(Looper.getMainLooper())
    private val visibilityHandler = Handler(Looper.getMainLooper())
    private var hideRunnable: Runnable? = null
    private var currentBlockedApps: Set<String> = emptySet()
    
    private var surgicalCanvas: SurgicalCanvasView? = null
    private var mappingOverlay: FrameLayout? = null
    
    private var cachedSurgicalYoutube = false
    private var cachedSurgicalInstagram = false
    private var cachedStudyModeActive = false
    private var cachedIsBlockingSuspended = false
    
    private var currentFocusMessage = "FOCUS_PROTOCOL_ENGAGED"
    private var currentTimeRemaining = ""
    private var blockExpiryTime: Long = 0L
    private var isNavigatingHome = false

    private val countdownHandler = Handler(Looper.getMainLooper())
    private val countdownRunnable = object : Runnable {
        override fun run() {
            updateOverlayTimer()
            countdownHandler.postDelayed(this, 1000)
        }
    }


    private val syncReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            setSuspendedState(null)
        }
    }

    fun setSuspendedState(suspended: Boolean?) {
        if (suspended == null) {
            refreshServiceConfig()
        } else {
            isBlockingSuspended = suspended
            if (isBlockingSuspended) setWallVisibility(false, false)
            else performDualLayerScan()
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        val pkg = event.packageName?.toString()
        if (pkg != null) lastSurgicalPackage = pkg
        routeEliteEvent(event)
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
            refreshServiceConfig()
            
            visibilityHandler.post {
                if (mappingOverlay == null) createMappingOverlay()
                if (overlayView == null) createAbsoluteWall(isSurgical = false)
            }
        } catch (e: Exception) {
            Log.e("UnlinkElite", "FATAL: Service start failure", e)
        }
    }

    fun refreshServiceConfig() {
        refreshFromDiskInternal()
        
        val targetPackages = mutableSetOf<String>()
        targetPackages.addAll(currentBlockedApps)
        if (cachedSurgicalYoutube) targetPackages.add("com.google.android.youtube")
        if (cachedSurgicalInstagram) targetPackages.add("com.instagram.android")
        
        // PROACTIVE_SCAN: Monitor launcher and SystemUI for zero-latency blocking
        targetPackages.add(getLauncherPackageName())
        targetPackages.add("com.android.systemui")

        val info = serviceInfo
        info.eventTypes = AccessibilityEvent.TYPE_WINDOWS_CHANGED or
                        AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED or
                        AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED or
                        AccessibilityEvent.TYPE_VIEW_CLICKED
        info.packageNames = targetPackages.toTypedArray()
        info.notificationTimeout = 50L
        info.flags = info.flags or 
                    android.accessibilityservice.AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS or
                    android.accessibilityservice.AccessibilityServiceInfo.FLAG_INCLUDE_NOT_IMPORTANT_VIEWS
        
        serviceInfo = info
        
        // Immediate check
        performDualLayerScan()
    }

    private fun getLauncherPackageName(): String {
        val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
        val resolveInfo = packageManager.resolveActivity(intent, android.content.pm.PackageManager.MATCH_DEFAULT_ONLY)
        return resolveInfo?.activityInfo?.packageName ?: "com.google.android.launcher"
    }

    private fun isLauncherOrHomePackage(pkg: String?): Boolean {
        if (pkg == null) return false
        val launcherPkg = getLauncherPackageName()
        return pkg == launcherPkg || pkg.contains("launcher", ignoreCase = true) || pkg == "com.android.launcher"
    }

    private fun isBlockActive(pkg: String): Boolean {
        if (isBlockingSuspended) return false
        
        val currentTime = System.currentTimeMillis()
        if (blockExpiryTime > 0 && currentTime >= blockExpiryTime) {
            // Timer expired, but we check if apps are still explicitly blocked in the list
            // For now, if expiry > 0, the expiry is the primary source of truth for the block session.
            return false
        }
        
        return currentBlockedApps.any { blocked -> pkg.contains(blocked, ignoreCase = true) }
    }

    private fun teardownAllBlocks() {
        val prefs = getSharedPreferences("UnlinkBlockingPrefs", Context.MODE_PRIVATE)
        prefs.edit().apply {
            putStringSet("blocked_apps", emptySet())
            putBoolean("surgical_youtube", false)
            putBoolean("surgical_instagram", false)
            putBoolean("is_blocking_suspended", false)
            putLong("block_expiry_time", 0L)
            commit()
        }
        refreshFromDiskInternal()
        // AUTO_STOP_EXIT: Trigger the smooth 180ms slide-down exit
        setWallVisibility(false, false)
    }

    private fun refreshFromDiskInternal() {
        try {
            val prefs = getSharedPreferences("UnlinkBlockingPrefs", Context.MODE_PRIVATE)
            currentBlockedApps = prefs.getStringSet("blocked_apps", emptySet()) ?: emptySet()
            currentFocusMessage = prefs.getString("focus_message", "FOCUS_PROTOCOL_ENGAGED") ?: "FOCUS_PROTOCOL_ENGAGED"
            currentTimeRemaining = prefs.getString("time_remaining", "00:00") ?: "00:00"
            blockExpiryTime = prefs.getLong("block_expiry_time", 0L)
            
            cachedSurgicalYoutube = prefs.getBoolean("surgical_youtube", false)
            cachedSurgicalInstagram = prefs.getBoolean("surgical_instagram", false)
            cachedStudyModeActive = prefs.getBoolean("study_mode_active", false)
            cachedIsBlockingSuspended = prefs.getBoolean("is_blocking_suspended", false)
            
            isBlockingSuspended = cachedIsBlockingSuspended
        } catch (e: Exception) {}
    }

    private fun performDualLayerScan() {
        val root = rootInActiveWindow
        var foregroundPkg = root?.packageName?.toString()

        if (foregroundPkg == null || foregroundPkg == "com.android.systemui") {
            foregroundPkg = getForegroundAppViaUsageStats()
        }

        foregroundPkg?.let { pkg ->
            val launcherPkg = getLauncherPackageName()
            val isSafeZone = pkg == launcherPkg || pkg == packageName

            // RECENT_APPS_PROTECTION: If in system UI and we were just in a blocked app, keep wall up
            if (pkg == "com.android.systemui" || isNavigatingHome) {
                if (lastSurgicalPackage != null && (isBlockActive(lastSurgicalPackage!!) || 
                    (lastSurgicalPackage == "com.google.android.youtube" && cachedSurgicalYoutube))) {
                    setWallVisibility(true, false)
                    return
                }
            }
            
            lastSurgicalPackage = pkg 
            val isSurgical = (pkg == "com.google.android.youtube" && cachedSurgicalYoutube) ||
                             (pkg == "com.instagram.android" && cachedSurgicalInstagram)

            if (isSurgical && !isSafeZone) {
                val surgicalTriggered = if (root != null) detectSurgicalTriggersForRoot(root, pkg) else false
                if (surgicalTriggered) {
                    val now = System.currentTimeMillis()
                    if (now - lastBackActionTime > BACK_ACTION_COOLDOWN) {
                        tryForceYouTubeHomeNavigation()
                        lastBackActionTime = now
                        breadcrumbDetectedShorts = false
                    }
                    setWallVisibility(false, false) 
                } else {
                    setWallVisibility(false, true)
                    if (root != null) performSurgicalDetection(root)
                }
            } else {
                if (isBlockActive(pkg) && !isSafeZone) {
                    setWallVisibility(true, false)
                } else {
                    // Only hide if we aren't mid-transition to Home
                    if (!isNavigatingHome) setWallVisibility(false, false)
                }
            }
        } ?: run {
            if (!isNavigatingHome) setWallVisibility(false, false)
        }
    }

    private fun detectSurgicalTriggersForRoot(rootNode: AccessibilityNodeInfo, pkg: String): Boolean {
        if (pkg == "com.google.android.youtube") {
            val shortsIds = listOf(
                "com.google.android.youtube:id/reel_watch_fragment_root",
                "com.google.android.youtube:id/reel_recycler"
            )
            for (id in shortsIds) {
                if (rootNode.findAccessibilityNodeInfosByViewId(id).isNotEmpty()) {
                    lastShortsDetectedTime = System.currentTimeMillis()
                    return true
                }
            }
            val shortsNodes = rootNode.findAccessibilityNodeInfosByText("Shorts")
            shortsNodes?.forEach { node ->
                if (node.isSelected && (node.className?.contains("Tab") == true || node.className?.contains("Button") == true)) return true
            }
            if (detectShortsDNA(rootNode) || breadcrumbDetectedShorts) {
                lastShortsDetectedTime = System.currentTimeMillis()
                return true
            }
            if (System.currentTimeMillis() - lastShortsDetectedTime < STICKY_DELAY_MS) return true
        }

        if (pkg == "com.instagram.android") {
            val reelsNodes = rootNode.findAccessibilityNodeInfosByText("Reels")
            reelsNodes?.forEach { node ->
                if (node.isSelected || node.className?.contains("Tab") == true) return true
            }
            if (rootNode.viewIdResourceName?.contains("reels_video_container") == true) return true
        }
        return false
    }

    private fun performSurgicalDetection(root: AccessibilityNodeInfo) {
        val visiblePatches = mutableListOf<Pair<android.graphics.Rect, Boolean>>()
        val currentPkg = lastSurgicalPackage ?: ""
        
        if (currentPkg == "com.google.android.youtube" && cachedSurgicalYoutube) {
            val nodesToScan = mutableListOf(root)
            var i = 0
            while (i < nodesToScan.size && i < 300) {
                val node = nodesToScan[i++]
                
                // SURGICAL_PRECISION_MATCH: Only target RECIPIENT horizontal rolls
                if (node.className?.contains("RecyclerView") == true && node.childCount > 1) {
                    try {
                        val c0 = node.getChild(0)
                        val c1 = node.getChild(1)
                        val b0 = android.graphics.Rect(); val b1 = android.graphics.Rect()
                        c0?.getBoundsInScreen(b0); c1?.getBoundsInScreen(b1)
                        
                        // TEST: Are they side-by-side? (Same top coordinate)
                        val isHorizontal = Math.abs(b0.top - b1.top) < 20 // 20px tolerance
                        // TEST: Are they portrait? (Shorts grid)
                        val isPortrait = b0.height() > (b0.width() * 1.3)
                        
                        if (isHorizontal && isPortrait) {
                            val sb = android.graphics.Rect()
                            node.getBoundsInScreen(sb)
                            // Safety: Never bury the whole screen
                            if (sb.height() < resources.displayMetrics.heightPixels * 0.8) {
                                visiblePatches.add(Pair(sb, true))
                            }
                        }
                    } catch (e: Exception) {}
                }
                
                // Backup identification for IDs
                val id = node.viewIdResourceName?.lowercase() ?: ""
                if (id.contains("shorts_shelf") || id.contains("shelf_container")) {
                    val sb = android.graphics.Rect()
                    node.getBoundsInScreen(sb)
                    visiblePatches.add(Pair(sb, true))
                }

                for (j in 0 until node.childCount) {
                    node.getChild(j)?.let { nodesToScan.add(it) }
                }
            }
        }
        renderPatches(visiblePatches)
    }

    private fun setWallVisibility(visible: Boolean, surgical: Boolean) {
        visibilityHandler.post {
            // OS_LEVEL_TRANSITION: We use addView/removeView with system animations
            // This is the "Regain Level" way to ensure 0ms jerking
            
            if (overlayView == null) createAbsoluteWall(false)
            val view = overlayView ?: return@post
            
            // SECURITY_GUARD: Check intended state to avoid redundant calls
            if (visible == (view.parent != null)) return@post
            
            if (visible) {
                try {
                    val vibrator = getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        vibrator.vibrate(VibrationEffect.createOneShot(20, VibrationEffect.DEFAULT_AMPLITUDE))
                    } else {
                        vibrator.vibrate(20)
                    }
                } catch (e: Exception) {}

                updateWallContent()
                val params = view.layoutParams as WindowManager.LayoutParams
                params.dimAmount = 1.0f
                
                try {
                    windowManager?.addView(view, params)
                    countdownHandler.post(countdownRunnable)
                } catch (e: Exception) {}
            } else {
                try {
                    windowManager?.removeView(view)
                    countdownHandler.removeCallbacks(countdownRunnable)
                } catch (e: Exception) {}
            }
        }
    }

    private fun updateOverlayTimer() {
        val currentTime = System.currentTimeMillis()
        val remaining = blockExpiryTime - currentTime
        if (remaining <= 0) {
            currentTimeRemaining = "00:00"
            if (blockExpiryTime > 0) teardownAllBlocks()
            return
        }
        
        val totalSeconds = remaining / 1000
        val mins = totalSeconds / 60
        val secs = totalSeconds % 60
        currentTimeRemaining = String.format("%02d:%02d", mins, secs)
        
        overlayView?.let { view ->
            val myPackageName = packageName
            val timerId = resources.getIdentifier("timerText", "id", myPackageName)
            if (timerId != 0) {
                view.findViewById<TextView>(timerId)?.text = currentTimeRemaining
            }
        }
    }

    private fun updateWallContent() {
        try {
            val myPackageName = getPackageName()
            val messageId = resources.getIdentifier("messageText", "id", myPackageName)
            val surgicalTitleId = resources.getIdentifier("surgicalTitle", "id", myPackageName)
            if (surgicalTitleId != 0) {
                val surgicalText = when(lastSurgicalPackage) {
                    "com.google.android.youtube" -> "YOUTUBE_SHORTS_RESTRICTED"
                    "com.instagram.android" -> "INSTAGRAM_REELS_RESTRICTED"
                    else -> "SECTION_RESTRICTED"
                }
                overlayView?.findViewById<TextView>(surgicalTitleId)?.text = surgicalText
            }
            if (messageId != 0) overlayView?.findViewById<TextView>(messageId)?.text = currentFocusMessage
        } catch (e: Exception) {}
    }

    private fun createAbsoluteWall(isSurgical: Boolean) {
        if (windowManager == null) windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        try {
            val myPackageName = getPackageName()
            val inflater = getSystemService(Context.LAYOUT_INFLATER_SERVICE) as LayoutInflater
            val layoutId = resources.getIdentifier("blocking_overlay_full", "layout", myPackageName)
            overlayView = if (layoutId != 0) inflater.inflate(layoutId, null) else createFailsafeView()
            val homeBtnId = resources.getIdentifier("goHomeButton", "id", myPackageName)
            overlayView?.findViewById<Button>(homeBtnId)?.setOnClickListener { goHome() }
            val params = WindowManager.LayoutParams(
                -1, -1, WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or 
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or 
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or
                WindowManager.LayoutParams.FLAG_SECURE or
                WindowManager.LayoutParams.FLAG_DIM_BEHIND,
                PixelFormat.TRANSLUCENT
            )
            params.dimAmount = 1.0f
            params.windowAnimations = android.R.style.Animation_InputMethod
            overlayView?.layoutParams = params
            // We do NOT addView yet. We add it in setWallVisibility to trigger the OS animation.
        } catch (e: Exception) {}
    }

    private fun getForegroundAppViaUsageStats(): String? {
        return try {
            val usm = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val time = System.currentTimeMillis()
            val usageEvents = usm.queryEvents(time - 5000, time)
            val event = UsageEvents.Event()
            var lastPkg: String? = null
            while (usageEvents.hasNextEvent()) {
                usageEvents.getNextEvent(event)
                if (event.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND) lastPkg = event.packageName
            }
            lastPkg
        } catch (e: Exception) { null }
    }

    private fun createFailsafeView(): View {
        val root = FrameLayout(this)
        root.setBackgroundColor(Color.BLACK)
        val tv = TextView(this)
        tv.text = "FOCUS_PROTOCOL_ENGAGED"; tv.setTextColor(Color.WHITE); tv.gravity = Gravity.CENTER
        root.addView(tv, FrameLayout.LayoutParams(-2, -2, Gravity.CENTER))
        val btn = Button(this); btn.text = "GO HOME"; btn.setOnClickListener { goHome() }
        val bP = FrameLayout.LayoutParams(-1, 200, Gravity.BOTTOM); bP.setMargins(50, 50, 50, 100)
        root.addView(btn, bP)
        return root
    }

    private fun tryForceYouTubeHomeNavigation() {
        val root = rootInActiveWindow ?: return
        val homeIds = listOf("com.google.android.youtube:id/pivot_bar_item_index_0", "com.google.android.youtube:id/pivot_bar_item_home")
        for (id in homeIds) {
            val nodes = root.findAccessibilityNodeInfosByViewId(id)
            if (!nodes.isNullOrEmpty()) {
                nodes[0].performAction(AccessibilityNodeInfo.ACTION_CLICK)
                return
            }
        }
    }

    private fun goHome() {
        try {
            isNavigatingHome = true
            val intent = Intent(Intent.ACTION_MAIN)
            intent.addCategory(Intent.CATEGORY_HOME)
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
            startActivity(intent)
            
            // TRANSITION_BUFFER: Wait for launcher animation before hiding wall (kills the flash)
            visibilityHandler.postDelayed({
                isNavigatingHome = false
                performDualLayerScan()
            }, 350L) // 350ms covers most Android launcher home animations
        } catch (e: Exception) {
            isNavigatingHome = false
        }
    }

    private fun createMappingOverlay() {
        if (windowManager == null) windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        val params = WindowManager.LayoutParams(
            -1, -1, WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        )
        mappingOverlay = FrameLayout(this)
        surgicalCanvas = SurgicalCanvasView(this).apply { setLayerType(View.LAYER_TYPE_HARDWARE, null) }
        mappingOverlay?.addView(surgicalCanvas, FrameLayout.LayoutParams(-1, -1))
        windowManager?.addView(mappingOverlay, params)
    }

    private fun renderPatches(patches: List<Pair<android.graphics.Rect, Boolean>>) {
        visibilityHandler.post {
            if (mappingOverlay == null) createMappingOverlay()
            if (patches.isNotEmpty()) {
                mappingOverlay?.visibility = View.VISIBLE
                surgicalCanvas?.updatePatches(patches)
            } else {
                mappingOverlay?.visibility = View.GONE
            }
        }
    }

    private inner class SurgicalCanvasView(context: Context) : View(context) {
        private val paint = android.graphics.Paint().apply { color = Color.BLACK; style = android.graphics.Paint.Style.FILL }
        private var activePatches = listOf<Pair<android.graphics.Rect, Boolean>>()
        fun updatePatches(newPatches: List<Pair<android.graphics.Rect, Boolean>>) { activePatches = newPatches; invalidate() }
        override fun onDraw(canvas: android.graphics.Canvas) {
            super.onDraw(canvas)
            val pkg = lastSurgicalPackage ?: ""
            if (pkg != "com.google.android.youtube" && pkg != "com.instagram.android") return
            val sw = resources.displayMetrics.widthPixels; val sh = resources.displayMetrics.heightPixels
            if (pkg == "com.google.android.youtube") canvas.drawRect((sw * 0.18).toFloat(), (sh - 160).toFloat(), (sw * 0.40).toFloat(), sh.toFloat(), paint)
            else if (pkg == "com.instagram.android") canvas.drawRect((sw * 0.42).toFloat(), (sh - 160).toFloat(), (sw * 0.58).toFloat(), sh.toFloat(), paint)
            activePatches.forEach { if (it.second) canvas.drawRect(it.first, paint) }
        }
    }

    private fun routeEliteEvent(event: AccessibilityEvent) {
        val pkg = event.packageName?.toString() ?: ""
        
        when (event.eventType) {
            AccessibilityEvent.TYPE_VIEW_CLICKED -> {
                val node = event.source
                val bounds = android.graphics.Rect(); node?.getBoundsInScreen(bounds)
                val sw = resources.displayMetrics.widthPixels; val sh = resources.displayMetrics.heightPixels
                val inZone = bounds.centerY() > (sh - 250) && bounds.centerX() < (sw * 0.6) && bounds.centerX() > (sw * 0.15)
                if (inZone && pkg == "com.google.android.youtube") {
                    showEliteBottomPopup("SHORTS"); breadcrumbDetectedShorts = true; return
                }
            }
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED, AccessibilityEvent.TYPE_WINDOWS_CHANGED, AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED -> {
                // PROACTIVE_ICON_TAP_SHIELD: If we are on home/launcher and something changes, trigger ultra-fast check
                if (isLauncherOrHomePackage(pkg)) {
                    // Start the sprint retry to catch the app inflation
                    handleUniversalBlockScan()
                }

                // SWITCHER_INTERCEPTION: Catch com.android.systemui and detect if Recents is visible
                if (pkg == "com.android.systemui") {
                    val root = rootInActiveWindow
                    if (root != null && isRecentsViewVisible(root)) {
                        handleUniversalBlockScan() // Force the shield up for the switcher UI
                        
                        // Strict Mode Enforcement: Kick them out of recents entirely
                        val isAnyAppBlocked = currentBlockedApps.isNotEmpty() || cachedSurgicalYoutube || cachedSurgicalInstagram
                        if (isAnyAppBlocked && !isBlockingSuspended) {
                            // Regain style: performGlobalAction(GLOBAL_ACTION_BACK) or HOME
                            // We skip global action for now to avoid locking the phone up, 
                            // but the overlay will be visible.
                        }
                    }
                }

                // Standard universal check
                handleUniversalBlockScan()
            }
        }
    }

    private fun isRecentsViewVisible(root: AccessibilityNodeInfo): Boolean {
        val markers = listOf("Recent apps", "OVERVIEW", "Recents")
        for (m in markers) {
            if (root.findAccessibilityNodeInfosByText(m).isNotEmpty()) return true
        }
        val ids = listOf("com.android.systemui:id/recent_apps", "com.android.systemui:id/recents_view")
        for (id in ids) {
            if (root.findAccessibilityNodeInfosByViewId(id).isNotEmpty()) return true
        }
        return false
    }

    private fun handleUniversalBlockScan() {
        var retries = 0
        val runnable = object : Runnable {
            override fun run() {
                performDualLayerScan()
                if (retries < 6) { 
                    retries++
                    // REGAIN_STYLE_SPRINT: First two retries are 40ms to beat the refresh rate
                    val delay = if (retries <= 2) 40L else 80L
                    visibilityHandler.postDelayed(this, delay)
                }
            }
        }
        visibilityHandler.post(runnable)
    }

    private fun showEliteBottomPopup(type: String) {
        visibilityHandler.post { Toast.makeText(this, "🛡️ $type BLOCKED BY UNLINK", Toast.LENGTH_LONG).show() }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL_ID, "Unlink Protection", NotificationManager.IMPORTANCE_LOW)
            (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(channel)
        }
    }

    private fun createNotification(): Notification {
        val pi = PendingIntent.getActivity(this, 0, packageManager.getLaunchIntentForPackage(packageName), PendingIntent.FLAG_IMMUTABLE)
        return NotificationCompat.Builder(this, CHANNEL_ID).setContentTitle("Unlink Working").setSmallIcon(android.R.drawable.ic_lock_lock).setContentIntent(pi).setOngoing(true).build()
    }

    private fun detectShortsDNA(node: AccessibilityNodeInfo): Boolean {
        val markers = listOf("like", "dislike", "comment", "share")
        var count = 0
        val nodes = mutableListOf(node); var i = 0
        while (i < nodes.size && count < 2) {
            val n = nodes[i++]; val d = n.contentDescription?.toString()?.lowercase() ?: ""
            if (markers.any { d.contains(it) }) count++
            for (j in 0 until n.childCount) n.getChild(j)?.let { nodes.add(it) }
        }
        return count >= 2
    }

    override fun onDestroy() {
        countdownHandler.removeCallbacks(countdownRunnable)
        try { unregisterReceiver(syncReceiver) } catch (e: Exception) {}
        super.onDestroy()
    }

    override fun onInterrupt() {}
    private fun dumpNodeForensics(node: AccessibilityNodeInfo, depth: Int) {}
}
