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

class UnlinkAccessibilityService : AccessibilityService() {

    enum class DeviceTier { HIGH, MID, LOW }
    private var currentTier = DeviceTier.HIGH
    
    companion object {
        @Volatile
        var instance: UnlinkAccessibilityService? = null
            private set
    }

    private val CHANNEL_ID = "unlink_protection_channel"
    private val NOTIFICATION_ID = 1001
    
    private var globalBrainrotScore: Float = 0f
    private var globalShortsCount: Int = 0
    private var lastBrainrotDate: String = ""
    private var isSurgicalYoutube = false
    private var isSurgicalInstagram = false
    private var isYtGateEnabled = true
    private var isYtShelfEnabled = true
    private var isYtFiniteEnabled = true
    private var isIgGateEnabled = true
    private var isIgDmsEnabled = true
    private var isIgFiniteEnabled = true
    
    private var windowManager: WindowManager? = null
    private var overlayView: View? = null
    private var lastPermissionAlertTime = 0L
    private val visibilityHandler = Handler(Looper.getMainLooper())
    
    enum class GateStatus { LOCKED, PENDING, AUTHORIZED }
    private var gateStatus = GateStatus.LOCKED
    private var authorizedApps = mutableSetOf<String>()
    private var lastAttemptedPackage: String? = null
    
    private var gateOverlayView: View? = null
    private var gateCountdown = 3
    private val gateHandler = Handler(Looper.getMainLooper())
    
    private var currentBlockedApps: Set<String> = emptySet()
    private var lastForegroundPackage: String? = null
    private var lastBrainrotScrollTime: Long = 0
    private var shortsScrollCount = 0
    private var isCurrentlyInShortsMode = false
    
    private var last_target_app_entry_time = 0L
    private var live_reels_in_this_binge = 0
    private var nudge45Shown = false
    private var brainrotOverlayView: View? = null
    private var isHealing = false
    private var isShortsLocked = false
    private val SHORTS_LOCK_THRESHOLD = 85f
    private val SHORTS_UNLOCK_THRESHOLD = 30f
    private var currentReelStartTime: Long = 0
    private var watchTimeHandler = Handler(Looper.getMainLooper())
    private val brainrotHandler = Handler(Looper.getMainLooper())
    private val brainrotHideRunnable = Runnable { hideBrainrotMeter() }
    
    private val watchTimeRunnable = object : Runnable {
        override fun run() {
            val now = System.currentTimeMillis()
            val watchTime = now - currentReelStartTime
            
            if (blockExpiryTime <= now || isBlockingSuspended) {
                isCurrentlyInShortsMode = false
                hideBrainrotMeter()
                return
            }
            
            // Passive watch score increase removed per user request
            
            if (now - lastBrainrotScrollTime > 45000L) { // INCREASED TO 45S
                isHealing = true
                updateGlobalRot(-0.05f, false) 
                showAndUpdateBrainrotMeter()
            } else {
                isHealing = false
            }
            
            if (watchTime % 5000L < 1000L) {
                verifyShortsStateSurgical()
            }
            
            watchTimeHandler.postDelayed(this, 1000L)
        }
    }
    
