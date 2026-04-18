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
import android.graphics.Rect
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import android.view.Choreographer
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
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
    private var shortsOverlay: View? = null
    private var bottomBanner: View? = null
    private var isShortsFeedVisible = false
    private var lastBannerShowTime = 0L
    
    // HEURISTIC_MONITOR: Detects if heuristics are failing due to app updates
    private var sessionScanCount = 0
    private var sessionHitCount = 0
    private var lastDriftCheckTime = 0L
    private var lastPermissionAlertTime = 0L
    private var lastDebugToastTime = 0L
    
    private var lastSurgicalPackage: String? = null
    private var breadcrumbDetectedShorts = false
    private var lastBackActionTime = 0L
    private val BACK_ACTION_COOLDOWN = 100L
    private val visibilityHandler = Handler(Looper.getMainLooper())
    private var lastKnownShortsPatches = listOf<Pair<android.graphics.Rect, Boolean>>()
    
    // CORE_STATE: Blocked apps and active filters
    private var currentBlockedApps: Set<String> = emptySet()
    
    // CACHED_STATE: Fast access to session data
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
        val pkg = event.packageName?.toString() ?: return
        if (pkg == "com.android.systemui" || isLauncherOrHomePackage(pkg)) {
            hideShortsOverlay()
            return
        }        
        val isSurgicalMode = (pkg == "com.google.android.youtube" && cachedSurgicalYoutube) ||
                              (pkg == "com.instagram.android" && cachedSurgicalInstagram)

        // MODE_ISOLATION: Strictly separate Surgical Scanning from Normal App Blocking
        if (isSurgicalMode) {
            val root = rootInActiveWindow ?: return
            val matches = hybridDetector.findAllMatches(root, pkg)
            syncMultiOverlays(matches)
            // Normal blocking is skipped while surgical mode is active for this package
            return
        }

        // NORMAL_BLOCK_FALLBACK: If surgical is OFF, standard app blocking takes over
        if (isBlockActive(pkg)) {
            clearMultiOverlays()
            setWallVisibility(true, false)
            return
        }

        // CLEANUP: If neither, ensure all shields are down
        clearMultiOverlays()
        if (!isNavigatingHome) setWallVisibility(false, false)
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
            
            // PRE_PRODUCTION_INFLATION: Load overlays into memory for 0ms transition
            preInflateOverlays()
        } catch (e: Exception) {
            Log.e("UnlinkProduction", "FATAL: Service start failure", e)
        }
    }

    private fun preInflateOverlays() {
        visibilityHandler.post {
            try {
                val inflater = LayoutInflater.from(this)
                val shortsLayoutId = resources.getIdentifier("overlay_shorts_feed_block", "layout", packageName)
                if (shortsLayoutId != 0) {
                    shortsOverlay = inflater.inflate(shortsLayoutId, null).apply {
                        setOnClickListener { 
                            showEliteSurgicalBanner("Access Restricted")
                            performGlobalAction(GLOBAL_ACTION_BACK)
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e("UnlinkProduction", "Failed to pre-inflate overlays", e)
            }
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
                        AccessibilityEvent.TYPE_VIEW_CLICKED or
                        AccessibilityEvent.TYPE_VIEW_SCROLLED
        info.packageNames = targetPackages.toTypedArray()
        
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
        
        // SESSION_SAFEGUARD: If no expiry is set, we are not in an active session
        if (blockExpiryTime <= 0L) return false
        
        val currentTime = System.currentTimeMillis()
        if (currentTime >= blockExpiryTime) {
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
        isNavigatingHome = false 
        refreshServiceConfig() // RE-SYNC_FILTERS: Allow picking up new apps for sequential blocks
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

            if (!isSafeZone) {
                // 1. SURGICAL_PRIORITY: If surgical masking is enabled for this app, it takes precedence
                if (isSurgical) {
                    val detection = hybridDetector.detect(root, pkg)
                    if (detection.isDetected) {
                        val now = System.currentTimeMillis()
                        if (now - lastBackActionTime > BACK_ACTION_COOLDOWN) {
                            tryForceYouTubeHomeNavigation()
                            lastBackActionTime = now
                            breadcrumbDetectedShorts = false
                        }
                        setWallVisibility(false, false) 
                    } else {
                        setWallVisibility(false, true)
                    }
                    return
                }

                // 2. FULL_BLOCK_FALLBACK: If NOT surgical, then perform a standard full-app block
                if (isBlockActive(pkg)) {
                    setWallVisibility(true, false)
                    return
                }

                // Cleanup if neither
                if (!isNavigatingHome) {
                    setWallVisibility(false, false)
                }
            } else {
                // In Safe Zone (Home/Launcher/Our App)
                if (!isNavigatingHome) {
                    setWallVisibility(false, false)
                }
            }
        } ?: run {
            if (!isNavigatingHome) setWallVisibility(false, false)
        }
    }

    private val hybridDetector = HybridShortsDetector()

    data class DetectionResult(val isDetected: Boolean, val targetRect: android.graphics.Rect? = null, val confidence: Int = 0)
    data class MultiDetectionResult(val items: List<android.graphics.Rect>)

    private inner class HybridShortsDetector {

        fun findAllMatches(root: AccessibilityNodeInfo, pkg: String): List<android.graphics.Rect> {
            sessionScanCount++
            checkVersionDrift()

            val matches = mutableListOf<android.graphics.Rect>()

            // 1. ELITE_FAST_PASS: Check for known full-screen player containers
            if (pkg == "com.google.android.youtube") {
                val playerIds = listOf("com.google.android.youtube:id/reel_watch_fragment_root")
                for (id in playerIds) {
                    if (root.findAccessibilityNodeInfosByViewId(id).isNotEmpty()) {
                        sessionHitCount++
                        return listOf(android.graphics.Rect(0, 0, resources.displayMetrics.widthPixels, resources.displayMetrics.heightPixels))
                    }
                }
            }

            // 2. SURGICAL_SWEEP: Iterate entire tree for thumb-sized matches
            val potentialMatches = mutableListOf<android.graphics.Rect>()
            traverseTreeShallow(root) { node ->
                val score = scoreNode(node, pkg)
                if (score >= 2) {
                    val rect = android.graphics.Rect()
                    node.getBoundsInScreen(rect)
                    potentialMatches.add(rect)
                }
            }

            // 3. LEAF_NODE_FILTER: If a parent container matches, and its children match, drop the parent.
            val finalMatches = potentialMatches.filter { parentRect ->
                !potentialMatches.any { childRect ->
                    parentRect != childRect && parentRect.contains(childRect)
                }
            }

            // Ensure we don't return duplicate overlays for nested views with identical bounds
            matches.addAll(finalMatches.distinct())

            // LOUD VISUAL DEBUGGER FOR USER ASSURANCE
            val now = System.currentTimeMillis()
            if (now - lastDebugToastTime > 1500L) {
                lastDebugToastTime = now
                visibilityHandler.post {
                    android.widget.Toast.makeText(
                        this@UnlinkAccessibilityService, 
                        "🛡️ Engine Status: Found ${matches.size} Targets (Raw: ${potentialMatches.size})", 
                        android.widget.Toast.LENGTH_SHORT
                    ).show()
                }
            }

            if (matches.isNotEmpty()) sessionHitCount++
            return matches
        }

        fun detect(root: AccessibilityNodeInfo, pkg: String): DetectionResult {
            sessionScanCount++
            
            // 1. FAST_PASS: Full-screen Player IDs (High confidence)
            if (pkg == "com.google.android.youtube") {
                val playerIds = listOf("com.google.android.youtube:id/reel_watch_fragment_root", "com.google.android.youtube:id/shorts_container")
                for (id in playerIds) {
                    if (root.findAccessibilityNodeInfosByViewId(id).isNotEmpty()) {
                        sessionHitCount++
                        return DetectionResult(true, null, 100)
                    }
                }
            }

            // 2. HYBRID_PASS: Vote-based heuristic for Feed/Shelf items
            var bestTarget: android.graphics.Rect? = null
            var bestScore = 0

            traverseTreeShallow(root) { node ->
                val score = scoreNode(node, pkg)
                if (score >= 2) { // 2 out of 3 signals = block it
                    val rect = android.graphics.Rect()
                    node.getBoundsInScreen(rect)
                    if (score > bestScore) {
                        bestScore = score
                        bestTarget = rect
                    }
                }
            }
            
            if (bestScore >= 2) {
                sessionHitCount++
                checkVersionDrift()
            }

            return if (bestScore >= 2) DetectionResult(true, bestTarget, bestScore * 33) 
                   else DetectionResult(false)
        }

        private fun checkVersionDrift() {
            val now = System.currentTimeMillis()
            if (now - lastDriftCheckTime < 60000L) return // Check once per minute
            lastDriftCheckTime = now
            
            // LOG_DRIFT: If scanning heavily but hitting poorly (<30%), YouTube layout has likely drifted
            if (sessionScanCount > 100) {
                val hitRate = (sessionHitCount.toFloat() / sessionScanCount.toFloat()) * 100
                Log.d("UnlinkProduction", "Heuristic Health: $hitRate% (Scan: $sessionScanCount, Hit: $sessionHitCount)")
                
                if (hitRate < 30) {
                    Log.w("UnlinkProduction", "DRIFT_DETECTED: Heuristics are failing. YouTube update suspected.")
                    // TODO: Trigger UI Banner "Unlink needs a repair"
                }
            }
        }

        private fun scoreNode(node: AccessibilityNodeInfo, pkg: String): Int {
            val rect = android.graphics.Rect()
            node.getBoundsInScreen(rect)
            if (rect.width() <= 0 || rect.height() <= 0) return 0

            val screenWidth = resources.displayMetrics.widthPixels
            val screenHeight = resources.displayMetrics.heightPixels
            
            // CRITICAL FIX: Ensure box is smaller than the full screen to prevent giant overlays
            if (rect.width() > screenWidth * 0.9f || rect.height() > screenHeight * 0.85f) {
                return 0 
            }

            // GEOMETRIC_AGGRESSION: YouTube Shorts have a strictly distinct vertical aspect ratio.
            val ratio = rect.height().toFloat() / rect.width()
            val isCorrectRatio = ratio in 1.15f..3.0f 
            
            if (isCorrectRatio && rect.width() > screenWidth / 6) {
                // If it walks like a duck and quacks like a duck, it's a Short.
                // We bypass text checks entirely to prevent language/layout failures.
                return 2
            }

            return 0
        }

        private fun traverseTreeShallow(node: AccessibilityNodeInfo, depth: Int = 0, visitor: (AccessibilityNodeInfo) -> Unit) {
            // CRITICAL FIX: YouTube's layout is incredibly deep. A limit of 10 was pruning the tree 
            // BEFORE reaching the actual Shorts cards. Bumped to 25 to securely reach deep thumbnails.
            if (depth > 25) return 
            visitor(node)
            for (i in 0 until node.childCount) {
                node.getChild(i)?.let { traverseTreeShallow(it, depth + 1, visitor) }
            }
        }

        private fun hasHorizontalScrollAncestor(node: AccessibilityNodeInfo, maxDepth: Int): Boolean {
            var curr = node
            for (i in 0 until maxDepth) {
                val p = curr.parent ?: break
                if (p.isScrollable && (p.className?.contains("RecyclerView") == true || p.className?.contains("Horizontal") == true)) return true
                curr = p
            }
            return false
        }

        private fun subtreeContainsShortsText(node: AccessibilityNodeInfo, maxDepth: Int): Boolean {
            val textNodes = node.findAccessibilityNodeInfosByText("Shorts")
            if (!textNodes.isNullOrEmpty()) return true
            val reelsNodes = node.findAccessibilityNodeInfosByText("Reels")
            return !reelsNodes.isNullOrEmpty()
        }

        private fun checkParentForId(node: AccessibilityNodeInfo, keyword: String, maxDepth: Int): Boolean {
            var p = node.parent
            var d = 0
            while (p != null && d < maxDepth) {
                val id = p.viewIdResourceName ?: ""
                if (id.contains(keyword, ignoreCase = true)) return true
                p = p.parent; d++
            }
            return false
        }

        private fun isShelfHeaderNearby(node: AccessibilityNodeInfo, maxDepth: Int): Boolean {
            var p = node.parent
            var d = 0
            val screenHeight = resources.displayMetrics.heightPixels

            while (p != null && d < maxDepth) {
                val rect = android.graphics.Rect()
                p.getBoundsInScreen(rect)
                
                // STOP CONDITION: Never search the massive vertical feed container to avoid global matches
                if (p.className?.contains("RecyclerView") == true && rect.height() > screenHeight * 0.8f) {
                    break 
                }

                // Search the sub-container for headers
                for (i in 0 until p.childCount) {
                    val child = p.getChild(i) ?: continue
                    val text = child.text?.toString() ?: ""
                    val desc = child.contentDescription?.toString() ?: ""
                    if (text.contains("Shorts", true) || desc.contains("Shorts", true) ||
                        text.contains("Reels", true) || desc.contains("Reels", true)) {
                        return true
                    }
                }
                
                // Also check if the container itself natively contains the word (Safe within sub-containers)
                val nativeSearch = p.findAccessibilityNodeInfosByText("Shorts")
                if (!nativeSearch.isNullOrEmpty()) return true

                p = p.parent; d++
            }
            return false
        }
    }

    private val activeOverlays = mutableListOf<View>()
    private val overlayPool = mutableListOf<View>()

    private fun syncMultiOverlays(targets: List<android.graphics.Rect>) {
        visibilityHandler.post {
            val wm = windowManager ?: return@post
            
            // 1. Cleanup extra overlays if we have more than needed
            while (activeOverlays.size > targets.size) {
                val view = activeOverlays.removeAt(activeOverlays.size - 1)
                try { wm.removeView(view) } catch (e: Exception) {}
                overlayPool.add(view)
            }

            // 2. Update/Add overlays for all targets
            targets.forEachIndexed { index, rect ->
                val params = createOverlayParams(rect)
                
                if (index < activeOverlays.size) {
                    // REUSE: Update existing view
                    try { wm.updateViewLayout(activeOverlays[index], params) } catch (e: Exception) {}
                } else {
                    // SPAWN: Get from pool or create new
                    val view = if (overlayPool.isNotEmpty()) overlayPool.removeAt(0) else inflateOverlay()
                    if (view != null) {
                        try {
                            if (!android.provider.Settings.canDrawOverlays(this)) {
                                handlePermissionFailure()
                                return@post
                            }
                            wm.addView(view, params)
                            activeOverlays.add(view)
                        } catch (e: Exception) {
                            if (e is android.view.WindowManager.BadTokenException) handlePermissionFailure()
                        }
                    }
                }
            }
        }
    }

    private fun clearMultiOverlays() {
        visibilityHandler.post {
            val wm = windowManager ?: return@post
            activeOverlays.forEach { view ->
                try { wm.removeView(view) } catch (e: Exception) {}
                overlayPool.add(view)
            }
            activeOverlays.clear()
        }
    }

    private fun inflateOverlay(): View? {
        val shortsLayoutId = resources.getIdentifier("overlay_shorts_feed_block", "layout", packageName)
        if (shortsLayoutId == 0) return null
        return LayoutInflater.from(this).inflate(shortsLayoutId, null).apply {
            setOnClickListener { 
                showEliteSurgicalBanner("Access Restricted")
                performGlobalAction(GLOBAL_ACTION_BACK)
            }
        }
    }

    private fun createOverlayParams(targetRect: android.graphics.Rect?): WindowManager.LayoutParams {
        return WindowManager.LayoutParams().apply {
            type = WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY
            format = PixelFormat.TRANSLUCENT
            flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
            
            if (targetRect != null) {
                gravity = Gravity.TOP or Gravity.LEFT
                x = targetRect.left
                y = targetRect.top
                width = targetRect.width()
                height = targetRect.height()
            } else {
                width = WindowManager.LayoutParams.MATCH_PARENT
                height = WindowManager.LayoutParams.MATCH_PARENT
            }
            windowAnimations = android.R.style.Animation_Toast
        }
    }

    private fun showShortsOverlay(targetRect: android.graphics.Rect? = null) {
        if (isShortsFeedVisible && targetRect == null) return
        
        val overlay = shortsOverlay ?: return
        val wm = windowManager ?: return

        val params = WindowManager.LayoutParams().apply {
            type = WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY
            format = android.graphics.PixelFormat.TRANSLUCENT
            flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
            
            if (targetRect != null) {
                // Shelf Mode: Overlay scales to the detected row bounds
                gravity = Gravity.TOP or Gravity.LEFT
                x = targetRect.left
                y = targetRect.top
                width = targetRect.width()
                height = targetRect.height()
            } else {
                // Player Mode: Full screen masking
                width = WindowManager.LayoutParams.MATCH_PARENT
                height = WindowManager.LayoutParams.MATCH_PARENT
            }
            windowAnimations = android.R.style.Animation_Toast
        }

        try {
            if (!android.provider.Settings.canDrawOverlays(this)) {
                handlePermissionFailure()
                return
            }
            if (overlay.parent == null) {
                wm.addView(overlay, params)
                overlay.alpha = 0f
                overlay.animate().alpha(1f).setDuration(200).start()
                vibrate(20)
            } else {
                wm.updateViewLayout(overlay, params)
            }
            isShortsFeedVisible = true
        } catch (e: Exception) {
            if (e is android.view.WindowManager.BadTokenException) handlePermissionFailure()
        }
    }

    private fun handlePermissionFailure() {
        val now = System.currentTimeMillis()
        if (now - lastPermissionAlertTime < 30000L) return // Throttled to 30s
        lastPermissionAlertTime = now

        Log.e("UnlinkProduction", "CRITICAL_ERROR: Missing 'Display over other apps' permission.")
        
        visibilityHandler.post {
            android.widget.Toast.makeText(this, "Unlink: Overlay Permission Required to Block Shorts", android.widget.Toast.LENGTH_LONG).show()
        }

        try {
            // Attempt to bring the main Unlink app to the foreground
            val intent = packageManager.getLaunchIntentForPackage(packageName)
            intent?.apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                putExtra("FIX_PERMISSION", "OVERLAY")
                startActivity(this)
            }
        } catch (e: Exception) {}
    }

    private fun hideShortsOverlay() {
        if (!isShortsFeedVisible) return
        isShortsFeedVisible = false
        
        val overlay = shortsOverlay ?: return
        val wm = windowManager ?: return
        
        try {
            if (overlay.parent != null) {
                overlay.animate().alpha(0f).setDuration(150).withEndAction {
                    try { wm.removeView(overlay) } catch (e: Exception) {}
                }.start()
            }
        } catch (e: Exception) {}
    }

    private fun vibrate(duration: Long) {
        try {
            val v = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vm = getSystemService(VIBRATOR_MANAGER_SERVICE) as VibratorManager
                vm.defaultVibrator
            } else {
                @Suppress("DEPRECATION") getSystemService(VIBRATOR_SERVICE) as Vibrator
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                v.vibrate(VibrationEffect.createOneShot(duration, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION") v.vibrate(duration)
            }
        } catch (e: Exception) {}
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
                    val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                        val vm = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                        vm.defaultVibrator
                    } else {
                        @Suppress("DEPRECATION") getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
                    }
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        vibrator.vibrate(VibrationEffect.createOneShot(20, VibrationEffect.DEFAULT_AMPLITUDE))
                    } else {
                        @Suppress("DEPRECATION") vibrator.vibrate(20)
                    }
                } catch (e: Exception) {}

                updateWallContent()
                val params = view.layoutParams as WindowManager.LayoutParams
                params.dimAmount = 1.0f
                
                try {
                    if (!android.provider.Settings.canDrawOverlays(this)) {
                        handlePermissionFailure()
                        return@post
                    }
                    // HARDENED_ACCESS: Use try-catch to prevent BadTokenException on rapid switching
                    if (view.parent == null) windowManager?.addView(view, params)
                    countdownHandler.post(countdownRunnable)
                } catch (e: Exception) { 
                    if (e is android.view.WindowManager.BadTokenException) handlePermissionFailure()
                    Log.e("Unlink", "Failed to add absolute wall: ${e.message}") 
                }
            } else {
                try {
                    if (view.parent != null) windowManager?.removeView(view)
                    countdownHandler.removeCallbacks(countdownRunnable)
                } catch (e: Exception) { Log.e("Unlink", "Failed to remove absolute wall: ${e.message}") }
            }
        }
    }

    private fun updateOverlayTimer() {
        val currentTime = System.currentTimeMillis()
        val remaining = blockExpiryTime - currentTime
        if (remaining <= 0) {
            currentTimeRemaining = "00:00"
            if (blockExpiryTime > 0L) teardownAllBlocks()
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




    private fun isShortsRelatedClick(node: AccessibilityNodeInfo, event: AccessibilityEvent): Boolean {
        // 1. Text match (Shorts tab)
        if (event.text?.any { it.contains("Shorts", ignoreCase = true) } == true) return true
        
        // 2. ID match for common bottom pivot items
        val id = node.viewIdResourceName ?: ""
        if (id.contains("shorts") || id.contains("reel") || id.contains("pivot_bar_item_index_1")) return true
        
        // 3. Coordinate check (Failsafe for clicks on the bottom-center tab area)
        val sw = resources.displayMetrics.widthPixels; val sh = resources.displayMetrics.heightPixels
        val bounds = android.graphics.Rect()
        node.getBoundsInScreen(bounds)
        if (bounds.centerY() > sh - 200 && bounds.centerX() > sw * 0.15 && bounds.centerX() < sw * 0.45) return true
        
        return false
    }

    private fun isReelsRelatedClick(node: AccessibilityNodeInfo, event: AccessibilityEvent): Boolean {
        if (event.text?.any { it.contains("Reels", ignoreCase = true) } == true) return true
        val id = node.viewIdResourceName ?: ""
        return id.contains("clips") || id.contains("reels")
    }

    private var surgicalBanner: View? = null
    private fun showEliteSurgicalBanner(message: String) {
        visibilityHandler.post {
            if (surgicalBanner != null) return@post
            
            val myPackageName = packageName
            val inflater = getSystemService(Context.LAYOUT_INFLATER_SERVICE) as LayoutInflater
            
            // PRODUCTION_SPEC: Use the premium XML layout and ID mapping
            val bannerId = resources.getIdentifier("overlay_bottom_banner", "layout", myPackageName)
            if (bannerId == 0) return@post // Failsafe
            
            val bannerView = inflater.inflate(bannerId, null)
            val textId = resources.getIdentifier("banner_text", "id", myPackageName)
            if (textId != 0) {
                bannerView.findViewById<TextView>(textId)?.text = message
            }
            
            val params = WindowManager.LayoutParams(
                -1, -2, WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT
            ).apply {
                gravity = Gravity.BOTTOM
                windowAnimations = android.R.style.Animation_InputMethod
            }
            
            surgicalBanner = bannerView
            try {
                windowManager?.addView(surgicalBanner, params)
                visibilityHandler.postDelayed({ hideEliteSurgicalBanner() }, 2200)
                
                // HAPTIC_FEEDBACK: Regain-style tactile confirmation
                val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    val vibratorManager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                    vibratorManager.defaultVibrator
                } else {
                    @Suppress("DEPRECATION")
                    getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
                }

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createOneShot(50, VibrationEffect.DEFAULT_AMPLITUDE))
                } else {
                    @Suppress("DEPRECATION")
                    vibrator.vibrate(50)
                }
            } catch (e: Exception) { surgicalBanner = null }
        }
    }

    private fun hideEliteSurgicalBanner() {
        visibilityHandler.post {
            surgicalBanner?.let { 
                try { windowManager?.removeView(it) } catch (e: Exception) {}
                surgicalBanner = null
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

    override fun onDestroy() {
        countdownHandler.removeCallbacks(countdownRunnable)
        hideShortsOverlay()
        try { unregisterReceiver(syncReceiver) } catch (e: Exception) {}
        super.onDestroy()
    }

    override fun onInterrupt() {
        hideShortsOverlay()
    }
}
