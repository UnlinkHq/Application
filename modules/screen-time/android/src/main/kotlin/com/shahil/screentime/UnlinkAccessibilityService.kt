package com.shahil.screentime

import android.accessibilityservice.AccessibilityService
import android.animation.ObjectAnimator
import android.animation.ValueAnimator
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
import android.content.pm.PackageManager
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
import android.provider.Settings
import android.util.Log
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.view.accessibility.AccessibilityWindowInfo
import android.view.animation.AccelerateDecelerateInterpolator
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.core.app.NotificationCompat

class UnlinkAccessibilityService : AccessibilityService() {

companion object {
        @Volatile
        var instance: UnlinkAccessibilityService? = null
            private set

        private const val CHANNEL_ID = "unlink_protection_channel"
        private const val NOTIFICATION_ID = 1001
        private const val BREAK_WARNING_NOTIF_ID = 1002
        private const val SHORTS_LOCK_THRESHOLD = 85f
        private const val SHORTS_UNLOCK_THRESHOLD = 30f
        private const val TAG = "UnlinkWarden"

        private val DAY_NAMES = arrayOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat")
        private val EVENT_TYPE_MASK = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED or
                                      AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED or
                                      AccessibilityEvent.TYPE_VIEW_SCROLLED

        private val YT_SHORTS_IDS = listOf(
            "com.google.android.youtube:id/reel_recycler",
            "com.google.android.youtube:id/reel_watch_fragment_root",
            "com.google.android.youtube:id/shorts_container"
        )
        private val IG_REELS_IDS = listOf(
            "com.instagram.android:id/clips_video_container",
            "com.instagram.android:id/reels_view_pager",
            "com.instagram.android:id/reels_video_container",
            "com.instagram.android:id/clips_pager",
            "com.instagram.android:id/reels_pager"
        )

        private val THREAD_CAL = ThreadLocal.withInitial { java.util.Calendar.getInstance() }
        private val THREAD_DATE_FMT = ThreadLocal.withInitial {
            java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US)
        }
    }

    // ─── Background thread for heavy work (tree walks, prefs I/O) ────────────
    private val bgThread = HandlerThread("UnlinkBgThread").also { it.start() }
    private val bgHandler = Handler(bgThread.looper)

    // ─── Main-thread handler for UI only ─────────────────────────────────────
    private val mainHandler = Handler(Looper.getMainLooper())

    // ─── Cached view IDs (set once in onServiceConnected) ────────────────────
    private var idRotMascot = 0
    private var idGateBrainMascot = 0
    private var idRotStatusText = 0
    private var idMessageText = 0
    private var idCoachSubText = 0
    private var idTakeBreakButton = 0
    private var idGoHomeButton = 0
    private var idTimerText = 0
    private var idBrainrotMascot = 0
    private var idBrainrotCount = 0
    private var idBrainrotContainer = 0
    private var idIntentQuestion = 0
    private var idBrainStatusText = 0
    private var idWinLineText = 0
    private var idDmOnlyButton = 0
    private var idLongVideosButton = 0
    private var idReelsLimitButton = 0
    private var idFullFocusButton = 0
    private var idCancelButton = 0
    private var idCalmTimerText = 0
    private var idCalmContainer = 0
    private var idActionContainer = 0
    private var idBingeNudgeTakeBreak = 0
    private var idBingeNudgeContinue = 0

    // ─── Surgical / config flags ──────────────────────────────────────────────
    @Volatile private var isSurgicalYoutube = false
    @Volatile private var isSurgicalInstagram = false
    @Volatile private var isYtGateEnabled = true
    @Volatile private var isIgGateEnabled = true
    @Volatile private var isStrictModeEnabled = false

    // ─── Block state ──────────────────────────────────────────────────────────
    @Volatile private var currentBlockedApps: Set<String> = emptySet()
    @Volatile private var blockExpiryTime: Long = 0L
    @Volatile private var isBlockingSuspended = false
    @Volatile private var blockRemainingAtSuspension: Long = 0L
    @Volatile private var breaksRemaining = 0

    // ─── Brainrot tracking ────────────────────────────────────────────────────
    @Volatile private var globalBrainrotScore: Float = 0f
    @Volatile private var globalShortsCount: Int = 0
    @Volatile private var lastBrainrotDate: String = ""
    @Volatile private var lastBrainrotScrollTime: Long = 0L
    @Volatile private var isShortsLocked = false

    // ─── Session tracking (main thread only) ──────────────────────────────────
    private var lastForegroundPackage: String? = null
    private var isCurrentlyInShortsMode = false
    private var isHealing = false
    private var currentReelStartTime: Long = 0
    private var last_target_app_entry_time = 0L
    private var live_reels_in_this_binge = 0
    private var nudge45Shown = false
    private var lastLockActionTime = 0L
    private var isNavigatingHome = false
    private var isProcessingBreak = false
    private var suspensionStartTime = 0L
    private var lastSelfProtectCheckTime = 0L
    @Volatile private var cachedLauncherPackage: String? = null

    // ─── Thread-safe authorized apps set ─────────────────────────────────────
    private val authorizedApps = java.util.Collections.synchronizedSet(mutableSetOf<String>())
    private var gateCountdown = 3

    // ─── Cached Schedules (Avoid JSON parsing on every event) ─────────────────
    private data class NativeSchedule(
        val id: String,
        val enabled: Boolean,
        val startTimeMins: Int,
        val endTimeMins: Int,
        val days: Set<String>,
        val appPackages: List<String>
    )
    @Volatile private var cachedSchedules: List<NativeSchedule> = emptyList()
    @Volatile private var cachedStopRecords: Map<String, String> = emptyMap()

    // Usage stats cached off-thread so updateWallContent() never blocks main thread
    @Volatile private var cachedUsageText: String? = null

    // ─── Views ────────────────────────────────────────────────────────────────
    private var windowManager: WindowManager? = null
    private var overlayView: View? = null
    private var gateOverlayView: View? = null
    private var brainrotOverlayView: View? = null
    private var bingeNudgeOverlayView: View? = null
    private var isGateInflationPending = false

    // ─── Cached services (lazy — avoids repeated getSystemService Binder calls) ─
    private val prefs by lazy { getSharedPreferences("UnlinkBlockingPrefs", Context.MODE_PRIVATE) }
    private val layoutInflater by lazy { getSystemService(LAYOUT_INFLATER_SERVICE) as LayoutInflater }
    private val vibrator by lazy {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
            (getSystemService(VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
        else @Suppress("DEPRECATION") getSystemService(VIBRATOR_SERVICE) as Vibrator
    }

    // ─── Cached stage drawable resource IDs (populated in cacheViewIds) ──────
    private val stageDrawableIds = IntArray(8)
    private var mascotAnimator: ObjectAnimator? = null
    private var brainrotMascotAnimator: ObjectAnimator? = null

    // ─────────────────────────────────────────────────────────────────────────
    // Runnables
    // ─────────────────────────────────────────────────────────────────────────

    private val heartbeatRunnable = object : Runnable {
        override fun run() {
            val now = System.currentTimeMillis()
            if (blockExpiryTime in 1..now && !isBlockingSuspended) {
                Log.d(TAG, "Session expired. Tearing down.")
                teardownAllBlocks()
            }
            // Periodic multi-window scan: catches blocked apps sitting in a background
            // split-screen pane that haven't fired TYPE_WINDOW_STATE_CHANGED yet.
            // Runs every 10s — same cadence as this heartbeat, zero event overhead.
            if (!isBlockingSuspended && (blockExpiryTime > now || checkNativeSchedulesActive())) {
                checkAllWindowsForBlockedApps()
            }
            mainHandler.postDelayed(this, 10_000L)
        }
    }

    private val watchTimeRunnable = object : Runnable {
        override fun run() {
            val now = System.currentTimeMillis()
            if (blockExpiryTime <= now || isBlockingSuspended) {
                isCurrentlyInShortsMode = false
                hideBrainrotMeter()
                return
            }
            if (now - lastBrainrotScrollTime > 45_000L) {
                isHealing = true
                updateGlobalRot(-0.05f, false)
                showAndUpdateBrainrotMeter()
            } else {
                isHealing = false
            }
            val elapsed = now - currentReelStartTime
            if (elapsed % 5000L < 1100L) verifyShortsStateSurgical()
            
            mainHandler.removeCallbacks(this)
            mainHandler.postDelayed(this, 1000L)
        }
    }

    private val countdownRunnable = object : Runnable {
        override fun run() {
            updateOverlayTimer()
            mainHandler.postDelayed(this, 1000L)
        }
    }

    private val brainrotHideRunnable = Runnable { hideBrainrotMeter() }

    @Volatile private var breakDurationMs = 15 * 60 * 1000L // Default 15m

    private val breakExpiryRunnable = object : Runnable {
        override fun run() {
            if (isBlockingSuspended && suspensionStartTime > 0 &&
                System.currentTimeMillis() - suspensionStartTime > breakDurationMs) {
                Log.d(TAG, "BREAK_EXPIRED: Auto-resuming blocking after ${breakDurationMs / 60_000}min cap.")
                setSuspendedState(false)
            } else if (isBlockingSuspended) {
                mainHandler.postDelayed(this, 10_000L)
            }
        }
    }

    private val breakWarningRunnable = Runnable {
        showBreakWarningNotification()
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Broadcast receiver
    // ─────────────────────────────────────────────────────────────────────────

    private val syncReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            when (intent?.action) {
                "com.shahil.unlink.SYNC_LIST" -> setSuspendedState(null)
                "com.shahil.ACTION_REFRESH_BLOCKS" -> {
                    Log.d(TAG, "Boot refresh — rehydrating config & scanning.")
                    refreshServiceConfig()
                }
                Intent.ACTION_TIME_CHANGED, Intent.ACTION_TIMEZONE_CHANGED -> {
                    Log.d(TAG, "Time/Timezone changed — refreshing schedule cache.")
                    refreshServiceConfig()
                }
                Intent.ACTION_SCREEN_OFF -> {
                    authorizedApps.clear()
                    Log.d(TAG, "Screen off — auth reset.")
                }
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Lifecycle
    // ─────────────────────────────────────────────────────────────────────────

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        cacheViewIds()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, createNotification())
        // Clear stale shutdown marker on connect
        prefs.edit().putLong("last_shutdown_watchdog", 0L).apply()
        val filter = IntentFilter().apply {
            addAction("com.shahil.unlink.SYNC_LIST")
            addAction("com.shahil.ACTION_REFRESH_BLOCKS")
            addAction(Intent.ACTION_SCREEN_OFF)
            addAction(Intent.ACTION_TIME_CHANGED)
            addAction(Intent.ACTION_TIMEZONE_CHANGED)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(syncReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(syncReceiver, filter)
        }
        bgHandler.post { refreshFromDiskInternal() }
        refreshServiceConfig()
        mainHandler.post(heartbeatRunnable)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY

    override fun onInterrupt() {}

    override fun onDestroy() {
        // Record shutdown timestamp for reboot watchdog
        prefs.edit().putLong("last_shutdown_watchdog", System.currentTimeMillis()).apply()
        mainHandler.removeCallbacksAndMessages(null)
        bgHandler.removeCallbacksAndMessages(null)
        bgThread.quitSafely()
        safeRemoveView(overlayView);          overlayView = null
        safeRemoveView(gateOverlayView);      gateOverlayView = null
        safeRemoveView(brainrotOverlayView);  brainrotOverlayView = null
        safeRemoveView(bingeNudgeOverlayView);bingeNudgeOverlayView = null
        try { unregisterReceiver(syncReceiver) } catch (_: Exception) {}
        instance = null
        super.onDestroy()
    }

    private fun safeRemoveView(v: View?) {
        try { if (v?.parent != null) windowManager?.removeView(v) } catch (_: Exception) {}
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Cache view IDs (called once — avoids repeated getIdentifier calls)
    // ─────────────────────────────────────────────────────────────────────────

    private fun cacheViewIds() {
        fun id(name: String) = resources.getIdentifier(name, "id", packageName)
        idGateBrainMascot    = id("gateBrainMascot")
        idRotMascot          = id("rotMascot").takeIf { it != 0 } ?: idGateBrainMascot
        idRotStatusText      = id("rotStatusText")
        idMessageText        = id("messageText")
        idCoachSubText       = id("coachSubText")
        idTakeBreakButton    = id("takeBreakButton")
        idGoHomeButton       = id("goHomeButton")
        idTimerText          = id("timerText")
        idBrainrotMascot     = id("brainrotMascot")
        idBrainrotCount      = id("brainrotCount")
        idBrainrotContainer  = id("brainrotContainer")
        idIntentQuestion     = id("intentQuestion")
        idBrainStatusText    = id("brainStatusText")
        idWinLineText        = id("winLineText")
        idDmOnlyButton       = id("dmOnlyButton")
        idLongVideosButton   = id("longVideosButton")
        idReelsLimitButton   = id("reelsLimitButton")
        idFullFocusButton    = id("fullFocusButton")
        idCancelButton       = id("cancelButton")
        idCalmTimerText      = id("calmTimerText")
        idCalmContainer      = id("calmContainer")
        idActionContainer    = id("actionContainer")
idBingeNudgeTakeBreak = id("bingeNudgeTakeBreakButton")
        idBingeNudgeContinue  = id("continueBingeButton")

        for (i in 1..7) {
            stageDrawableIds[i - 1] = resources.getIdentifier("stage_$i", "drawable", packageName)
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Main event handler
    // ─────────────────────────────────────────────────────────────────────────

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        val now = System.currentTimeMillis()
        val eventType = event.eventType

        // Fast-path: nothing is blocking
        if (blockExpiryTime <= now && !checkNativeSchedulesActive()) {
            if (isCurrentlyInShortsMode || brainrotOverlayView != null) {
                isCurrentlyInShortsMode = false
                hideBrainrotMeter()
                hideIntentGate()
                mainHandler.removeCallbacks(watchTimeRunnable)
            }
            return
        }

        if (eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED &&
            eventType != AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED &&
            eventType != AccessibilityEvent.TYPE_VIEW_SCROLLED) return

        val pkg = rootInActiveWindow?.packageName?.toString()
            ?: event.packageName?.toString()
            ?: return
        if (pkg == packageName) return

        // ── 0. PiP bypass detection ───────────────────────────────────────────
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !isLauncherOrHomePackage(pkg)) {
            val piPkg = detectPiPBypass()
            if (piPkg != null && isBlockActive(piPkg)) {
                Log.d(TAG, "PIP_BYPASS: $piPkg floating over $pkg — blocking.")
                hideIntentGate(); hideBrainrotMeter()
                setWallVisibility(true)
                lastForegroundPackage = piPkg
                return
            }
        }

        // ── 1. Self-protection (Main thread for instant response) ─────────────
        if (isStrictModeEnabled && (isBlockActive("com.shahil.unlink") || isBlockingSuspended)) {
            val isSettings = pkg == "com.android.settings" || pkg.contains("settings", ignoreCase = true)
            val isPackageInstaller = pkg.contains("packageinstaller", ignoreCase = true)
            val isMiuiSecurity = pkg == "com.miui.securitycenter" || pkg.contains("securitycenter", ignoreCase = true)
            
            if (isSettings || isPackageInstaller || isMiuiSecurity) {
                val root = rootInActiveWindow
                val nowCheck = System.currentTimeMillis()
                if (nowCheck - lastSelfProtectCheckTime > 300L) { // Debounce checks (300ms)
                    lastSelfProtectCheckTime = nowCheck
                    if (checkSelfProtection(root)) {
                        Toast.makeText(applicationContext, "Focus Mode Active. Control locked. ❤️🩹", Toast.LENGTH_SHORT).show()
                        performGlobalAction(GLOBAL_ACTION_BACK)
                        return
                    }
                }
            }
        }

        // ── 2. Shorts state check ─────────────────────────────────────────────
        if (eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED ||
            eventType == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED) {
            verifyShortsStateSurgical()
        }

        // ── 3. Full block wall ────────────────────────────────────────────────
        // Skip the hard block for surgical apps — they are handled by the intent
        // gate and brainrot meter in step 7 below.
        val isSurgicalApp = (pkg == "com.google.android.youtube" && isSurgicalYoutube) ||
                            (pkg == "com.instagram.android" && isSurgicalInstagram)
        if (!isSurgicalApp && isBlockActive(pkg)) {
            hideIntentGate()
            hideBrainrotMeter()
            setWallVisibility(true)
            lastForegroundPackage = pkg
            return
        }

        // ── 4. Surgical scroll tracking ───────────────────────────────────────
        if ((pkg == "com.google.android.youtube" || pkg == "com.instagram.android") &&
            !isBlockingSuspended && eventType == AccessibilityEvent.TYPE_VIEW_SCROLLED) {
            val surgicalEnabled = if (pkg == "com.google.android.youtube") isSurgicalYoutube else isSurgicalInstagram
            if (surgicalEnabled) handleSurgicalScroll(event, pkg, now)
        }

        // ── 5. App exit/entry tracking ────────────────────────────────────────
        val isTarget = pkg == "com.google.android.youtube" || pkg == "com.instagram.android"
        val wasInTarget = lastForegroundPackage == "com.google.android.youtube" ||
                          lastForegroundPackage == "com.instagram.android"

        if (wasInTarget && !isTarget) {
            prefs.edit().putLong("exit_time_$lastForegroundPackage", now).apply()
            isCurrentlyInShortsMode = false
        }
        if (isTarget && pkg != lastForegroundPackage) {
            val lastExit = prefs.getLong("exit_time_$pkg", 0L)
            val gap = now - lastExit
            if (gap > 5 * 60_000L || last_target_app_entry_time == 0L) {
                last_target_app_entry_time = now; live_reels_in_this_binge = 0; nudge45Shown = false
            }
            if (gap > 30_000L || lastExit < prefs.getLong("session_start_time", 0L)) authorizedApps.remove(pkg)
        }

        // ── 6. Launcher ───────────────────────────────────────────────────────
        if (isLauncherOrHomePackage(pkg)) {
            lastForegroundPackage = pkg
            setWallVisibility(false)
            hideBrainrotMeter()
            return
        }

        // ── 7. Intent gate ────────────────────────────────────────────────────
        if (isTarget && !isBlockingSuspended) {
            val surgicalEnabled = if (pkg == "com.instagram.android") isSurgicalInstagram else isSurgicalYoutube
            if (surgicalEnabled) {
                val gateEnabled = if (pkg == "com.instagram.android") isIgGateEnabled else isYtGateEnabled
                if (gateEnabled && !authorizedApps.contains(pkg)) {
                    showIntentGate(pkg); lastForegroundPackage = pkg; return
                }
            } else if (isBlockActive(pkg)) {
                setWallVisibility(true); lastForegroundPackage = pkg; return
            }
        }

        lastForegroundPackage = pkg
        if (!isNavigatingHome) setWallVisibility(false)
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Surgical scroll (extracted)
    // ─────────────────────────────────────────────────────────────────────────

    private fun handleSurgicalScroll(event: AccessibilityEvent, pkg: String, now: Long) {
        val source = event.source
        val rid = source?.viewIdResourceName ?: ""
        source?.recycle()
        val isDM = rid.contains("direct", ignoreCase = true) ||
                   rid.contains("message", ignoreCase = true) ||
                   rid.contains("chat", ignoreCase = true) ||
                   rid.contains("thread", ignoreCase = true)
        if (isDM) return
        val isReelScroll = (rid.contains("reel", ignoreCase = true) ||
                            rid.contains("short", ignoreCase = true) ||
                            rid.contains("clip", ignoreCase = true)) &&
                           !rid.contains("container", ignoreCase = true)
        if (!isReelScroll) return
        if (now - lastBrainrotScrollTime < 150L) return  // debounce

        if (!isCurrentlyInShortsMode) {
            isCurrentlyInShortsMode = true; isHealing = false
            mainHandler.post(watchTimeRunnable)
        }
        lastBrainrotScrollTime = now; currentReelStartTime = now
        updateLastScrollTimestampPersistent(now)
        live_reels_in_this_binge++
        val bingeMinutes = if (last_target_app_entry_time > 0) (now - last_target_app_entry_time) / 60_000L else 0L
        updateGlobalRot(0.5f * if (bingeMinutes > 45) 1.8f else 1.0f, true)
        showAndUpdateBrainrotMeter()
        if (bingeMinutes > 45 && !nudge45Shown) { showBingeNudgeOverlay(); nudge45Shown = true }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Self-protection (runs on bgHandler — never blocks UI thread)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Returns true ONLY when the user is actively trying to destroy Unlink.
     * Freely browsing settings always returns false.
     */
    private fun checkSelfProtection(node: AccessibilityNodeInfo?): Boolean {
        if (node == null) return false

        val hasUnlinkIdentity = findTextNodesSafely(node, "Unlink") ||
                                findTextNodesSafely(node, "com.shahil.unlink")

        if (!hasUnlinkIdentity) return false

        val hasAppInfoHeader = findTextNodesSafely(node, "App info") ||
                               findTextNodesSafely(node, "Application details")

        val appInfoKeywords = listOf(
            "Force stop", "Uninstall", "Disable", "Force quit", "Stop app", "Force stop?",
            "Clear data", "Storage", "Permissions", "Modify system settings", "Display over other apps"
        )
        val hasDestructiveButtons = appInfoKeywords.any { findTextNodesSafely(node, it) } ||
                                    hasAppInfoResourceId(node)

        if (hasDestructiveButtons && (hasAppInfoHeader || hasUnlinkIdentity)) {
            Log.d(TAG, "SELF_PROTECT: Detected Unlink App Info / Sensitive Setting (Instant) — Kicking back.")
            return true
        }

        val isSensitiveAccessPage = (findTextNodesSafely(node, "Unlink") || findTextNodesSafely(node, "com.shahil.unlink")) &&
                                     hasClickableToggle(node)
 
        if (isSensitiveAccessPage) {
            Log.d(TAG, "SELF_PROTECT: Detected Sensitive/Accessibility toggle for Unlink.")
            return true
        }
 
        val onPermPage = listOf("Display over other apps", "Usage access", "Modify system settings", "Accessibility")
             .any { findTextNodesSafely(node, it) }
 
        if (onPermPage && hasClickableToggle(node)) {
            Log.d(TAG, "SELF_PROTECT: Detected Unlink Permission sub-page toggle.")
            return true
        }
 
        return false
    }

    private fun findTextNodesSafely(node: AccessibilityNodeInfo?, text: String): Boolean {
        if (node == null) return false
        val nodes = node.findAccessibilityNodeInfosByText(text)
        val hasNodes = nodes.isNotEmpty()
        nodes.forEach { it.recycle() }
        return hasNodes
    }

    /**
     * Detects any enabled+clickable toggle widget in the hierarchy.
     * Covers: AOSP Switch, Samsung SecSwitch/OneUI, AppCompatSwitch,
     * CheckBox, ToggleButton, and resource-id heuristics.
     */
    private fun hasClickableToggle(node: AccessibilityNodeInfo?): Boolean {
        if (node == null) return false
        val cls = node.className?.toString()?.lowercase() ?: ""
        val rid = node.viewIdResourceName?.lowercase() ?: ""
        val isToggle = cls.contains("switch") || cls.contains("checkbox") ||
                       cls.contains("togglebutton") || cls.contains("secswitch") ||
                       cls.contains("appcompatswitch") ||
                       rid.contains("switch") || rid.contains("toggle")
        if (isToggle && node.isClickable && node.isEnabled) return true
        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            val result = hasClickableToggle(child)
            child.recycle()
            if (result) return true
        }
        return false
    }

    /**
     * Checks if any node in the hierarchy has a resource ID commonly used for Force Stop/Uninstall.
     * This is much more stable than text across different languages.
     */
    private fun hasAppInfoResourceId(node: AccessibilityNodeInfo?): Boolean {
        if (node == null) return false
        val rid = node.viewIdResourceName?.lowercase() ?: ""
        if (rid.contains("force_stop") || rid.contains("uninstall_button") || 
            rid.contains("right_button") || rid.contains("left_button")) {
            return true
        }
        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            val result = hasAppInfoResourceId(child)
            child.recycle()
            if (result) return true
        }
        return false
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Block checks
    // ─────────────────────────────────────────────────────────────────────────

    private fun isBlockActive(pkg: String): Boolean {
        if (isBlockingSuspended) return false
        val now = System.currentTimeMillis()
        if (blockExpiryTime > now) {
            // A JS session is active — it is the single source of truth.
            // Never fall through to schedule enforcement here; that would allow
            // a schedule with different apps to interfere with the active session.
            if (pkg == "com.shahil.unlink") return true
            return currentBlockedApps.any { pkg.contains(it, ignoreCase = true) }
        }
        // No active JS session — use native schedules for background resilience
        // (handles the case where the app was killed mid-schedule window).
        return checkNativeSchedules(pkg)
    }

    private fun checkNativeSchedulesActive(): Boolean {
        if (isBlockingSuspended) return false
        return checkNativeSchedules("com.shahil.unlink")
    }

    private fun checkNativeSchedules(pkg: String): Boolean {
        val schedules = cachedSchedules
        if (schedules.isEmpty()) return false

        val cal = THREAD_CAL.get()
        cal.timeInMillis = System.currentTimeMillis()
        val todayDayName = DAY_NAMES[cal.get(java.util.Calendar.DAY_OF_WEEK) - 1]
        val todayDateStr = THREAD_DATE_FMT.get()!!.format(cal.time)
        val yesterdayDayName = DAY_NAMES[(cal.get(java.util.Calendar.DAY_OF_WEEK) - 2 + 7) % 7]
        val yesterdayCal = cal.clone() as java.util.Calendar
        yesterdayCal.add(java.util.Calendar.DAY_OF_YEAR, -1)
        val yesterdayDateStr = THREAD_DATE_FMT.get()!!.format(yesterdayCal.time)
        val nowMins = cal.get(java.util.Calendar.HOUR_OF_DAY) * 60 + cal.get(java.util.Calendar.MINUTE)
        val stops = cachedStopRecords

        for (schedule in schedules) {
            if (!schedule.enabled) continue
            val isMidnightCrossing = schedule.endTimeMins <= schedule.startTimeMins
            val isPostMidnight = isMidnightCrossing && nowMins < schedule.endTimeMins
            val effectiveDayName = if (isPostMidnight) yesterdayDayName else todayDayName
            val effectiveDateStr = if (isPostMidnight) yesterdayDateStr else todayDateStr
            if (stops[schedule.id] == effectiveDateStr) continue
            if (!schedule.days.contains(effectiveDayName)) continue
            val inWindow = if (isMidnightCrossing) {
                nowMins >= schedule.startTimeMins || nowMins < schedule.endTimeMins
            } else {
                nowMins >= schedule.startTimeMins && nowMins < schedule.endTimeMins
            }
            if (!inWindow) continue

            if (pkg == "com.shahil.unlink") return true
            if (schedule.appPackages.any { pkg.contains(it, ignoreCase = true) }) return true
        }
        return false
    }

    private fun parseTimeToMinutes(t: String): Int {
        val p = t.split(":")
        return if (p.size >= 2) (p[0].toIntOrNull() ?: 0) * 60 + (p[1].toIntOrNull() ?: 0) else 0
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Config / prefs refresh
    // ─────────────────────────────────────────────────────────────────────────

    fun refreshServiceConfig() {
        bgHandler.post {
            refreshFromDiskInternal()
            mainHandler.post { 
                performSecurityCheck()
                updateWallContent()
            }
        }
        try {
            serviceInfo?.apply {
                eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED or
                             AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED or
                             AccessibilityEvent.TYPE_VIEW_SCROLLED
                packageNames = null
                serviceInfo = this
            }
        } catch (_: Exception) {}
    }

    fun setSuspendedState(suspended: Boolean?) {
        if (suspended == null) { refreshServiceConfig(); return }
        val wasSuspended = isBlockingSuspended
        isBlockingSuspended = suspended
        if (isBlockingSuspended && !wasSuspended) {
            blockRemainingAtSuspension = maxOf(0L, blockExpiryTime - System.currentTimeMillis())
            suspensionStartTime = System.currentTimeMillis()
            prefs.edit().putLong("block_remaining_ms", blockRemainingAtSuspension)
                .putLong("suspension_start_time", suspensionStartTime).commit()
            setWallVisibility(false); hideIntentGate()
            mainHandler.post(breakExpiryRunnable)
            // Schedule "break ending soon" notification 2 min before break expires
            val warningDelay = breakDurationMs - 2 * 60_000L
            if (warningDelay > 0L) {
                mainHandler.postDelayed(breakWarningRunnable, warningDelay)
            }
        } else if (!isBlockingSuspended && wasSuspended) {
            mainHandler.removeCallbacks(breakExpiryRunnable)
            mainHandler.removeCallbacks(breakWarningRunnable)
            (getSystemService(NOTIFICATION_SERVICE) as? NotificationManager)
                ?.cancel(BREAK_WARNING_NOTIF_ID)
            suspensionStartTime = 0L
            val saved = prefs.getLong("block_remaining_ms", 0L)
            if (saved > 0L) {
                blockExpiryTime = System.currentTimeMillis() + saved
                prefs.edit().putLong("block_expiry_time", blockExpiryTime).commit()
            }
            handleUniversalBlockScan()
        }
    }

    private fun refreshFromDiskInternal() {
        try {
            currentBlockedApps         = prefs.getStringSet("blocked_apps", emptySet()) ?: emptySet()
            blockExpiryTime            = prefs.getLong("block_expiry_time", 0L)
            isBlockingSuspended        = prefs.getBoolean("is_blocking_suspended", false)
            blockRemainingAtSuspension = prefs.getLong("block_remaining_ms", 0L)
            suspensionStartTime        = prefs.getLong("suspension_start_time", 0L)
            isSurgicalYoutube          = prefs.getBoolean("surgical_youtube", false)
            isSurgicalInstagram        = prefs.getBoolean("surgical_instagram", false)
            isYtGateEnabled            = prefs.getBoolean("coach_yt_gate", true)
            isIgGateEnabled            = prefs.getBoolean("coach_ig_gate", true)
            isStrictModeEnabled        = prefs.getBoolean("strict_mode", false)
            breaksRemaining            = prefs.getInt("breaks_remaining", 0)
            breakDurationMs            = prefs.getLong("break_duration_ms", 15 * 60 * 1000L)
            
            // Resume break expiry timer if needed
            if (isBlockingSuspended && suspensionStartTime > 0) {
                mainHandler.removeCallbacks(breakExpiryRunnable)
                mainHandler.post(breakExpiryRunnable)
            }
            val today = getCurrentDateString()
            val savedDate = prefs.getString("global_brainrot_date", today) ?: today
            if (savedDate != today) {
                globalBrainrotScore = 0f; globalShortsCount = 0; lastBrainrotDate = today
                prefs.edit().putString("global_brainrot_date", today).apply()
            } else {
                globalBrainrotScore = prefs.getFloat("global_brainrot_score", 0f)
                globalShortsCount   = prefs.getInt("global_shorts_count", 0)
                lastBrainrotDate    = today
            }
            lastBrainrotScrollTime = prefs.getLong("last_scroll_timestamp", System.currentTimeMillis())

            // ─── Parse & Cache Schedules ──────────────────────────────────────
            val schedulesJson = prefs.getString("native_schedules", null)
            val newSchedules = mutableListOf<NativeSchedule>()
            if (schedulesJson != null) {
                try {
                    val array = org.json.JSONArray(schedulesJson)
                    for (i in 0 until array.length()) {
                        val block = array.getJSONObject(i)
                        if (block.optString("type") != "schedule") continue
                        val sched = block.optJSONObject("schedule") ?: continue
                        val daysArr = sched.optJSONArray("days") ?: continue
                        val daysSet = mutableSetOf<String>()
                        for (j in 0 until daysArr.length()) daysSet.add(daysArr.getString(j))
                        
                        val appsArr = block.optJSONArray("apps") ?: continue
                        val appList = mutableListOf<String>()
                        for (k in 0 until appsArr.length()) appList.add(appsArr.getString(k))

                        newSchedules.add(NativeSchedule(
                            id = block.optString("id"),
                            enabled = block.optBoolean("enabled", true),
                            startTimeMins = parseTimeToMinutes(sched.optString("startTime", "")),
                            endTimeMins = parseTimeToMinutes(sched.optString("endTime", "")),
                            days = daysSet,
                            appPackages = appList
                        ))
                    }
                } catch (e: Exception) { Log.e(TAG, "Error parsing schedules for cache: ${e.message}") }
            }
            cachedSchedules = newSchedules

            // ─── Parse & Cache Stop Records ───────────────────────────────────
            val stopsJson = prefs.getString("native_stop_records", "{}") ?: "{}"
            val newStops = mutableMapOf<String, String>()
            try {
                val obj = org.json.JSONObject(stopsJson)
                val keys = obj.keys()
                while (keys.hasNext()) {
                    val key = keys.next()
                    newStops[key] = obj.getString(key)
                }
            } catch (e: Exception) { Log.e(TAG, "Error parsing stop records: ${e.message}") }
            cachedStopRecords = newStops

        } catch (e: Exception) { Log.e(TAG, "refreshFromDisk: ${e.message}") }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Brainrot score
    // ─────────────────────────────────────────────────────────────────────────

    private fun updateGlobalRot(delta: Float, isScroll: Boolean = false) {
        bgHandler.post {
            val today = getCurrentDateString()
            if (lastBrainrotDate != today) { globalBrainrotScore = 0f; globalShortsCount = 0; lastBrainrotDate = today }
            globalBrainrotScore = (globalBrainrotScore + delta).coerceIn(0f, 100f)
            if (isScroll) globalShortsCount++

            prefs.edit().apply {
                putFloat("global_brainrot_score", globalBrainrotScore)
                putInt("global_shorts_count", globalShortsCount)
                putString("global_brainrot_date", lastBrainrotDate)
                apply()
            }

            mainHandler.post {
                val now = System.currentTimeMillis()
                if (blockExpiryTime > now && isCurrentlyInShortsMode) {
                    if (!isShortsLocked && globalBrainrotScore >= SHORTS_LOCK_THRESHOLD) {
                        isShortsLocked = true; enforceShortsLockSurgical()
                    } else if (isShortsLocked && globalBrainrotScore <= SHORTS_UNLOCK_THRESHOLD) {
                        isShortsLocked = false
                        Toast.makeText(this@UnlinkAccessibilityService, "Brain Recovered! Clarity Restored. ❤️🩹", Toast.LENGTH_LONG).show()
                    }
                }
            }
        }
    }

    private fun updateLastScrollTimestampPersistent(ts: Long) {
        lastBrainrotScrollTime = ts
        bgHandler.post {
            prefs.edit().putLong("last_scroll_timestamp", ts).apply()
        }
    }

    private fun getBrainrotDrawable(score: Float): Int {
        val idx = when {
            score >= 86f -> 6; score >= 71f -> 5; score >= 57f -> 4
            score >= 43f -> 3; score >= 29f -> 2; score >= 15f -> 1; else -> 0
        }
        val resId = stageDrawableIds[idx]
        return if (resId != 0) resId else android.R.drawable.ic_dialog_info
    }

    private fun getCurrentDateString(): String {
        val fmt = THREAD_DATE_FMT.get()
        val cal = THREAD_CAL.get()
        cal.timeInMillis = System.currentTimeMillis()
        return fmt.format(cal.time)
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Wall overlay
    // ─────────────────────────────────────────────────────────────────────────

    private fun setWallVisibility(visible: Boolean) {
        mainHandler.post {
            if (overlayView == null) createAbsoluteWall()
            val view = overlayView ?: return@post
            val isShowing = view.parent != null
            if (visible == isShowing) return@post
            if (visible) {
                vibrate(20)
                // Fetch usage stats on background thread — never block the main thread
                val pkgForStats = lastForegroundPackage
                bgHandler.post {
                    val text = getTodayUsageText(pkgForStats)
                    cachedUsageText = text
                    mainHandler.post { updateWallContent() }
                }
                updateWallContent() // show wall immediately with cached value; refreshes once bg fetch returns
                if (android.provider.Settings.canDrawOverlays(this)) {
                    try {
                        windowManager?.addView(view, view.layoutParams as WindowManager.LayoutParams)
                        mainHandler.post(countdownRunnable)
                    } catch (_: Exception) {}
                }
            } else {
                try {
                    if (view.parent != null) windowManager?.removeView(view)
                    mainHandler.removeCallbacks(countdownRunnable)
                } catch (_: Exception) {}
            }
        }
    }

    private fun createAbsoluteWall() {
        if (windowManager == null) windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        val layoutId = resources.getIdentifier("blocking_overlay_full", "layout", packageName)
        overlayView = if (layoutId != 0)
            (getSystemService(LAYOUT_INFLATER_SERVICE) as LayoutInflater).inflate(layoutId, null)
        else createFailsafeView()
        overlayView?.findViewById<Button>(idGoHomeButton)?.setOnClickListener { goHome() }
        overlayView?.findViewById<Button>(idTakeBreakButton)?.setOnClickListener { requestBreak() }
        overlayView?.layoutParams = WindowManager.LayoutParams(
            -1, -1,
            WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or
            WindowManager.LayoutParams.FLAG_DIM_BEHIND,
            PixelFormat.TRANSLUCENT
        ).apply { dimAmount = 1.0f; windowAnimations = android.R.style.Animation_InputMethod }
    }

    private fun updateWallContent() {
        val overlay = overlayView ?: return
        overlay.findViewById<ImageView>(idRotMascot)?.apply {
            setImageResource(getBrainrotDrawable(globalBrainrotScore))
            mascotAnimator?.cancel()
            mascotAnimator = ObjectAnimator.ofFloat(this, "translationY", -15f, 15f).apply {
                duration = 2500L; repeatMode = ValueAnimator.REVERSE
                repeatCount = ValueAnimator.INFINITE
                interpolator = AccelerateDecelerateInterpolator(); start()
            }
        }
        overlay.findViewById<TextView>(idRotStatusText)?.text =
            "Your Brain is at ${globalBrainrotScore.toInt()}% Rot"
        val usageStats = cachedUsageText
        val (main, sub) = when {
            globalBrainrotScore >= 60f ->
                "You've been scrolling heavily today." to (usageStats ?: "This break is saving your brain from further damage.")
            isCurrentlyInShortsMode ->
                "Shorts & Reels are locked to protect you." to (usageStats ?: "DMs are still open if you need them.")
            else ->
                "You chose to protect your focus today." to (usageStats ?: "Your brain is already starting to feel clearer ❤️🩹")
        }
        overlay.findViewById<TextView>(idMessageText)?.text = main
        overlay.findViewById<TextView>(idCoachSubText)?.text = sub
        overlay.findViewById<Button>(idTakeBreakButton)?.apply {
            text = if (breaksRemaining > 0) "TAKE A BREAK ($breaksRemaining LEFT)" else "NO BREAKS LEFT"
            visibility = if (breaksRemaining > 0) View.VISIBLE else View.GONE
        }
    }

    private fun updateOverlayTimer() {
        val remaining = if (isBlockingSuspended) blockRemainingAtSuspension
                        else blockExpiryTime - System.currentTimeMillis()
        
        if (remaining <= 0 && !isBlockingSuspended) {
            if (blockExpiryTime > 0L) teardownAllBlocks(); return
        }
        val total = maxOf(0L, remaining / 1000)
        val h = total / 3600
        val m = (total % 3600) / 60
        val s = total % 60
        
        val timerText = when {
            h > 0 -> String.format("%dh %02dm %02ds", h, m, s)
            m > 0 -> String.format("%dm %02ds", m, s)
            else -> String.format("%02ds", s)
        }
        
        overlayView?.findViewById<TextView>(idTimerText)?.text = timerText
    }

    private fun teardownAllBlocks() {
        prefs.edit().apply {
            putStringSet("blocked_apps", emptySet())
            putBoolean("is_blocking_suspended", false)
            putLong("block_expiry_time", 0L)
            commit()
        }
        updateGlobalRot(-30f)
        Toast.makeText(this, "Focus Protocol Completed. Brain Restored ❤️🩹 +30%", Toast.LENGTH_LONG).show()
        isNavigatingHome = false
        refreshServiceConfig(); setWallVisibility(false); hideBrainrotMeter(); hideIntentGate()
    }

    private fun createFailsafeView(): View = FrameLayout(this).apply {
        setBackgroundColor(Color.BLACK)
        addView(TextView(this@UnlinkAccessibilityService).apply {
            text = "FOCUS_PROTOCOL_ENGAGED"; setTextColor(Color.WHITE); gravity = Gravity.CENTER
        }, FrameLayout.LayoutParams(-2, -2, Gravity.CENTER))
        addView(Button(this@UnlinkAccessibilityService).apply {
            text = "GO HOME"; setOnClickListener { goHome() }
        }, FrameLayout.LayoutParams(-1, 200, Gravity.BOTTOM).apply { setMargins(50, 50, 50, 100) })
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Navigation helpers
    // ─────────────────────────────────────────────────────────────────────────

    private fun goHome() {
        isNavigatingHome = true
        try { startActivity(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
        catch (_: Exception) {}
        mainHandler.postDelayed({ isNavigatingHome = false; performSecurityCheck() }, 350L)
    }

    private fun requestBreak() {
        if (isProcessingBreak || breaksRemaining <= 0) return
        isProcessingBreak = true
        suspensionStartTime = System.currentTimeMillis()
        blockRemainingAtSuspension = maxOf(0L, blockExpiryTime - System.currentTimeMillis())
        
        prefs.edit().apply {
            putBoolean("is_blocking_suspended", true)
            putLong("block_remaining_ms", blockRemainingAtSuspension)
            putLong("suspension_start_time", suspensionStartTime)
            putInt("breaks_remaining", --breaksRemaining)
            commit()
        }
        
        setWallVisibility(false)
        isBlockingSuspended = true
        sendBroadcast(Intent("com.shahil.unlink.REQUEST_BREAK").setPackage(packageName))
        
        mainHandler.post(breakExpiryRunnable)
        mainHandler.postDelayed({ isProcessingBreak = false }, 2000L)
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Intent gate
    // ─────────────────────────────────────────────────────────────────────────

    private fun showIntentGate(pkg: String) {
        if (gateOverlayView != null || isGateInflationPending) return
        isGateInflationPending = true
        mainHandler.post {
            try {
            if (gateOverlayView != null) {
                isGateInflationPending = false
                return@post
            }
                val layoutId = resources.getIdentifier("overlay_intent_gate", "layout", packageName)
                if (layoutId == 0) return@post
                gateOverlayView = (getSystemService(LAYOUT_INFLATER_SERVICE) as LayoutInflater).inflate(layoutId, null)
                val appName = if (pkg == "com.google.android.youtube") "YouTube" else "Instagram"
                gateOverlayView?.findViewById<TextView>(idIntentQuestion)?.text = "Why are you opening\n$appName today?"
                if (idBrainStatusText != 0) {
                    val emoji = when { globalBrainrotScore > 75f -> "🧟"; globalBrainrotScore > 50f -> "🤢"; globalBrainrotScore > 20f -> "🤔"; else -> "🧠" }
                    val status = when { globalBrainrotScore > 80f -> "CRITICAL ROT"; globalBrainrotScore > 60f -> "HEAVY ROT"; globalBrainrotScore > 40f -> "STARTING TO ROT"; globalBrainrotScore > 20f -> "MILD FOG"; else -> "FRESH BRAIN" }
                    gateOverlayView?.findViewById<TextView>(idBrainStatusText)?.text = "$emoji ${"%.1f".format(globalBrainrotScore)}% $status"
                }
                // Passive healing check (done on bg thread)
                bgHandler.post {
                    val lastScroll = prefs.getLong("last_scroll_timestamp", 0L)
                    if (lastScroll > 0L) {
                        val hours = (System.currentTimeMillis() - lastScroll) / (1000 * 60 * 60)
                        if (hours >= 1 && globalBrainrotScore > 0f) {
                            val heal = minOf(hours * 10f, globalBrainrotScore)
                            updateGlobalRot(-heal)
                            prefs.edit().putLong("last_scroll_timestamp", System.currentTimeMillis()).apply()
                            mainHandler.post {
                                gateOverlayView?.findViewById<TextView>(idWinLineText)?.apply {
                                    text = "RECOVERY: +${heal.toInt()}% Brain Restoration earned during your ${hours}h break! 🔥"
                                    setTextColor(Color.parseColor("#72FE88"))
                                }
                            }
                        }
                    }
                }
                gateOverlayView?.findViewById<View>(idDmOnlyButton)?.setOnClickListener { authorizeSession(pkg, -15f, "DMs only = brain saved 😎 +15%") }
                gateOverlayView?.findViewById<View>(idLongVideosButton)?.setOnClickListener { authorizeSession(pkg, -6f, "Long videos only! +6%") }
                gateOverlayView?.findViewById<View>(idReelsLimitButton)?.setOnClickListener { authorizeSession(pkg, -8f, "Respecting your limits! +8%") }
                gateOverlayView?.findViewById<View>(idFullFocusButton)?.setOnClickListener { authorizeSession(pkg, -25f, "Focus Session started! +25%") }
                gateOverlayView?.findViewById<View>(idCancelButton)?.setOnClickListener {
                    hideIntentGate(); goHome(); updateGlobalRot(-10f)
                    Toast.makeText(applicationContext, "Brain Saved ❤️🩹 +10%", Toast.LENGTH_SHORT).show()
                }
                windowManager?.addView(gateOverlayView, WindowManager.LayoutParams(
                    -1, -1, WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                    WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                    PixelFormat.TRANSLUCENT))
                startGateCountdown()
            } catch (e: Exception) { Log.e(TAG, "showIntentGate: ${e.message}") }
            finally { isGateInflationPending = false }
        }
    }

    private fun startGateCountdown() {
        gateCountdown = 0
        val runnable = object : Runnable {
            override fun run() {
                if (gateCountdown > 0) {
                    gateOverlayView?.findViewById<TextView>(idCalmTimerText)?.text = gateCountdown.toString()
                    gateCountdown--; mainHandler.postDelayed(this, 1000L)
                } else {
                    gateOverlayView?.findViewById<View>(idCalmContainer)?.visibility = View.GONE
                    gateOverlayView?.findViewById<View>(idActionContainer)?.apply {
                        visibility = View.VISIBLE; alpha = 0f; animate().alpha(1f).setDuration(400).start()
                    }
                }
            }
        }
        mainHandler.post(runnable)
    }

    private fun authorizeSession(pkg: String, healingDelta: Float = 0f, message: String = "") {
        if (healingDelta < 0f) {
            updateGlobalRot(healingDelta)
            Toast.makeText(applicationContext, message.ifEmpty { "Brain Healing ❤️🩹 ${-healingDelta}%" }, Toast.LENGTH_SHORT).show()
        }
        authorizedApps.add(pkg); hideIntentGate(); vibrate(50)
    }

    private fun hideIntentGate() {
        mainHandler.post {
            gateOverlayView?.let { safeRemoveView(it); gateOverlayView = null }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Brainrot meter
    // ─────────────────────────────────────────────────────────────────────────

    private fun showAndUpdateBrainrotMeter() {
        if (!isCurrentlyInShortsMode || isNavigatingHome || isBlockingSuspended) {
            hideBrainrotMeter(); return
        }
        mainHandler.post {
            try {
                if (brainrotOverlayView == null) {
                    if (isNavigatingHome) return@post
                    val layoutId = resources.getIdentifier("overlay_brainrot_meter", "layout", packageName)
                    if (layoutId == 0) return@post
                    brainrotOverlayView = (getSystemService(LAYOUT_INFLATER_SERVICE) as LayoutInflater).inflate(layoutId, null)
                    windowManager?.addView(brainrotOverlayView, WindowManager.LayoutParams(
                        WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT,
                        WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                        WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                        WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                        PixelFormat.TRANSLUCENT
                    ).apply { gravity = Gravity.TOP or Gravity.END; y = 150; x = 40 })
                }
                val view = brainrotOverlayView ?: return@post
                view.findViewById<TextView>(idBrainrotCount)?.text = "%.0f%%".format(globalBrainrotScore)
                view.findViewById<ImageView>(idBrainrotMascot)?.apply {
                    setImageResource(getBrainrotDrawable(if (isHealing) 0f else globalBrainrotScore))
                    brainrotMascotAnimator?.cancel()
                    brainrotMascotAnimator = ObjectAnimator.ofFloat(this, "translationY", -15f, 15f).apply {
                        duration = 2500L; repeatMode = ValueAnimator.REVERSE
                        repeatCount = ValueAnimator.INFINITE
                        interpolator = AccelerateDecelerateInterpolator(); start()
                    }
                }
                val bg = view.findViewById<View>(idBrainrotContainer)?.background as? android.graphics.drawable.GradientDrawable
                bg?.setColor(Color.parseColor(when {
                    isHealing               -> "#CC228822"
                    globalBrainrotScore > 80f -> "#CCAA0000"
                    globalBrainrotScore > 60f -> "#CCAA3300"
                    globalBrainrotScore > 40f -> "#CCAA7700"
                    globalBrainrotScore > 20f -> "#CC55AA00"
                    else                    -> "#99000000"
                }))
                if (view.alpha == 0f) view.animate().alpha(1f).setDuration(300).start()
                else view.animate().scaleX(1.1f).scaleY(1.1f).setDuration(100)
                    .withEndAction { view.animate().scaleX(1f).scaleY(1f).setDuration(100).start() }.start()
                mainHandler.removeCallbacks(brainrotHideRunnable)
                mainHandler.postDelayed(brainrotHideRunnable, 4000L)
            } catch (_: Exception) {}
        }
    }

    private fun hideBrainrotMeter() {
        mainHandler.post {
            brainrotOverlayView?.let { view ->
                view.animate().alpha(0f).setDuration(300)
                    .withEndAction { safeRemoveView(view); brainrotOverlayView = null }.start()
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Shorts verification
    // ─────────────────────────────────────────────────────────────────────────

    private fun verifyShortsStateSurgical() {
        val now = System.currentTimeMillis()
        if (isBlockingSuspended) { hideBrainrotMeter(); return }
        val root = rootInActiveWindow ?: return
        val pkg = root.packageName?.toString() ?: return
        if (pkg != "com.google.android.youtube" && pkg != "com.instagram.android") return
        // Allow both timed blocks (blockExpiryTime) AND native schedule windows
        val isAnyBlockActive = blockExpiryTime > now || checkNativeSchedulesActive()
        if (!isAnyBlockActive) {
            if (isCurrentlyInShortsMode) { isCurrentlyInShortsMode = false; hideBrainrotMeter(); mainHandler.removeCallbacks(watchTimeRunnable) }; return
        }
        val surgical = if (pkg == "com.google.android.youtube") isSurgicalYoutube else isSurgicalInstagram
        if (!surgical) {
            if (isCurrentlyInShortsMode) { isCurrentlyInShortsMode = false; hideBrainrotMeter(); mainHandler.removeCallbacks(watchTimeRunnable) }; return
        }
        bgHandler.post {
            val inShorts = isShortsModeSurgicalRecursive(root, pkg)
            mainHandler.post {
                if (inShorts && isShortsLocked) { enforceShortsLockSurgical(); return@post }
                if (inShorts && !isCurrentlyInShortsMode) {
                    isCurrentlyInShortsMode = true; currentReelStartTime = now
                    mainHandler.post(watchTimeRunnable); showAndUpdateBrainrotMeter()
                } else if (!inShorts && isCurrentlyInShortsMode) {
                    isCurrentlyInShortsMode = false; hideBrainrotMeter(); mainHandler.removeCallbacks(watchTimeRunnable)
                }
            }
        }
    }

    private fun enforceShortsLockSurgical() {
        val now = System.currentTimeMillis()
        if (now - lastLockActionTime < 2000L) return
        lastLockActionTime = now
        Toast.makeText(this, "SHORTS LOCKED: Brain will heal when you stay out of Reels/Shorts.", Toast.LENGTH_LONG).show()
        performGlobalAction(GLOBAL_ACTION_BACK)
        isCurrentlyInShortsMode = false; hideBrainrotMeter(); mainHandler.removeCallbacks(watchTimeRunnable)
    }

    private fun getTodayUsageText(pkg: String?): String? {
        if (pkg.isNullOrEmpty()) return null
        return try {
            val usm = getSystemService(USAGE_STATS_SERVICE) as UsageStatsManager
            val cal = THREAD_CAL.get()
            cal.timeInMillis = System.currentTimeMillis()
            cal.set(java.util.Calendar.HOUR_OF_DAY, 0)
            cal.set(java.util.Calendar.MINUTE, 0)
            cal.set(java.util.Calendar.SECOND, 0)
            cal.set(java.util.Calendar.MILLISECOND, 0)
            val totalMs = usm.queryAndAggregateUsageStats(cal.timeInMillis, System.currentTimeMillis())[pkg]?.totalTimeInForeground ?: 0L
            val totalMins = totalMs / 60_000L
            if (totalMins < 1L) return null
            val appName = try { packageManager.getApplicationLabel(packageManager.getApplicationInfo(pkg, 0)).toString() } catch (_: Exception) { return null }
            val h = totalMins / 60; val m = totalMins % 60
            if (h > 0L) "You've spent ${h}h ${m}m on $appName today." else "You've spent ${m}m on $appName today."
        } catch (_: Exception) { null }
    }

    private fun showBreakWarningNotification() {
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        val intent = packageManager.getLaunchIntentForPackage(packageName)
        val pi = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val notif = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle("Break Ending in 2 Minutes")
            .setContentText("Your break is almost over. Get ready to refocus.")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pi)
            .setAutoCancel(true)
            .build()
        nm.notify(BREAK_WARNING_NOTIF_ID, notif)
    }

    private fun checkAllWindowsForBlockedApps() {
        if (isBlockingSuspended) return
        try {
            val allWindows = windows ?: return
            for (window in allWindows) {
                val root = window.root ?: continue
                val pkg = root.packageName?.toString()
                root.recycle()
                if (pkg == null || pkg == packageName || isLauncherOrHomePackage(pkg)) continue
                if (isBlockActive(pkg)) {
                    Log.d(TAG, "SPLIT_SCREEN: $pkg in secondary window — blocking.")
                    setWallVisibility(true)
                    lastForegroundPackage = pkg
                    return
                }
            }
        } catch (_: Exception) {}
    }

    private fun detectPiPBypass(): String? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return null
        val windows = windows ?: return null
        for (window in windows) {
            if (window.type == 5 /* AccessibilityWindowInfo.TYPE_PICTURE_IN_PICTURE */) {
                val root = window.root ?: continue
                val pkg = root.packageName?.toString() ?: continue
                root.recycle()
                window.recycle()
                return pkg
            }
            window.recycle()
        }
        return null
    }

    private fun isShortsModeSurgicalRecursive(node: AccessibilityNodeInfo?, pkg: String): Boolean {
        if (node == null) return false
        val ids = if (pkg == "com.google.android.youtube") YT_SHORTS_IDS else IG_REELS_IDS
        for (id in ids) {
            val matches = node.findAccessibilityNodeInfosByViewId(id)
            val found = matches.any { it.isVisibleToUser }
            matches.forEach { it.recycle() }
            if (found) return true
        }
        if (pkg == "com.instagram.android") return findSurgicalContainerByStructure(node, 0)
        return false
    }

    private fun findSurgicalContainerByStructure(node: AccessibilityNodeInfo?, depth: Int): Boolean {
        if (node == null || depth > 5) return false
        val cls = node.className?.toString() ?: ""
        val rid = node.viewIdResourceName ?: ""
        if (rid.contains("feed_recycler", ignoreCase = true) ||
            rid.contains("action_bar_container", ignoreCase = true) ||
            rid.contains("toolbar", ignoreCase = true)) return false
        if ((node.isScrollable || cls.contains("ViewPager") || cls.contains("RecyclerView")) && depth > 0) {
            val rect = Rect(); node.getBoundsInScreen(rect)
            if (rect.height() > resources.displayMetrics.heightPixels * 0.9f) {
                if (rid.contains("reel", ignoreCase = true) || rid.contains("clip", ignoreCase = true)) return true
                if (cls.contains("ViewPager2") || cls.contains("ViewPager")) {
                    for (i in 0 until minOf(node.childCount, 5)) {
                        val child = node.getChild(i) ?: continue
                        val crid = child.viewIdResourceName ?: ""
                        val match = crid.contains("reel", ignoreCase = true) || crid.contains("clip", ignoreCase = true)
                        child.recycle()
                        if (match) return true
                    }
                }
            }
        }
        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            val result = findSurgicalContainerByStructure(child, depth + 1)
            child.recycle()
            if (result) return true
        }
        return false
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Binge nudge
    // ─────────────────────────────────────────────────────────────────────────

    private fun showBingeNudgeOverlay() {
        mainHandler.post {
            try {
                if (bingeNudgeOverlayView?.parent != null) return@post
                val layoutId = resources.getIdentifier("overlay_binge_nudge", "layout", packageName)
                if (layoutId == 0) return@post
                bingeNudgeOverlayView = (getSystemService(LAYOUT_INFLATER_SERVICE) as LayoutInflater).inflate(layoutId, null)
                bingeNudgeOverlayView?.findViewById<View>(idBingeNudgeTakeBreak)?.setOnClickListener {
                    safeRemoveView(bingeNudgeOverlayView); bingeNudgeOverlayView = null
                    goHome(); updateGlobalRot(-12f)
                    Toast.makeText(applicationContext, "Break taken! Brain is healing ❤️🩹 +12%", Toast.LENGTH_SHORT).show()
                    last_target_app_entry_time = System.currentTimeMillis()
                }
                bingeNudgeOverlayView?.findViewById<View>(idBingeNudgeContinue)?.setOnClickListener {
                    safeRemoveView(bingeNudgeOverlayView); bingeNudgeOverlayView = null
                }
                windowManager?.addView(bingeNudgeOverlayView, WindowManager.LayoutParams(
                    -1, -1, WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                    WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                    PixelFormat.TRANSLUCENT))
                vibrate(200)
            } catch (_: Exception) {}
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Launcher detection
    // ─────────────────────────────────────────────────────────────────────────

    private fun getLauncherPackageName(): String {
        cachedLauncherPackage?.let { return it }
        val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
        val pkg = packageManager.resolveActivity(intent, android.content.pm.PackageManager.MATCH_DEFAULT_ONLY)
            ?.activityInfo?.packageName ?: "com.google.android.launcher"
        cachedLauncherPackage = pkg
        return pkg
    }

    private fun isLauncherOrHomePackage(pkg: String?): Boolean {
        if (pkg == null) return false
        val launcher = getLauncherPackageName()
        return pkg == launcher || pkg == "com.android.launcher"
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Security check / scan
    // ─────────────────────────────────────────────────────────────────────────

    private fun performSecurityCheck() {
        val pkg = rootInActiveWindow?.packageName?.toString() ?: getForegroundAppViaUsageStats() ?: return
        if (isLauncherOrHomePackage(pkg) || pkg == packageName) {
            if (!isNavigatingHome) setWallVisibility(false); return
        }
        if (isBlockActive(pkg)) { setWallVisibility(true); return }
        if (pkg == "com.google.android.youtube" || pkg == "com.instagram.android") {
            val surgical = if (pkg == "com.google.android.youtube") isSurgicalYoutube else isSurgicalInstagram
            if (surgical && !authorizedApps.contains(pkg)) { showIntentGate(pkg); return }
        }
        if (!isNavigatingHome) setWallVisibility(false)
    }

    private fun handleUniversalBlockScan() {
        // Reduced from 6 checks to 3 for battery savings
        longArrayOf(0, 300, 900).forEach { d ->
            mainHandler.postDelayed({ performSecurityCheck() }, d)
        }
    }

    private fun getForegroundAppViaUsageStats(): String? = try {
        val usm = getSystemService(USAGE_STATS_SERVICE) as UsageStatsManager
        val now = System.currentTimeMillis()
        val events = usm.queryEvents(now - 5000, now)
        val event = UsageEvents.Event()
        var last: String? = null
        while (events.hasNextEvent()) { events.getNextEvent(event); if (event.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND) last = event.packageName }
        last
    } catch (_: Exception) { null }

    // ─────────────────────────────────────────────────────────────────────────
    // Notification
    // ─────────────────────────────────────────────────────────────────────────

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val serviceChannel = NotificationChannel(
                CHANNEL_ID,
                "Unlink Protection Service",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Ensures Unlink remains active during focus sessions"
                setShowBadge(false)
            }
            (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(serviceChannel)
        }
    }

    private fun createNotification(): Notification {
        val pi = PendingIntent.getActivity(this, 0, packageManager.getLaunchIntentForPackage(packageName), PendingIntent.FLAG_IMMUTABLE)
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Unlink Protection Active")
            .setContentText("Your focus is being protected")
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .setContentIntent(pi)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setOngoing(true)
            .build()
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        Log.d(TAG, "onTaskRemoved detected — Unlink will self-heal in 1s.")
        val restartIntent = Intent(applicationContext, UnlinkAccessibilityService::class.java)
        val pending = android.app.PendingIntent.getService(
            applicationContext, 2,
            restartIntent,
            android.app.PendingIntent.FLAG_ONE_SHOT or android.app.PendingIntent.FLAG_IMMUTABLE
        )
        val alarmManager = getSystemService(Context.ALARM_SERVICE) as android.app.AlarmManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarmManager.canScheduleExactAlarms()) {
            alarmManager.setAndAllowWhileIdle(
                android.app.AlarmManager.ELAPSED_REALTIME_WAKEUP,
                android.os.SystemClock.elapsedRealtime() + 1000L,
                pending
            )
        } else {
            alarmManager.setExactAndAllowWhileIdle(
                android.app.AlarmManager.ELAPSED_REALTIME_WAKEUP,
                android.os.SystemClock.elapsedRealtime() + 1000L,
                pending
            )
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Vibration
    // ─────────────────────────────────────────────────────────────────────────

    private fun vibrate(duration: Long) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                vibrator.vibrate(VibrationEffect.createOneShot(duration, VibrationEffect.DEFAULT_AMPLITUDE))
            else @Suppress("DEPRECATION") vibrator.vibrate(duration)
        } catch (_: Exception) {}
    }
}
