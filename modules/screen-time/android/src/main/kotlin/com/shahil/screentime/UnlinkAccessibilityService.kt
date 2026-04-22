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
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.view.animation.AccelerateDecelerateInterpolator
import androidx.core.app.NotificationCompat
import kotlin.math.abs

class UnlinkAccessibilityService : AccessibilityService() {

    // DEVICE_TIER_ARCHITECTURE: Dynamic performance scaling for battery & low-end frames
    enum class DeviceTier { HIGH, MID, LOW }
    private var currentTier = DeviceTier.HIGH
    private var consecutiveSlowFrames = 0
    private var lastFrameTimeNanos = 0L
    
    companion object {
        @Volatile
        var instance: UnlinkAccessibilityService? = null
            private set
    }

    private val CHANNEL_ID = "unlink_protection_channel"
    private val NOTIFICATION_ID = 1001
    
    private var windowManager: WindowManager? = null
    private var overlayView: View? = null
    private var lastPermissionAlertTime = 0L
    private val visibilityHandler = Handler(Looper.getMainLooper())
    
    // INTENT_GATE_STATE
    enum class GateStatus { LOCKED, PENDING, AUTHORIZED }
    private var gateStatus = GateStatus.LOCKED
    private var authorizedApps = mutableSetOf<String>()
    private var lastAttemptedPackage: String? = null
    
    private var gateOverlayView: View? = null
    private var gateCountdown = 3
    private val gateHandler = Handler(Looper.getMainLooper())
    
    private var currentBlockedApps: Set<String> = emptySet()
    private var isSurgicalYoutube = false
    private var isSurgicalInstagram = false
    private var lastForegroundPackage: String? = null
    private var lastBrainrotScrollTime: Long = 0
    private var shortsScrollCount = 0
    private var isCurrentlyInShortsMode = false
    
    // Live Binge Architecture
    private var last_target_app_entry_time = 0L
    private var live_reels_in_this_binge = 0
    private var nudge45Shown = false
    private var brainrotOverlayView: View? = null
    private val brainrotHandler = Handler(Looper.getMainLooper())
    private val brainrotHideRunnable = Runnable { hideBrainrotMeter() }
    
    // GRANULAR_COACH_CONFIG
    private var isYtGateEnabled = true
    private var isYtShelfEnabled = true
    private var isIgGateEnabled = true
    private var isIgDmsEnabled = true
    
    // GLOBAL BRAINROT STATE
    private var globalBrainrotScore = 0f
    private var lastBrainrotDate = ""
    
    // CACHED_STATE: Fast access to session data
    private var cachedIsBlockingSuspended = false
    private var currentFocusMessage = "QUICK_BREATH"
    private var currentTimeRemaining = ""
    private var blockExpiryTime: Long = 0L
    private var blockRemainingAtSuspension: Long = 0L
    private var isNavigatingHome = false
    private var isBlockingSuspended = false
    
    // RE_AUTH_TIMER_PROTOCOL
    private var isYtFiniteEnabled = true
    private var isIgFiniteEnabled = true
    private var breaksRemaining = 0
    private var isProcessingBreak = false

    private val countdownHandler = Handler(Looper.getMainLooper())
    private val countdownRunnable = object : Runnable {
        override fun run() {
            updateOverlayTimer()
            countdownHandler.postDelayed(this, 1000)
        }
    }