    private var currentTimeRemaining = ""
    private var blockExpiryTime: Long = 0L
    private var blockRemainingAtSuspension: Long = 0L
    private var isNavigatingHome = false
    private var isBlockingSuspended = false
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
                blockRemainingAtSuspension = Math.max(0L, blockExpiryTime - System.currentTimeMillis())
                prefs.edit().putLong("block_remaining_ms", blockRemainingAtSuspension).commit()
                setWallVisibility(false)
                hideIntentGate()
            } else if (!isBlockingSuspended && wasSuspended) {
                val savedRemaining = prefs.getLong("block_remaining_ms", 0L)
                if (savedRemaining > 0L) {
                    blockExpiryTime = System.currentTimeMillis() + savedRemaining
                    prefs.edit().putLong("block_expiry_time", blockExpiryTime).commit()
                }
                handleUniversalBlockScan()
            }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        val now = System.currentTimeMillis()
        val eventType = event.eventType

        if (blockExpiryTime <= now) {
            if (isCurrentlyInShortsMode || brainrotOverlayView != null) {
                isCurrentlyInShortsMode = false
                hideBrainrotMeter()
                hideIntentGate()
                watchTimeHandler.removeCallbacks(watchTimeRunnable)
            }
            return
        }

        if (eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED && 
            eventType != AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED &&
            eventType != AccessibilityEvent.TYPE_VIEW_SCROLLED) {
            return
        }

        if (eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED || 
            eventType == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED) {
            verifyShortsStateSurgical()
        }

        val pkg = rootInActiveWindow?.packageName?.toString() ?: event.packageName?.toString() ?: return
        if (pkg == packageName) return

        if (blockExpiryTime > now && !isBlockingSuspended) {
            val isSettings = pkg == "com.android.settings"
            val isPackageInstaller = pkg.contains("packageinstaller", ignoreCase = true)
            if ((isSettings || isPackageInstaller) && checkSelfProtection(rootInActiveWindow)) {
                Toast.makeText(this, "Warden: Protocol Enforced. Settings locked. ❤️🩹", Toast.LENGTH_SHORT).show()
                performGlobalAction(GLOBAL_ACTION_BACK)
                return
            }
        }

        if (isBlockActive(pkg)) {
            hideIntentGate()
            hideBrainrotMeter()
            setWallVisibility(true)
            lastForegroundPackage = pkg
            return
        }

        if ((pkg == "com.google.android.youtube" || pkg == "com.instagram.android") && !isBlockingSuspended) {
            val surgicalEnabled = if (pkg == "com.google.android.youtube") isSurgicalYoutube else isSurgicalInstagram
            if (surgicalEnabled) {
                if (eventType == AccessibilityEvent.TYPE_VIEW_SCROLLED || eventType == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED) {
                    val resourceName = event.source?.viewIdResourceName ?: ""
                    val className = event.className?.toString() ?: ""
                    
                    val isDM = resourceName.contains("direct", ignoreCase = true) || 
                               resourceName.contains("message", ignoreCase = true) ||
                               resourceName.contains("chat", ignoreCase = true) ||
                               resourceName.contains("thread", ignoreCase = true)

                    if (!isDM) {
                        val isSurgicalEngagement = resourceName.contains("reel", ignoreCase = true) || 
                                                   resourceName.contains("reels", ignoreCase = true) ||
                                                   resourceName.contains("short", ignoreCase = true) || 
                                                   resourceName.contains("clip", ignoreCase = true) ||
                                                   resourceName.contains("clips", ignoreCase = true)

                        if (isSurgicalEngagement) {
                            val scrollInterval = now - lastBrainrotScrollTime
                            if (scrollInterval > 150L) { 
                                if (!isCurrentlyInShortsMode) {
                                    isCurrentlyInShortsMode = true
                                    isHealing = false
                                    watchTimeHandler.post(watchTimeRunnable)
                                }
                                lastBrainrotScrollTime = now
                                currentReelStartTime = now 
                                updateLastScrollTimestampPersistent(now)
                                live_reels_in_this_binge++
                                
                                val rotDelta = 0.5f // CONSISTENT 0.5% PER SCROLL
                                val liveBingeMinutes = if (last_target_app_entry_time > 0L) (now - last_target_app_entry_time) / 60000L else 0L
                                val bingeMultiplier = if (liveBingeMinutes > 45) 1.8f else 1.0f
                                updateGlobalRot(rotDelta * bingeMultiplier, true)
                                showAndUpdateBrainrotMeter()
                                
                                if (liveBingeMinutes > 45 && !nudge45Shown) {
                                    showBingeNudgeOverlay()
                                    nudge45Shown = true
                                }
                            }
                        }
                    }
                }
            }
        }

        val isTarget = pkg == "com.google.android.youtube" || pkg == "com.instagram.android"
        val wasInTarget = lastForegroundPackage == "com.google.android.youtube" || lastForegroundPackage == "com.instagram.android"

        if (wasInTarget && !isTarget) {
            val lastPkg = lastForegroundPackage!!
            getSharedPreferences("UnlinkBlockingPrefs", Context.MODE_PRIVATE).edit().putLong("exit_time_$lastPkg", System.currentTimeMillis()).apply()
            shortsScrollCount = 0
            isCurrentlyInShortsMode = false
        }

        if (isTarget && pkg != lastForegroundPackage) {
            val prefs = getSharedPreferences("UnlinkBlockingPrefs", Context.MODE_PRIVATE)
            val lastExit = prefs.getLong("exit_time_$pkg", 0L)
            val sessionStartTime = prefs.getLong("session_start_time", 0L)
            val outOfAppDuration = System.currentTimeMillis() - lastExit
            if (outOfAppDuration > 5 * 60 * 1000L || last_target_app_entry_time == 0L) {
                last_target_app_entry_time = System.currentTimeMillis()
                live_reels_in_this_binge = 0
                nudge45Shown = false
            }
            if (outOfAppDuration > 30000L || lastExit < sessionStartTime) {
                authorizedApps.remove(pkg)
            }
        }

        if (isLauncherOrHomePackage(pkg)) {
            lastForegroundPackage = pkg
            setWallVisibility(false)
            hideBrainrotMeter() // HIDE METER ON OS HOME
            shortsScrollCount = 0
            return
        }

        if (isTarget && !isBlockingSuspended) {
            val surgicalEnabled = if (pkg == "com.instagram.android") isSurgicalInstagram else isSurgicalYoutube
            if (surgicalEnabled) {
                val gateEnabled = if (pkg == "com.instagram.android") isIgGateEnabled else isYtGateEnabled
                if (gateEnabled && !authorizedApps.contains(pkg)) {
                    showIntentGate(pkg)
                    lastForegroundPackage = pkg
                    return
                } else {
                    setWallVisibility(false)
                }
            } else if (isBlockActive(pkg)) {
                setWallVisibility(true)
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
            resetBrainrotState()
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
        } catch (e: Exception) {}
    }

    fun refreshServiceConfig() {
        try {
            refreshFromDiskInternal()
            serviceInfo?.apply {
                eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED or
                             AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED or
                             AccessibilityEvent.TYPE_VIEW_SCROLLED
                packageNames = null
                serviceInfo = this
            }
            performSecurityCheck()
        } catch (e: Exception) {}
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
        if (isBlockingSuspended || blockExpiryTime <= 0L) return false
        if (System.currentTimeMillis() >= blockExpiryTime) return false
        return currentBlockedApps.any { blocked -> pkg.contains(blocked, ignoreCase = true) }
    }

    private fun teardownAllBlocks() {
        getSharedPreferences("UnlinkBlockingPrefs", Context.MODE_PRIVATE).edit().apply {
            putStringSet("blocked_apps", emptySet())
            putBoolean("is_blocking_suspended", false)
            putLong("block_expiry_time", 0L)
            commit()
        }
        updateGlobalRot(-30.0f)
        Toast.makeText(this, "Focus Protocol Completed. Brain Restored ❤️🩹 +30%", Toast.LENGTH_LONG).show()
        isNavigatingHome = false 
        refreshServiceConfig() 
        setWallVisibility(false)
        hideBrainrotMeter()
        hideIntentGate()
    }

    private fun getCurrentDateString(): String {
        return java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault()).format(java.util.Date())
    }

    private fun updateLastScrollTimestampPersistent(timestamp: Long) {
        getSharedPreferences("UnlinkBlockingPrefs", Context.MODE_PRIVATE).edit().putLong("last_scroll_timestamp", timestamp).apply()
        lastBrainrotScrollTime = timestamp
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
        if (isScroll) globalShortsCount++
        prefs.edit().apply {
            putFloat("global_brainrot_score", globalBrainrotScore)
            putInt("global_shorts_count", globalShortsCount)
            putString("global_brainrot_date", lastBrainrotDate)
            apply()
        }
        if (blockExpiryTime > System.currentTimeMillis() && isCurrentlyInShortsMode) {
            if (!isShortsLocked && globalBrainrotScore >= SHORTS_LOCK_THRESHOLD) {
                isShortsLocked = true
                enforceShortsLockSurgical()
            } else if (isShortsLocked && globalBrainrotScore <= SHORTS_UNLOCK_THRESHOLD) {
                isShortsLocked = false
                Toast.makeText(this, "Brain Recovered! Clarity Restored. ❤️🩹", Toast.LENGTH_LONG).show()
            }
        }
    }
    
    private fun resetBrainrotState() {
        globalBrainrotScore = 0f
        globalShortsCount = 0
        getSharedPreferences("UnlinkBlockingPrefs", Context.MODE_PRIVATE).edit().apply {
            putFloat("global_brainrot_score", 0f)
            putInt("global_shorts_count", 0)
            apply()
        }
        hideBrainrotMeter()
    }

    private fun checkSelfProtection(node: AccessibilityNodeInfo?): Boolean {
        if (node == null) return false
        val appName = getString(resources.getIdentifier("app_name", "string", packageName))
        if (node.findAccessibilityNodeInfosByText(appName)?.isNotEmpty() == true) return true
        for (i in 0 until node.childCount) {
            if (checkSelfProtection(node.getChild(i))) return true
        }
        return false
    }

    private var bingeNudgeOverlayView: View? = null

    private fun showBingeNudgeOverlay() {
        visibilityHandler.post {
            try {
                if (bingeNudgeOverlayView?.parent != null) return@post
                val inflater = getSystemService(Context.LAYOUT_INFLATER_SERVICE) as LayoutInflater
                val layoutId = resources.getIdentifier("overlay_binge_nudge", "layout", packageName)
                if (layoutId == 0) return@post
                bingeNudgeOverlayView = inflater.inflate(layoutId, null)
                val params = WindowManager.LayoutParams(
                    -1, -1, WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                    PixelFormat.TRANSLUCENT
                )
                bingeNudgeOverlayView?.findViewById<View>(resources.getIdentifier("takeBreakButton", "id", packageName))?.setOnClickListener {
                    try { if (bingeNudgeOverlayView?.parent != null) windowManager?.removeView(bingeNudgeOverlayView) } catch (e: Exception) {}
                    bingeNudgeOverlayView = null
                    goHome()
                    updateGlobalRot(-12.0f)
                    Toast.makeText(applicationContext, "Break taken! Brain is healing ❤️🩹 +12%", Toast.LENGTH_SHORT).show()
                    last_target_app_entry_time = System.currentTimeMillis()
                }
                bingeNudgeOverlayView?.findViewById<View>(resources.getIdentifier("continueBingeButton", "id", packageName))?.setOnClickListener {
                    try { if (bingeNudgeOverlayView?.parent != null) windowManager?.removeView(bingeNudgeOverlayView) } catch (e: Exception) {}
                    bingeNudgeOverlayView = null
                }
                windowManager?.addView(bingeNudgeOverlayView, params)
                vibrate(200)
            } catch (e: Exception) {}
        }
    }

    private fun refreshFromDiskInternal() {
        try {
            val prefs = getSharedPreferences("UnlinkBlockingPrefs", Context.MODE_PRIVATE)
            currentBlockedApps = prefs.getStringSet("blocked_apps", emptySet()) ?: emptySet()
            blockExpiryTime = prefs.getLong("block_expiry_time", 0L)
            blockRemainingAtSuspension = prefs.getLong("block_remaining_ms", 0L)
            isBlockingSuspended = prefs.getBoolean("is_blocking_suspended", false)
            isSurgicalYoutube = prefs.getBoolean("surgical_youtube", false)
            isSurgicalInstagram = prefs.getBoolean("surgical_instagram", false)
            isYtGateEnabled = prefs.getBoolean("coach_yt_gate", true)
            isYtShelfEnabled = prefs.getBoolean("coach_yt_shelf", true)
            isYtFiniteEnabled = prefs.getBoolean("coach_yt_finite", true)
            isIgGateEnabled = prefs.getBoolean("coach_ig_gate", true)
            isIgDmsEnabled = prefs.getBoolean("coach_ig_dms", true)
            isIgFiniteEnabled = prefs.getBoolean("coach_ig_finite", true)
            val today = getCurrentDateString()
            lastBrainrotDate = prefs.getString("global_brainrot_date", today) ?: today
            if (lastBrainrotDate != today) {
                globalBrainrotScore = 0f
                globalShortsCount = 0
                lastBrainrotDate = today
            } else {
                globalBrainrotScore = prefs.getFloat("global_brainrot_score", 0f)
                globalShortsCount = prefs.getInt("global_shorts_count", 0)
            }
            lastBrainrotScrollTime = prefs.getLong("last_scroll_timestamp", System.currentTimeMillis())
            breaksRemaining = prefs.getInt("breaks_remaining", 0)
        } catch (e: Exception) {}
    }

    private fun performSecurityCheck() {
        val root = rootInActiveWindow
        val pkg = root?.packageName?.toString() ?: getForegroundAppViaUsageStats()
        pkg?.let { p ->
            if (p == getLauncherPackageName() || p == packageName) {
                if (!isNavigatingHome) setWallVisibility(false)
                return
            }
            if (isBlockActive(p)) {
                setWallVisibility(true)
                return
            }
            if (p == "com.google.android.youtube" || p == "com.instagram.android") {
                val isSurgical = if (p == "com.google.android.youtube") isSurgicalYoutube else isSurgicalInstagram
                if (isSurgical && !authorizedApps.contains(p)) {
                    showIntentGate(p)
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
                try {
                    if (android.provider.Settings.canDrawOverlays(this)) {
                        windowManager?.addView(view, view.layoutParams as WindowManager.LayoutParams)
                        countdownHandler.post(countdownRunnable)
                    }
                } catch (e: Exception) {}
            } else {
                try {
                    if (view.parent != null) windowManager?.removeView(view)
                    countdownHandler.removeCallbacks(countdownRunnable)
                } catch (e: Exception) {}
            }
        }
    }

    private fun vibrate(duration: Long) {
        try {
            val v = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                (getSystemService(VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
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
        val idx = when { score >= 86f -> 7; score >= 71f -> 6; score >= 57f -> 5; score >= 43f -> 4; score >= 29f -> 3; score >= 15f -> 2; else -> 1 }
        return resources.getIdentifier("stage_$idx", "drawable", packageName)
    }

    private fun animateMascot(view: View?) {
        if (view == null) return
        ObjectAnimator.ofFloat(view, "translationY", -15f, 15f).apply {
            duration = 2500; repeatMode = ValueAnimator.REVERSE; repeatCount = ValueAnimator.INFINITE
            interpolator = AccelerateDecelerateInterpolator(); start()
        }
    }

    private fun updateWallContent() {
        try {
            val overlay = overlayView ?: return
            val mascotId = resources.getIdentifier("rotMascot", "id", packageName).let { if (it != 0) it else resources.getIdentifier("gateBrainMascot", "id", packageName) }
            overlay.findViewById<ImageView>(mascotId)?.apply { setImageResource(getBrainrotDrawable(globalBrainrotScore)); animateMascot(this) }
            overlay.findViewById<TextView>(resources.getIdentifier("rotStatusText", "id", packageName))?.text = "Your Brain is at ${String.format("%.0f", globalBrainrotScore)}% Rot"
            var mainMsg = "You chose to protect your focus today."
            var subMsg = "Your brain is already starting to feel clearer ❤️🩹"
            if (globalBrainrotScore >= 60f) {
                mainMsg = "You've been scrolling heavily today."; subMsg = "This break is saving your brain from further damage."
            } else if (isCurrentlyInShortsMode) {
                mainMsg = "Shorts & Reels are locked to protect you."; subMsg = "DMs are still open if you need them."
            }
            overlay.findViewById<TextView>(resources.getIdentifier("messageText", "id", packageName))?.text = mainMsg
            overlay.findViewById<TextView>(resources.getIdentifier("coachSubText", "id", packageName))?.text = subMsg
            overlay.findViewById<Button>(resources.getIdentifier("takeBreakButton", "id", packageName))?.visibility = if (breaksRemaining > 0) View.VISIBLE else View.GONE
        } catch (e: Exception) {}
    }

    private fun createAbsoluteWall() {
        if (windowManager == null) windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        try {
            val layoutId = resources.getIdentifier("blocking_overlay_full", "layout", packageName)
            overlayView = if (layoutId != 0) (getSystemService(LAYOUT_INFLATER_SERVICE) as LayoutInflater).inflate(layoutId, null) else createFailsafeView()
            overlayView?.findViewById<Button>(resources.getIdentifier("goHomeButton", "id", packageName))?.setOnClickListener { goHome() }
            overlayView?.findViewById<Button>(resources.getIdentifier("takeBreakButton", "id", packageName))?.setOnClickListener { requestBreak() }
            overlayView?.layoutParams = WindowManager.LayoutParams(
                -1, -1, WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or WindowManager.LayoutParams.FLAG_SECURE or WindowManager.LayoutParams.FLAG_DIM_BEHIND,
                PixelFormat.TRANSLUCENT
            ).apply { dimAmount = 1.0f; windowAnimations = android.R.style.Animation_InputMethod }
        } catch (e: Exception) {}
    }

    private fun requestBreak() {
        if (isProcessingBreak || breaksRemaining <= 0) return
        try {
            blockRemainingAtSuspension = Math.max(0L, blockExpiryTime - System.currentTimeMillis())
            getSharedPreferences("UnlinkBlockingPrefs", Context.MODE_PRIVATE).edit().apply {
                putBoolean("is_blocking_suspended", true); putLong("block_remaining_ms", blockRemainingAtSuspension); commit()
            }
            setWallVisibility(false); isBlockingSuspended = true
            sendBroadcast(Intent("com.shahil.unlink.REQUEST_BREAK").setPackage(packageName))
            Toast.makeText(this, "Break started. Use it wisely! ❤️🩹", Toast.LENGTH_SHORT).show()
            visibilityHandler.postDelayed({ isProcessingBreak = false }, 2000L)
        } catch (e: Exception) { isProcessingBreak = false }
    }

    private fun goHome() {
        try {
            isNavigatingHome = true
            startActivity(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            visibilityHandler.postDelayed({ isNavigatingHome = false; performSecurityCheck() }, 350L) 
        } catch (e: Exception) { isNavigatingHome = false }
    }

    private fun updateOverlayTimer() {
        val remaining = if (isBlockingSuspended) blockRemainingAtSuspension else blockExpiryTime - System.currentTimeMillis()
        if (remaining <= 0 && !isBlockingSuspended) {
            if (blockExpiryTime > 0L) teardownAllBlocks(); return
        }
        val totalSeconds = Math.max(0L, remaining / 1000)
        overlayView?.findViewById<TextView>(resources.getIdentifier("timerText", "id", packageName))?.text = String.format("%02d:%02d", totalSeconds / 60, totalSeconds % 60)
    }

    private fun getForegroundAppViaUsageStats(): String? {
        return try {
            val usm = getSystemService(USAGE_STATS_SERVICE) as UsageStatsManager
            val time = System.currentTimeMillis()
            val events = usm.queryEvents(time - 5000, time)
            val event = UsageEvents.Event()
            var lastPkg: String? = null
            while (events.hasNextEvent()) {
                events.getNextEvent(event)
                if (event.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND) lastPkg = event.packageName
            }
            lastPkg
        } catch (e: Exception) { null }
    }

    private fun createFailsafeView(): View {
        return FrameLayout(this).apply {
            setBackgroundColor(Color.BLACK)
            addView(TextView(this@UnlinkAccessibilityService).apply { text = "FOCUS_PROTOCOL_ENGAGED"; setTextColor(Color.WHITE); gravity = Gravity.CENTER }, FrameLayout.LayoutParams(-2, -2, Gravity.CENTER))
            addView(Button(this@UnlinkAccessibilityService).apply { text = "GO HOME"; setOnClickListener { goHome() } }, FrameLayout.LayoutParams(-1, 200, Gravity.BOTTOM).apply { setMargins(50, 50, 50, 100) })
        }
    }

    override fun onInterrupt() {}

    private var isGateInflationPending = false

    private fun showIntentGate(pkg: String) {
        if (gateOverlayView != null || isGateInflationPending) return
        isGateInflationPending = true
        visibilityHandler.post {
            try {
                if (gateOverlayView != null) return@post
                val layoutId = resources.getIdentifier("overlay_intent_gate", "layout", packageName)
                if (layoutId == 0) return@post
                gateOverlayView = (getSystemService(LAYOUT_INFLATER_SERVICE) as LayoutInflater).inflate(layoutId, null)
                val appName = if (pkg == "com.google.android.youtube") "YouTube" else "Instagram"
                gateOverlayView?.findViewById<TextView>(resources.getIdentifier("intentQuestion", "id", packageName))?.text = "Why are you opening\n$appName today?"
                val brainStatusId = resources.getIdentifier("brainStatusText", "id", packageName)
                if (brainStatusId != 0) {
                    val emoji = when { globalBrainrotScore > 75f -> "🧟"; globalBrainrotScore > 50f -> "🤢"; globalBrainrotScore > 20f -> "🤔"; else -> "🧠" }
                    val statusText = when { globalBrainrotScore > 80f -> "CRITICAL ROT"; globalBrainrotScore > 60f -> "HEAVY ROT"; globalBrainrotScore > 40f -> "STARTING TO ROT"; globalBrainrotScore > 20f -> "MILD FOG"; else -> "FRESH BRAIN" }
                    gateOverlayView?.findViewById<TextView>(brainStatusId)?.text = "$emoji ${String.format("%.1f", globalBrainrotScore)}% $statusText"
                }
                val lastScroll = getSharedPreferences("UnlinkBlockingPrefs", Context.MODE_PRIVATE).getLong("last_scroll_timestamp", 0L)
                if (lastScroll > 0L) {
                    val hours = (System.currentTimeMillis() - lastScroll) / (1000 * 60 * 60)
                    if (hours >= 1 && globalBrainrotScore > 0f) {
                        val heal = Math.min(hours * 10f, globalBrainrotScore)
                        updateGlobalRot(-heal); getSharedPreferences("UnlinkBlockingPrefs", Context.MODE_PRIVATE).edit().putLong("last_scroll_timestamp", System.currentTimeMillis()).apply()
                        gateOverlayView?.findViewById<TextView>(resources.getIdentifier("winLineText", "id", packageName))?.apply { text = "RECOVERY: +${heal.toInt()}% Brain Restoration earned during your ${hours}h break! 🔥"; setTextColor(Color.parseColor("#72FE88")) }
                    }
                }
                gateOverlayView?.findViewById<View>(resources.getIdentifier("dmOnlyButton", "id", packageName))?.setOnClickListener { authorizeSession(pkg, -15f, "DMs only = brain saved 😎 +15%") }
                gateOverlayView?.findViewById<View>(resources.getIdentifier("longVideosButton", "id", packageName))?.setOnClickListener { authorizeSession(pkg, -6f, "Long videos only! +6%") }
                gateOverlayView?.findViewById<View>(resources.getIdentifier("reelsLimitButton", "id", packageName))?.setOnClickListener { authorizeSession(pkg, -8f, "Respecting your limits! +8%") }
                gateOverlayView?.findViewById<View>(resources.getIdentifier("fullFocusButton", "id", packageName))?.setOnClickListener { authorizeSession(pkg, -25f, "Focus Session started! +25%") }
                gateOverlayView?.findViewById<View>(resources.getIdentifier("cancelButton", "id", packageName))?.setOnClickListener { hideIntentGate(); goHome(); updateGlobalRot(-10f); Toast.makeText(applicationContext, "Brain Saved ❤️🩹 +10%", Toast.LENGTH_SHORT).show() }
                windowManager?.addView(gateOverlayView, WindowManager.LayoutParams(-1, -1, WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY, WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS, PixelFormat.TRANSLUCENT))
                startGateCountdown()
            } catch (e: Exception) { Log.e("UnlinkGate", "Failed to show gate: ${e.message}") } finally { isGateInflationPending = false }
        }
    }

    private fun startGateCountdown() {
        gateCountdown = 3
        val runnable = object : Runnable {
            override fun run() {
                if (gateCountdown > 0) {
                    gateOverlayView?.findViewById<TextView>(resources.getIdentifier("calmTimerText", "id", packageName))?.text = gateCountdown.toString(); gateCountdown--; gateHandler.postDelayed(this, 1000)
                } else {
                    gateOverlayView?.findViewById<View>(resources.getIdentifier("calmContainer", "id", packageName))?.visibility = View.GONE
                    gateOverlayView?.findViewById<View>(resources.getIdentifier("actionContainer", "id", packageName))?.apply { visibility = View.VISIBLE; alpha = 0f; animate().alpha(1f).setDuration(400).start() }
                }
            }
        }
        gateHandler.post(runnable)
    }

    private fun authorizeSession(pkg: String, healingDelta: Float = 0f, message: String = "") {
        if (healingDelta < 0f) {
            updateGlobalRot(healingDelta)
            Toast.makeText(applicationContext, if (message.isNotEmpty()) message else "Brain Healing ❤️🩹 ${-healingDelta}%", Toast.LENGTH_SHORT).show()
        }
        authorizedApps.add(pkg); gateStatus = GateStatus.AUTHORIZED; hideIntentGate(); vibrate(50)
    }

    private fun hideIntentGate() {
        gateHandler.removeCallbacksAndMessages(null)
        gateOverlayView?.let { try { if (it.parent != null) windowManager?.removeView(it) } catch (e: Exception) {}; gateOverlayView = null }
    }

    private fun showAndUpdateBrainrotMeter() {
        if (!isCurrentlyInShortsMode || isNavigatingHome || isBlockingSuspended) {
            hideBrainrotMeter()
            return
        }
        visibilityHandler.post {
            try {
                if (brainrotOverlayView == null) {
                    if (isNavigatingHome) return@post
                    val layoutId = resources.getIdentifier("overlay_brainrot_meter", "layout", packageName)
                    if (layoutId == 0) return@post
                    brainrotOverlayView = (getSystemService(LAYOUT_INFLATER_SERVICE) as LayoutInflater).inflate(layoutId, null)
                    windowManager?.addView(brainrotOverlayView, WindowManager.LayoutParams(WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY, WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS, PixelFormat.TRANSLUCENT).apply { gravity = Gravity.TOP or Gravity.END; y = 150; x = 40 })
                }
                val view = brainrotOverlayView ?: return@post
                val mascotIv = view.findViewById<ImageView>(resources.getIdentifier("brainrotMascot", "id", packageName))
                val countTv = view.findViewById<TextView>(resources.getIdentifier("brainrotCount", "id", packageName))
                countTv?.text = "${String.format("%.0f%%", globalBrainrotScore)}"
                mascotIv?.setImageResource(getBrainrotDrawable(if (isHealing) 0f else globalBrainrotScore)); animateMascot(mascotIv)
                val bg = view.findViewById<View>(resources.getIdentifier("brainrotContainer", "id", packageName))?.background as? android.graphics.drawable.GradientDrawable
                bg?.setColor(Color.parseColor(when { isHealing -> "#CC228822"; globalBrainrotScore > 80f -> "#CCAA0000"; globalBrainrotScore > 60f -> "#CCAA3300"; globalBrainrotScore > 40f -> "#CCAA7700"; globalBrainrotScore > 20f -> "#CC55AA00"; else -> "#99000000" }))
                if (view.alpha == 0f) view.animate().alpha(1f).setDuration(300).start()
                else view.animate().scaleX(1.1f).scaleY(1.1f).setDuration(100).withEndAction { view.animate().scaleX(1f).scaleY(1f).setDuration(100).start() }.start()
                brainrotHandler.removeCallbacks(brainrotHideRunnable); brainrotHandler.postDelayed(brainrotHideRunnable, 4000)
            } catch (e: Exception) {}
        }
    }

    private fun hideBrainrotMeter() {
        visibilityHandler.post {
            brainrotOverlayView?.let { view ->
                view.animate().alpha(0f).setDuration(300).withEndAction { try { if (view.parent != null) windowManager?.removeView(view) } catch (e: Exception) {}; brainrotOverlayView = null }.start()
            }
        }
    }

    private fun verifyShortsStateSurgical() {
        try {
            val now = System.currentTimeMillis()
            if (isBlockingSuspended) { hideBrainrotMeter(); return }
            val root = rootInActiveWindow ?: return
            val pkg = root.packageName?.toString() ?: return
            if (pkg != "com.google.android.youtube" && pkg != "com.instagram.android") return
            if (blockExpiryTime <= now) { if (isCurrentlyInShortsMode) { isCurrentlyInShortsMode = false; hideBrainrotMeter(); watchTimeHandler.removeCallbacks(watchTimeRunnable) }; return }
            val surgicalEnabled = if (pkg == "com.google.android.youtube") isSurgicalYoutube else isSurgicalInstagram
            if (!surgicalEnabled) { if (isCurrentlyInShortsMode) { isCurrentlyInShortsMode = false; hideBrainrotMeter(); watchTimeHandler.removeCallbacks(watchTimeRunnable) }; return }
            val isSurgical = isShortsModeSurgicalRecursive(root, pkg)
            if (isSurgical && isShortsLocked) { enforceShortsLockSurgical(); return }
            if (isSurgical && !isCurrentlyInShortsMode) { isCurrentlyInShortsMode = true; currentReelStartTime = System.currentTimeMillis(); watchTimeHandler.post(watchTimeRunnable); showAndUpdateBrainrotMeter() }
            else if (!isSurgical && isCurrentlyInShortsMode) { isCurrentlyInShortsMode = false; hideBrainrotMeter(); watchTimeHandler.removeCallbacks(watchTimeRunnable) }
        } catch (e: Exception) {}
    }

    private fun enforceShortsLockSurgical() {
        visibilityHandler.post {
            Toast.makeText(this, "BRAIN ROT: ${String.format("%.1f", globalBrainrotScore)}% | SHORTS LOCKED UNTIL HEALED TO 30%", Toast.LENGTH_LONG).show()
            performGlobalAction(GLOBAL_ACTION_BACK)
            isCurrentlyInShortsMode = false; hideBrainrotMeter(); watchTimeHandler.removeCallbacks(watchTimeRunnable)
        }
    }

    private fun isShortsModeSurgicalRecursive(node: AccessibilityNodeInfo?, pkg: String): Boolean {
        if (node == null) return false
        // STRICT ID MATCHING: Only trigger if the actual Shorts containers are visible.
        val ids = if (pkg == "com.google.android.youtube") {
            listOf("com.google.android.youtube:id/reel_recycler", "com.google.android.youtube:id/reel_watch_fragment_root") 
        } else {
            listOf("com.instagram.android:id/clips_video_container", "com.instagram.android:id/reels_view_pager")
        }
        
        for (id in ids) {
            val found = node.findAccessibilityNodeInfosByViewId(id)
            if (found?.isNotEmpty() == true) {
                // Ensure it's actually visible to the user
                if (found.any { it.isVisibleToUser }) return true
            }
        }
        
        // Only use structural fallback for Instagram as YouTube Home feed has a very similar structure to Shorts
        if (pkg == "com.instagram.android") return findSurgicalContainerByStructure(node)
        return false
    }

    private fun findSurgicalContainerByStructure(node: AccessibilityNodeInfo?): Boolean {
        if (node == null) return false
        if (node.isScrollable && (node.className?.contains("RecyclerView") == true || node.className?.contains("ViewPager") == true)) {
            val rect = Rect(); node.getBoundsInScreen(rect)
            // Instagram Reels are strictly full screen scrollables
            if (rect.height() > resources.displayMetrics.heightPixels * 0.9) return true
        }
        for (i in 0 until node.childCount) { if (findSurgicalContainerByStructure(node.getChild(i))) return true }
        return false
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL_ID, "Unlink Protection", NotificationManager.IMPORTANCE_LOW)
            (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(channel)
        }
    }

    private fun createNotification(): Notification {
        val intent = packageManager.getLaunchIntentForPackage(packageName)
        val pi = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_IMMUTABLE)
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Unlink Working")
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .setContentIntent(pi)
            .setOngoing(true)
            .build()
    }

    private fun handleUniversalBlockScan() {
        var retries = 0
        val runnable = object : Runnable {
            override fun run() {
                performSecurityCheck()
                if (retries < 6) { retries++; visibilityHandler.postDelayed(this, if (retries <= 2) 40L else 80L) }
            }
        }
        visibilityHandler.post(runnable)
    }

    override fun onDestroy() {
        countdownHandler.removeCallbacks(countdownRunnable)
        try { unregisterReceiver(syncReceiver) } catch (e: Exception) {}
        super.onDestroy()
    }
}