    private val syncReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            when (intent?.action) {
                "com.shahil.unlink.SYNC_LIST" -> setSuspendedState(null)
                Intent.ACTION_SCREEN_OFF -> {
                    // INSTANT_RESET_ON_SCREEN_OFF: Premium behavior confirmation
                    authorizedApps.clear()
                    Log.d("UnlinkReAuth", "Screen off detected. Authorization reset.")
                }
            }
        }
    }

    fun setSuspendedState(suspended: Boolean?) {
        val prefs = getSharedPreferences("UnlinkBlockingPrefs", Context.MODE_PRIVATE)
        if (suspended == null) {
            refreshServiceConfig()
        } else {
            val wasSuspended = isBlockingSuspended
            isBlockingSuspended = suspended
            
            if (isBlockingSuspended && !wasSuspended) {
                // START_BREAK: Capture remaining time
                blockRemainingAtSuspension = java.lang.Math.max(0L, blockExpiryTime - System.currentTimeMillis())
                prefs.edit().putLong("block_remaining_ms", blockRemainingAtSuspension).commit()
                
                setWallVisibility(false)
                hideIntentGate()
                Log.d("UnlinkTimer", "Break Started. Session paused at $blockRemainingAtSuspension ms remaining")
            } else if (!isBlockingSuspended && wasSuspended) {
                // END_BREAK: Restore session with shifted expiry
                val savedRemaining = prefs.getLong("block_remaining_ms", 0L)
                if (savedRemaining > 0L) {
                    blockExpiryTime = System.currentTimeMillis() + savedRemaining
                    prefs.edit().putLong("block_expiry_time", blockExpiryTime).commit()
                    Log.d("UnlinkTimer", "Break Ended. Session resumed with new expiry: $blockExpiryTime")
                }
                
                // AGGRESSIVE_RE_ENGAGE: Use handleUniversalBlockScan for the 'fast way' feel
                handleUniversalBlockScan()
            }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY
    }

    private var lastEventTime = 0L

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        val eventType = event.eventType

        // RESPOND TO BROAD EVENTS TO CATCH GESTURE NAVIGATION
        if (eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED && 
            eventType != AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED &&
            eventType != AccessibilityEvent.TYPE_VIEW_SCROLLED) {
            return
        }

        // RESET SHORTS MODE ONLY IF WE TRULY EXITED THE SHORTS FEED UI
        if (eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            if (isCurrentlyInShortsMode) {
                try {
                    val root = rootInActiveWindow
                    if (root != null) {
                        val ytReels = root.findAccessibilityNodeInfosByViewId("com.google.android.youtube:id/reel_recycler")
                        val igReels = root.findAccessibilityNodeInfosByViewId("com.instagram.android:id/clips_video_container")
                        if (ytReels.isNullOrEmpty() && igReels.isNullOrEmpty() && !packageName.equals(root.packageName?.toString())) {
                            isCurrentlyInShortsMode = false
                            hideBrainrotMeter()
                            shortsScrollCount = 0
                        }
                    }
                } catch (e: Exception) {}
            }
        }

        // 1. INFALLIBLE FOREGROUND TRACKING
        // Always trust the active window root over the raw event for core blocking decisions.
        val pkg = rootInActiveWindow?.packageName?.toString() ?: event.packageName?.toString() ?: return

        // 2. IGNORE SELF TO PREVENT OVERLAY BLINKING
        if (pkg == packageName) return

        // 2.5 WARDEN_MODE: Prevent bypassing Unlink via Settings/Accessibility
        val now = System.currentTimeMillis()
        if (blockExpiryTime > now && !isBlockingSuspended) {
            if (pkg == "com.android.settings") {
                if (checkSelfProtection(rootInActiveWindow)) {
                    Toast.makeText(this, "Warden: Protocol Enforced. Settings locked. ❤️🩹", Toast.LENGTH_SHORT).show()
                    performGlobalAction(GLOBAL_ACTION_BACK)
                    return
                }
            }
        }

        // 3. FULL_BLOCK_PRIORITY (The 'Warden' Logic)
        // If the entire app is blocked, we stop here. No gates, no scroll tracking, no brain rot.
        if (isBlockActive(pkg)) {
            hideIntentGate()
            hideBrainrotMeter()
            setWallVisibility(true)
            lastForegroundPackage = pkg
            return
        }

        // 4. BRAINROT SCROLL DETECTION (Surgical Logic)
        if (eventType == AccessibilityEvent.TYPE_VIEW_SCROLLED && !isBlockingSuspended) {
            val isTargetShorts = pkg == "com.google.android.youtube" || pkg == "com.instagram.android"
            
            if (isTargetShorts) {
                val className = event.className?.toString() ?: ""
                val resourceName = event.source?.viewIdResourceName ?: ""
                
                // USER_SENSITIVITY_TUNING: Ignore DMs and messages specifically
                val isDM = resourceName.contains("direct", ignoreCase = true) || 
                           resourceName.contains("message", ignoreCase = true) ||
                           resourceName.contains("chat", ignoreCase = true) ||
                           resourceName.contains("thread", ignoreCase = true)

                if (isDM) {
                    Log.d("BrainrotGlobal", "Skipping brainrot update - user is in DM/Chat zone.")
                    return
                }

                if (resourceName.contains("reel", ignoreCase = true) || 
                    resourceName.contains("reels", ignoreCase = true) ||
                    resourceName.contains("short", ignoreCase = true) || 
                    resourceName.contains("clip", ignoreCase = true) ||
                    resourceName.contains("clips", ignoreCase = true) ||
                    className.contains("ViewPager") ||
                    className.contains("RecyclerView")) {
                    isCurrentlyInShortsMode = true
                }
                                   
                if (isCurrentlyInShortsMode) {
                    val now = System.currentTimeMillis()
                    if (now - lastBrainrotScrollTime > 2000L) {
                        lastBrainrotScrollTime = now
                        live_reels_in_this_binge++
                        
                        // THRESHOLD_PROTOCOL: Only start rotting after 5 scrolls/reels
                        if (live_reels_in_this_binge <= 5) {
                            Log.d("BrainrotGlobal", "Grace period: Scroll $live_reels_in_this_binge / 5")
                            return
                        }

                        val liveBingeMinutes = if (last_target_app_entry_time > 0L) {
                            (now - last_target_app_entry_time) / 60000L
                        } else {
                            0L
                        }
                        
                        val bingeMultiplier = if (liveBingeMinutes > 45) 1.8f else 1.0f
                        val rotDelta = 1.5f * bingeMultiplier
                        
                        updateGlobalRot(rotDelta, true)
                        showAndUpdateBrainrotMeter()
                        
                        if (liveBingeMinutes > 45 && !nudge45Shown) {
                            showBingeNudgeOverlay()
                            nudge45Shown = true
                        }
                    }
                }
            }
            return
        }

        val isTarget = pkg == "com.google.android.youtube" || pkg == "com.instagram.android"
        val wasInTarget = lastForegroundPackage == "com.google.android.youtube" || lastForegroundPackage == "com.instagram.android"

        // 5. EXIT_DETECTION: If we just left a target app
        if (wasInTarget && !isTarget) {
            val lastPkg = lastForegroundPackage!!
            val exitTime = System.currentTimeMillis()
            
            val prefs = getSharedPreferences("UnlinkBlockingPrefs", Context.MODE_PRIVATE)
            prefs.edit().putLong("exit_time_$lastPkg", exitTime).apply()
            Log.d("UnlinkReAuth", "Left $lastPkg at $exitTime. Exit recorded.")
            shortsScrollCount = 0
            isCurrentlyInShortsMode = false
        }

        // 6. ENTRY_DETECTION: If we just entered a target app from somewhere else
        if (isTarget && pkg != lastForegroundPackage) {
            val prefs = getSharedPreferences("UnlinkBlockingPrefs", Context.MODE_PRIVATE)
            val lastExit = prefs.getLong("exit_time_$pkg", 0L)
            val sessionStartTime = prefs.getLong("session_start_time", 0L)
            val outOfAppDuration = System.currentTimeMillis() - lastExit
            
            if (outOfAppDuration > 5 * 60 * 1000L || last_target_app_entry_time == 0L) {
                last_target_app_entry_time = System.currentTimeMillis()
                live_reels_in_this_binge = 0
                nudge45Shown = false
                Log.d("BrainrotGlobal", "Binge Reset! User was away for >5m.")
            }
            
            // RE_AUTH_TIMEOUT: 30 seconds OR User started a new session
            if (outOfAppDuration > 30000L || lastExit < sessionStartTime) {
                authorizedApps.remove(pkg)
                Log.d("UnlinkReAuth", "Entry into $pkg requires re-auth. (outOfApp: ${outOfAppDuration/1000}s, beforeSession: ${lastExit < sessionStartTime})")
            } else {
                Log.d("UnlinkReAuth", "Quick return to $pkg (${outOfAppDuration/1000}s). Session maintained.")
            }
        }

        if (isLauncherOrHomePackage(pkg)) {
            lastForegroundPackage = pkg
            setWallVisibility(false)
            shortsScrollCount = 0
            return
        }

        // 7. INTENT_GATE_LOGIC
        val isInstagram = pkg == "com.instagram.android"
        val isYoutube = pkg == "com.google.android.youtube"
        
        if ((isInstagram || isYoutube) && !isBlockingSuspended) {
            val surgicalEnabled = (isInstagram && isSurgicalInstagram) || (isYoutube && isSurgicalYoutube)
            
            if (surgicalEnabled) {
                val gateEnabled = if (isInstagram) isIgGateEnabled else isYtGateEnabled
                
                if (gateEnabled && !authorizedApps.contains(pkg)) {
                    showIntentGate(pkg) // Calm 3-sec gate
                    lastForegroundPackage = pkg
                    return
                } else {
                    setWallVisibility(false) // Authorized or Gate Off
                }
            } else if (isBlockActive(pkg)) {
                setWallVisibility(true) // Hard block enforced
                lastForegroundPackage = pkg
                return
            }
        }

        lastForegroundPackage = pkg
        if (!isNavigatingHome) setWallVisibility(false)
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        
        try {
            createNotificationChannel()
            startForeground(NOTIFICATION_ID, createNotification())
            
            val filter = IntentFilter()
            filter.addAction("com.shahil.unlink.SYNC_LIST")
            filter.addAction(Intent.ACTION_SCREEN_OFF)
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                registerReceiver(syncReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
            } else {
                registerReceiver(syncReceiver, filter)
            }

            refreshFromDiskInternal()
            refreshServiceConfig()
            
            detectDeviceTier()
        } catch (e: Exception) {
            Log.e("UnlinkProduction", "FATAL: Service start failure", e)
        }
    }

    private fun detectDeviceTier() {
        val activityManager = getSystemService(Context.ACTIVITY_SERVICE) as android.app.ActivityManager
        val memoryInfo = android.app.ActivityManager.MemoryInfo()
        activityManager.getMemoryInfo(memoryInfo)
        
        val totalRamGb = memoryInfo.totalMem / (1024 * 1024 * 1024)
        val cores = Runtime.getRuntime().availableProcessors()
        
        currentTier = when {
            totalRamGb >= 6 && cores >= 8 -> DeviceTier.HIGH
            totalRamGb >= 4 && cores >= 4 -> DeviceTier.MID
            else -> DeviceTier.LOW
        }
        Log.d("UnlinkPerformance", "Device Tier Detected: $currentTier (RAM: ${totalRamGb}GB, Cores: $cores)")
    }

    fun refreshServiceConfig() {
        try {
            refreshFromDiskInternal()
            
            val info = serviceInfo
            if (info == null) {
                Log.w("UnlinkAccessibility", "refreshServiceConfig: serviceInfo is null, skipping update")
                return
            }

            info.eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED or
                              AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED or
                              AccessibilityEvent.TYPE_VIEW_SCROLLED
            info.packageNames = null // GLOBAL TRACKING FOR EXIT DETECTION
            
            // DEFENSIVE_UPDATE: Some devices crash here if the service is in a transient state
            try {
                serviceInfo = info 
            } catch (e: Exception) {
                Log.e("UnlinkAccessibility", "Failed to apply serviceInfo: ${e.message}")
            }
            
            // Immediate check
            performSecurityCheck()
        } catch (e: Exception) {
            Log.e("UnlinkAccessibility", "Error in refreshServiceConfig: ${e.message}")
        }
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
            putBoolean("is_blocking_suspended", false)
            putLong("block_expiry_time", 0L)
            commit()
        }
        isNavigatingHome = false 
        refreshServiceConfig() 
        setWallVisibility(false)
    }

    private var globalShortsCount = 0

    private fun getCurrentDateString(): String {
        val sdf = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault())
        return sdf.format(java.util.Date())
    }

    private fun updateGlobalRot(delta: Float, isScroll: Boolean = false) {
        val prefs = getSharedPreferences("UnlinkBlockingPrefs", Context.MODE_PRIVATE)
        val today = getCurrentDateString()
        
        if (lastBrainrotDate != today) {
            globalBrainrotScore = 0f
            globalShortsCount = 0
            lastBrainrotDate = today
        }
        
        globalBrainrotScore += delta
        if (globalBrainrotScore < 0f) globalBrainrotScore = 0f
        if (globalBrainrotScore > 100f) globalBrainrotScore = 100f
        
        if (isScroll) {
            globalShortsCount++
        }
        
        prefs.edit().apply {
            putFloat("global_brainrot_score", globalBrainrotScore)
            putInt("global_shorts_count", globalShortsCount)
            putString("global_brainrot_date", lastBrainrotDate)
            apply()
        }
        
        Log.d("BrainrotGlobal", "Updated Brainrot by $delta. Current: $globalBrainrotScore%. Total Shorts: $globalShortsCount")
        
        // Dead Brain Check
        if (globalBrainrotScore >= 75f && isCurrentlyInShortsMode) {
            triggerDeadBrainLock()
        }
    }

    private fun checkSelfProtection(node: AccessibilityNodeInfo?): Boolean {
        if (node == null) return false
        
        val appName = getString(resources.getIdentifier("app_name", "string", packageName))
        
        // Scan for our app name in the window text
        val nodes = node.findAccessibilityNodeInfosByText(appName)
        if (nodes != null && nodes.isNotEmpty()) {
            return true
        }
        
        // Recursive check for children if findByText failed on root
        for (i in 0 until node.childCount) {
            if (checkSelfProtection(node.getChild(i))) return true
        }
        
        return false
    }

    // Nudge State
    private var bingeNudgeOverlayView: View? = null

    private fun showBingeNudgeOverlay() {
        visibilityHandler.post {
            try {
                if (bingeNudgeOverlayView != null && bingeNudgeOverlayView?.parent != null) return@post
                
                val inflater = getSystemService(Context.LAYOUT_INFLATER_SERVICE) as LayoutInflater
                val layoutId = resources.getIdentifier("overlay_binge_nudge", "layout", packageName)
                if (layoutId == 0) return@post
                
                bingeNudgeOverlayView = inflater.inflate(layoutId, null)
                val params = WindowManager.LayoutParams(
                    -1, -1, WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or 
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or 
                    WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                    PixelFormat.TRANSLUCENT
                )
                
                val takeBreakId = resources.getIdentifier("takeBreakButton", "id", packageName)
                val continueId = resources.getIdentifier("continueBingeButton", "id", packageName)
                
                bingeNudgeOverlayView?.findViewById<View>(takeBreakId)?.setOnClickListener {
                    try { if (bingeNudgeOverlayView?.parent != null) windowManager?.removeView(bingeNudgeOverlayView) } catch (e: Exception) {}
                    bingeNudgeOverlayView = null
                    goHome()
                    updateGlobalRot(-12.0f)
                    visibilityHandler.post {
                        Toast.makeText(applicationContext, "Break taken! Brain is healing ❤️\\u200D\\uD83E\\uDE79 +12%", Toast.LENGTH_SHORT).show()
                    }
                    last_target_app_entry_time = System.currentTimeMillis() // Reset binge clock
                }
                
                bingeNudgeOverlayView?.findViewById<View>(continueId)?.setOnClickListener {
                    try { if (bingeNudgeOverlayView?.parent != null) windowManager?.removeView(bingeNudgeOverlayView) } catch (e: Exception) {}
                    bingeNudgeOverlayView = null
                }
                
                windowManager?.addView(bingeNudgeOverlayView, params)
                vibrate(200)
            } catch (e: Exception) {
                Log.e("UnlinkBinge", "Failed to add nudge: \${e.message}")
            }
        }
    }

    private var deadBrainOverlayView: View? = null

    private fun triggerDeadBrainLock() {
        // Hide regular elements
        hideBrainrotMeter()
        hideIntentGate()
        
        visibilityHandler.post {
            try {
                if (deadBrainOverlayView != null && deadBrainOverlayView?.parent != null) return@post
                
                val inflater = getSystemService(Context.LAYOUT_INFLATER_SERVICE) as LayoutInflater
                val layoutId = resources.getIdentifier("overlay_dead_brain", "layout", packageName)
                if (layoutId == 0) return@post
                
                deadBrainOverlayView = inflater.inflate(layoutId, null)
                
                val mascotId = resources.getIdentifier("deadBrainMascot", "id", packageName)
                if (mascotId != 0) {
                    val mascotView = deadBrainOverlayView?.findViewById<ImageView>(mascotId)
                    mascotView?.setImageResource(getBrainrotDrawable(globalBrainrotScore))
                    animateMascot(mascotView)
                }
                
                val statusTextId = resources.getIdentifier("deadBrainWarningText", "id", packageName)
                if (statusTextId != 0) {
                    val formattedScore = String.format(java.util.Locale.US, "%.1f", globalBrainrotScore)
                    deadBrainOverlayView?.findViewById<TextView>(statusTextId)?.text = "Your brain is at $formattedScore% rot"
                }
                
                val btnId = resources.getIdentifier("goHomeFromDeadBrainButton", "id", packageName)
                deadBrainOverlayView?.findViewById<View>(btnId)?.setOnClickListener {
                    removeDeadBrainLock()
                    goHome()
                }

                val params = WindowManager.LayoutParams(
                    -1, -1, WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or 
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or 
                    WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or
                    WindowManager.LayoutParams.FLAG_SECURE,
                    PixelFormat.TRANSLUCENT
                )
                
                windowManager?.addView(deadBrainOverlayView, params)
                vibrate(100)
            } catch (e: Exception) {}
        }
    }

    private fun removeDeadBrainLock() {
        visibilityHandler.post {
            deadBrainOverlayView?.let { view ->
                try {
                    if (view.parent != null) windowManager?.removeView(view)
                } catch (e: Exception) {}
                deadBrainOverlayView = null
            }
        }
    }

    private fun refreshFromDiskInternal() {
        try {
            val prefs = getSharedPreferences("UnlinkBlockingPrefs", Context.MODE_PRIVATE)
            currentBlockedApps = prefs.getStringSet("blocked_apps", emptySet()) ?: emptySet()
            currentFocusMessage = prefs.getString("focus_message", "QUICK_BREATH") ?: "QUICK_BREATH"
            currentTimeRemaining = prefs.getString("time_remaining", "00:00") ?: "00:00"
            blockExpiryTime = prefs.getLong("block_expiry_time", 0L)
            blockRemainingAtSuspension = prefs.getLong("block_remaining_ms", 0L)
            cachedIsBlockingSuspended = prefs.getBoolean("is_blocking_suspended", false)
            isBlockingSuspended = prefs.getBoolean("is_blocking_suspended", false)
            
            isSurgicalYoutube = try { prefs.getBoolean("surgical_youtube", false) } catch (e: Exception) { false }
            isSurgicalInstagram = try { prefs.getBoolean("surgical_instagram", false) } catch (e: Exception) { false }
            
            // Load Granular Coach Config
            isYtGateEnabled = prefs.getBoolean("coach_yt_gate", true)
            isYtShelfEnabled = prefs.getBoolean("coach_yt_shelf", true)
            isYtFiniteEnabled = prefs.getBoolean("coach_yt_finite", true)
            isIgGateEnabled = prefs.getBoolean("coach_ig_gate", true)
            isIgDmsEnabled = prefs.getBoolean("coach_ig_dms", true)
            isIgFiniteEnabled = prefs.getBoolean("coach_ig_finite", true)
            
            // Brainrot Variables
            val today = getCurrentDateString()
            lastBrainrotDate = prefs.getString("global_brainrot_date", today) ?: today
            
            if (lastBrainrotDate != today) {
                globalBrainrotScore = 0f
                globalShortsCount = 0
                lastBrainrotDate = today
                prefs.edit()
                    .putFloat("global_brainrot_score", 0f)
                    .putInt("global_shorts_count", 0)
                    .putString("global_brainrot_date", today)
                    .apply()
            } else {
                globalBrainrotScore = prefs.getFloat("global_brainrot_score", 0f)
                globalShortsCount = prefs.getInt("global_shorts_count", 0)
            }
            
            breaksRemaining = try { prefs.getInt("breaks_remaining", 0) } catch (e: Exception) { 0 }
            
        } catch (e: Exception) {
            Log.e("UnlinkProduction", "RECOVERY_MODE: Sanitizing preference types after version mismatch", e)
        }
    }

    private fun performSecurityCheck() {
        val root = rootInActiveWindow
        var foregroundPkg = root?.packageName?.toString()

        if (foregroundPkg == null || foregroundPkg == "com.android.systemui") {
            foregroundPkg = getForegroundAppViaUsageStats()
        }

        foregroundPkg?.let { pkg ->
            val launcherPkg = getLauncherPackageName()
            val isSafeZone = pkg == launcherPkg || pkg == packageName

            if (isSafeZone) {
                if (!isNavigatingHome) setWallVisibility(false)
                return
            }

            // 1. Hard Block Check
            if (isBlockActive(pkg)) {
                setWallVisibility(true)
                return
            }

            // 2. Intent Gate Check
            val isTargetApp = pkg == "com.google.android.youtube" || pkg == "com.instagram.android"
            if (isTargetApp) {
                val isSurgical = if (pkg == "com.google.android.youtube") isSurgicalYoutube else isSurgicalInstagram
                if (isSurgical) {
                    if (!authorizedApps.contains(pkg)) {
                        showIntentGate(pkg)
                    } else {
                        setWallVisibility(false)
                    }
                    return
                }
            }

            if (!isNavigatingHome) setWallVisibility(false)
        }
    }

    private fun setWallVisibility(visible: Boolean) {
        visibilityHandler.post {
            if (overlayView == null) createAbsoluteWall()
            val view = overlayView ?: return@post
            
            if (visible == (view.parent != null)) return@post
            
            if (visible) {
                vibrate(20)
                updateWallContent()
                val params = view.layoutParams as WindowManager.LayoutParams
                params.dimAmount = 1.0f
                
                try {
                    if (!android.provider.Settings.canDrawOverlays(this)) {
                        handlePermissionFailure()
                        return@post
                    }
                    if (view.parent == null) windowManager?.addView(view, params)
                    countdownHandler.post(countdownRunnable)
                } catch (e: Exception) { 
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

    private fun getBrainrotDrawable(score: Float): Int {
        val myPackageName = getPackageName()
        val stageIndex = when {
            score >= 86f -> 7
            score >= 71f -> 6
            score >= 57f -> 5
            score >= 43f -> 4
            score >= 29f -> 3
            score >= 15f -> 2
            else -> 1
        }
        return resources.getIdentifier("stage_$stageIndex", "drawable", myPackageName)
    }

    private fun animateMascot(view: View?) {
        if (view == null) return
        val animator = ObjectAnimator.ofFloat(view, "translationY", -15f, 15f)
        animator.duration = 2500
        animator.repeatMode = ValueAnimator.REVERSE
        animator.repeatCount = ValueAnimator.INFINITE
        animator.interpolator = AccelerateDecelerateInterpolator()
        animator.start()
    }

    private fun updateWallContent() {
        try {
            val myPackageName = getPackageName()
            val rotEmojiId = resources.getIdentifier("rotEmoji", "id", myPackageName)
            val rotStatusId = resources.getIdentifier("rotStatusText", "id", myPackageName)
            val messageId = resources.getIdentifier("messageText", "id", myPackageName)
            val subTextId = resources.getIdentifier("coachSubText", "id", myPackageName)

            val overlay = overlayView ?: return

            // 1. BRAIN_ROT_VISUALS
            val drawableRes = getBrainrotDrawable(globalBrainrotScore)
            
            // Try both IDs as different layouts use different names
            val mascotId1 = resources.getIdentifier("rotMascot", "id", myPackageName)
            val mascotId2 = resources.getIdentifier("gateBrainMascot", "id", myPackageName)
            
            val mascotView = overlay.findViewById<ImageView>(if (mascotId1 != 0) mascotId1 else mascotId2)
            if (mascotView != null) {
                mascotView.setImageResource(drawableRes)
                animateMascot(mascotView)
            }
            
            val formattedScore = String.format(java.util.Locale.US, "%.0f", globalBrainrotScore)
            overlay.findViewById<TextView>(rotStatusId)?.text = "Your Brain is at $formattedScore% Rot"

            // 2. COACH_MESSAGES
            var mainMsg = "You chose to protect your focus today."
            var subMsg = "Your brain is already starting to feel clearer ❤️🩹"

            val pkg = rootInActiveWindow?.packageName?.toString() ?: ""
            val isIg = pkg == "com.instagram.android"
            val isYt = pkg == "com.google.android.youtube"
            val isSurgicalApp = (isIg && isSurgicalInstagram) || (isYt && isSurgicalYoutube)

            if (globalBrainrotScore >= 60f) {
                mainMsg = "You've been scrolling heavily today."
                subMsg = "This break is saving your brain from further damage."
            } else if (isCurrentlyInShortsMode && isSurgicalApp) {
                mainMsg = "Shorts & Reels are locked to protect you."
                subMsg = "DMs are still open if you need them."
            }

            overlay.findViewById<TextView>(messageId)?.text = mainMsg
            overlay.findViewById<TextView>(subTextId)?.text = subMsg

            // 3. BREAK_BUTTON_VISIBILITY
            val breakBtnId = resources.getIdentifier("takeBreakButton", "id", myPackageName)
            overlay.findViewById<Button>(breakBtnId)?.apply {
                visibility = if (breaksRemaining > 0) View.VISIBLE else View.GONE
            }

        } catch (e: Exception) {}
    }

    private fun createAbsoluteWall() {
        if (windowManager == null) windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        try {
            val myPackageName = getPackageName()
            val inflater = getSystemService(Context.LAYOUT_INFLATER_SERVICE) as LayoutInflater
            val layoutId = resources.getIdentifier("blocking_overlay_full", "layout", myPackageName)
            overlayView = if (layoutId != 0) inflater.inflate(layoutId, null) else createFailsafeView()
            
            // Primary Action: Go Home / Continue Focus
            val homeBtnId = resources.getIdentifier("goHomeButton", "id", myPackageName)
            overlayView?.findViewById<Button>(homeBtnId)?.setOnClickListener { goHome() }
            
            // Secondary Action: Take Break
            val breakBtnId = resources.getIdentifier("takeBreakButton", "id", myPackageName)
            overlayView?.findViewById<Button>(breakBtnId)?.setOnClickListener {
                requestBreak()
            }

            // Tertiary Action: Emergency Stop (Friction-based)
            val stopLinkId = resources.getIdentifier("emergencyStopLink", "id", myPackageName)
            overlayView?.findViewById<TextView>(stopLinkId)?.setOnClickListener {
                Toast.makeText(this, "Protocol is strict. End session via Unlink App.", Toast.LENGTH_SHORT).show()
                vibrate(100)
            }

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
        } catch (e: Exception) {}
    }

    private fun requestBreak() {
        if (isProcessingBreak || breaksRemaining <= 0) return
        
        try {
            // TIMER_PAUSE: Capture remaining time immediately
            blockRemainingAtSuspension = java.lang.Math.max(0L, blockExpiryTime - System.currentTimeMillis())
            val prefs = getSharedPreferences("UnlinkBlockingPrefs", Context.MODE_PRIVATE)
            prefs.edit().run {
                putBoolean("is_blocking_suspended", true)
                putLong("block_remaining_ms", blockRemainingAtSuspension)
                commit()
            }
            
            setWallVisibility(false)
            isBlockingSuspended = true
            
            // Notify UI & System
            val intent = Intent("com.shahil.unlink.REQUEST_BREAK")
            intent.setPackage(packageName)
            sendBroadcast(intent)
            
            Toast.makeText(this, "Break started. Use it wisely! ❤️\u200D\uD83E\uDE79", Toast.LENGTH_SHORT).show()
            // Removed automatic Unlink launch to keep user in their current app (YouTube/Insta) during break
            // openUnlinkApp()
            
            // Unlock guard after a delay to ensure JS has processed the sync
            visibilityHandler.postDelayed({ isProcessingBreak = false }, 2000L)
        } catch (e: Exception) {
            isProcessingBreak = false
        }
    }

    private fun openUnlinkApp() {
        try {
            val intent = packageManager.getLaunchIntentForPackage(packageName)
            if (intent != null) {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                startActivity(intent)
            }
        } catch (e: Exception) {}
    }

    private fun goHome() {
        try {
            isNavigatingHome = true
            val intent = Intent(Intent.ACTION_MAIN)
            intent.addCategory(Intent.CATEGORY_HOME)
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
            startActivity(intent)
            
            visibilityHandler.postDelayed({
                isNavigatingHome = false
                performSecurityCheck()
            }, 350L) 
        } catch (e: Exception) {
            isNavigatingHome = false
        }
    }

    private fun updateOverlayTimer() {
        val currentTime = System.currentTimeMillis()
        
        // TIMER_PAUSE_LOGIC: If suspended, use the captured remaining time
        val remaining = if (isBlockingSuspended) {
            blockRemainingAtSuspension
        } else {
            blockExpiryTime - currentTime
        }

        if (remaining <= 0 && !isBlockingSuspended) {
            currentTimeRemaining = "00:00"
            if (blockExpiryTime > 0L) teardownAllBlocks()
            return
        }
        
        val totalSeconds = java.lang.Math.max(0L, remaining / 1000)
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

    private fun handlePermissionFailure() {
        val now = System.currentTimeMillis()
        if (now - lastPermissionAlertTime < 30000L) return 
        lastPermissionAlertTime = now
        visibilityHandler.post {
            Toast.makeText(this, "Unlink: Overlay Permission Required", Toast.LENGTH_LONG).show()
        }
        try {
            val intent = packageManager.getLaunchIntentForPackage(packageName)
            intent?.apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                putExtra("FIX_PERMISSION", "OVERLAY")
                startActivity(this)
            }
        } catch (e: Exception) {}
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

    private fun handleUniversalBlockScan() {
        var retries = 0
        val runnable = object : Runnable {
            override fun run() {
                performSecurityCheck()
                if (retries < 6) { 
                    retries++
                    val delay = if (retries <= 2) 40L else 80L
                    visibilityHandler.postDelayed(this, delay)
                }
            }
        }
        visibilityHandler.post(runnable)
    }

    override fun onDestroy() {
        countdownHandler.removeCallbacks(countdownRunnable)
        try { unregisterReceiver(syncReceiver) } catch (e: Exception) {}
        super.onDestroy()
    }

    override fun onInterrupt() {}

    private var isGateInflationPending = false

    private fun showIntentGate(pkg: String) {
        if (gateOverlayView != null || isGateInflationPending) return
        isGateInflationPending = true
        
        visibilityHandler.post {
            try {
                if (gateOverlayView != null) return@post
                
                val myPackageName = packageName
                val inflater = getSystemService(Context.LAYOUT_INFLATER_SERVICE) as LayoutInflater
                val layoutId = resources.getIdentifier("overlay_intent_gate", "layout", myPackageName)
                if (layoutId == 0) return@post
                
                gateOverlayView = inflater.inflate(layoutId, null)
                val params = WindowManager.LayoutParams(
                    -1, -1, WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or 
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or 
                    WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                    PixelFormat.TRANSLUCENT
                )
                
                // Set App Name in Question
                val appName = when(pkg) {
                    "com.google.android.youtube" -> "YouTube"
                    "com.instagram.android" -> "Instagram"
                    else -> "this app"
                }
                val questionId = resources.getIdentifier("intentQuestion", "id", myPackageName)
                if (questionId != 0) {
                    gateOverlayView?.findViewById<TextView>(questionId)?.text = "Why are you opening\n$appName today?"
                }

                // Emotional Hooks & Motivation
                val brainStatusId = resources.getIdentifier("brainStatusText", "id", myPackageName)
                if (brainStatusId != 0) {
                    val formattedScore = String.format(java.util.Locale.US, "%.1f", globalBrainrotScore)
                    val emoji = when {
                        globalBrainrotScore > 75f -> "🧟"
                        globalBrainrotScore > 50f -> "🤢"
                        globalBrainrotScore > 20f -> "🤔"
                        else -> "🧠"
                    }
                    val statusText = when {
                        globalBrainrotScore > 80f -> "CRITICAL ROT"
                        globalBrainrotScore > 60f -> "HEAVY ROT"
                        globalBrainrotScore > 40f -> "STARTING TO ROT"
                        globalBrainrotScore > 20f -> "MILD FOG"
                        else -> "FRESH BRAIN"
                    }
                    gateOverlayView?.findViewById<TextView>(brainStatusId)?.text = "$emoji $formattedScore% $statusText"
                }

                // Interaction Logic - 4 Commitment Options
                val dmBtnId = resources.getIdentifier("dmOnlyButton", "id", myPackageName)
                val longVidBtnId = resources.getIdentifier("longVideosButton", "id", myPackageName)
                val reelsLimitBtnId = resources.getIdentifier("reelsLimitButton", "id", myPackageName)
                val focusBtnId = resources.getIdentifier("fullFocusButton", "id", myPackageName)
                val cancelId = resources.getIdentifier("cancelButton", "id", myPackageName)

                gateOverlayView?.findViewById<View>(dmBtnId)?.setOnClickListener { authorizeSession(pkg, -15.0f, "DMs only = brain saved 😎 +15%") }
                gateOverlayView?.findViewById<View>(longVidBtnId)?.setOnClickListener { authorizeSession(pkg, -6.0f, "Long videos only! +6%") }
                gateOverlayView?.findViewById<View>(reelsLimitBtnId)?.setOnClickListener { authorizeSession(pkg, -8.0f, "Respecting your limits! +8%") }
                gateOverlayView?.findViewById<View>(focusBtnId)?.setOnClickListener { authorizeSession(pkg, -25.0f, "Focus Session started! +25%") }
                gateOverlayView?.findViewById<View>(cancelId)?.setOnClickListener { 
                    hideIntentGate()
                    goHome()
                    updateGlobalRot(-10.0f) // Reward for backing out completely
                    visibilityHandler.post {
                        Toast.makeText(applicationContext, "Brain Saved ❤️\u200D\uD83E\uDE79 +10.0%", Toast.LENGTH_SHORT).show()
                    }
                }

                windowManager?.addView(gateOverlayView, params)
                startGateCountdown()
            } catch (e: Exception) {
                Log.e("UnlinkGate", "Failed to show gate: ${e.message}")
            } finally {
                isGateInflationPending = false
            }
        }
    }

    private fun startGateCountdown() {
        gateCountdown = 3
        val timerTextId = resources.getIdentifier("calmTimerText", "id", packageName)
        val calmContainerId = resources.getIdentifier("calmContainer", "id", packageName)
        val actionContainerId = resources.getIdentifier("actionContainer", "id", packageName)

        val runnable = object : Runnable {
            override fun run() {
                if (gateCountdown > 0) {
                    gateOverlayView?.findViewById<TextView>(timerTextId)?.text = gateCountdown.toString()
                    gateCountdown--
                    gateHandler.postDelayed(this, 1000)
                } else {
                    // Reveal Actions
                    gateOverlayView?.findViewById<View>(calmContainerId)?.visibility = View.GONE
                    gateOverlayView?.findViewById<View>(actionContainerId)?.apply {
                        visibility = View.VISIBLE
                        alpha = 0f
                        animate().alpha(1f).setDuration(400).start()
                    }
                }
            }
        }
        gateHandler.post(runnable)
    }

    private fun authorizeSession(pkg: String, healingDelta: Float = 0f, message: String = "") {
        if (healingDelta < 0f) {
            updateGlobalRot(healingDelta)
            val msg = if (message.isNotEmpty()) message else "Brain Healing ❤️\\u200D\\uD83E\\uDE79 ${-healingDelta}%"
            visibilityHandler.post {
                Toast.makeText(applicationContext, msg, Toast.LENGTH_SHORT).show()
            }
        }
        authorizedApps.add(pkg)
        gateStatus = GateStatus.AUTHORIZED
        hideIntentGate()
        vibrate(50)
    }

    private fun hideIntentGate() {
        gateHandler.removeCallbacksAndMessages(null)
        gateOverlayView?.let {
            try {
                if (it.parent != null) windowManager?.removeView(it)
            } catch (e: Exception) {}
            gateOverlayView = null
        }
    }

    private fun showAndUpdateBrainrotMeter() {
        visibilityHandler.post {
            try {
                if (brainrotOverlayView == null) {
                    val inflater = getSystemService(Context.LAYOUT_INFLATER_SERVICE) as LayoutInflater
                    val layoutId = resources.getIdentifier("overlay_brainrot_meter", "layout", packageName)
                    if (layoutId == 0) return@post
                    
                    brainrotOverlayView = inflater.inflate(layoutId, null)
                    
                    val params = WindowManager.LayoutParams(
                        WindowManager.LayoutParams.WRAP_CONTENT,
                        WindowManager.LayoutParams.WRAP_CONTENT,
                        WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or 
                        WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                        WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                        PixelFormat.TRANSLUCENT
                    )
                    params.gravity = Gravity.TOP or Gravity.END
                    params.y = 150 // Slight top margin
                    params.x = 40 // Slight right margin
                    
                    windowManager?.addView(brainrotOverlayView, params)
                }

                val containerId = resources.getIdentifier("brainrotContainer", "id", packageName)
                val mascotId = resources.getIdentifier("brainrotMascot", "id", packageName)
                val countId = resources.getIdentifier("brainrotCount", "id", packageName)
                
                val view = brainrotOverlayView ?: return@post
                val container = view.findViewById<View>(containerId)
                val mascotIv = view.findViewById<ImageView>(mascotId)
                val countTv = view.findViewById<TextView>(countId)
                
                countTv?.text = String.format(java.util.Locale.US, "%.0f%%", globalBrainrotScore)
                mascotIv?.setImageResource(getBrainrotDrawable(globalBrainrotScore))
                animateMascot(mascotIv)
                
                when {
                    globalBrainrotScore > 80f -> {
                        val bgDrawable = container?.background as? android.graphics.drawable.GradientDrawable
                        bgDrawable?.setColor(Color.parseColor("#CCAA0000")) // Severe Red
                    }
                    globalBrainrotScore > 60f -> {
                        val bgDrawable = container?.background as? android.graphics.drawable.GradientDrawable
                        bgDrawable?.setColor(Color.parseColor("#CCAA3300")) // Hot Orange
                    }
                    globalBrainrotScore > 40f -> {
                        val bgDrawable = container?.background as? android.graphics.drawable.GradientDrawable
                        bgDrawable?.setColor(Color.parseColor("#CCAA7700")) // Medium Yellow
                    }
                    globalBrainrotScore > 20f -> {
                        val bgDrawable = container?.background as? android.graphics.drawable.GradientDrawable
                        bgDrawable?.setColor(Color.parseColor("#CC55AA00")) // Light Green
                    }
                    else -> {
                        val bgDrawable = container?.background as? android.graphics.drawable.GradientDrawable
                        bgDrawable?.setColor(Color.parseColor("#99000000")) // Healthy Dark
                    }
                }
                
                // Show with animation if it was hidden
                if (view.alpha == 0f) {
                    view.animate().alpha(1f).setDuration(300).start()
                } else {
                    // Small pulse effect on scroll
                    view.animate().scaleX(1.1f).scaleY(1.1f).setDuration(100).withEndAction {
                        view.animate().scaleX(1f).scaleY(1f).setDuration(100).start()
                    }.start()
                }

                // Auto-hide after 4 seconds of inactivity
                brainrotHandler.removeCallbacks(brainrotHideRunnable)
                brainrotHandler.postDelayed(brainrotHideRunnable, 4000)
                
            } catch (e: Exception) {
                Log.e("Brainrot", "Failed to show meter: ${e.message}")
            }
        }
    }

    private fun hideBrainrotMeter() {
        visibilityHandler.post {
            brainrotOverlayView?.let { view ->
                view.animate().alpha(0f).setDuration(300).withEndAction {
                    try {
                        if (view.parent != null) windowManager?.removeView(view)
                    } catch (e: Exception) {}
                    brainrotOverlayView = null
                }.start()
            }
        }
    }
}
