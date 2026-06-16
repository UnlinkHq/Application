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
    @Volatile private var lastUnlinkSettingsSeen = 0L
    // Timestamp we last confirmed being on Unlink's OWN App Info. Arms the overlay-detail
    // guard: that detail page renders only a toggle (no app name), so it can't be identified
    // alone — but it's reached directly from App Info. Armed for a few seconds and cleared
    // the instant any neutral screen appears, so it can NEVER bounce unrelated pages.
    @Volatile private var armedFromUnlinkAppInfoAt = 0L
    // Dedup key so the 400ms watchdog doesn't flood logcat with identical lines.
    @Volatile private var lastDiagSig = ""
    @Volatile private var cachedLauncherPackage: String? = null

    // ─── Thread-safe authorized apps set ─────────────────────────────────────
    private val authorizedApps = java.util.Collections.synchronizedSet(mutableSetOf<String>())
    private var gateCountdown = 3

    // ─── Cached Schedules (parsed once per refresh; evaluated via ScheduleEvaluator) ──
    @Volatile private var cachedSchedules: List<ScheduleEvaluator.Schedule> = emptyList()
    @Volatile private var cachedStopRecords: Map<String, String> = emptyMap()

    // Usage stats cached off-thread so updateWallContent() never blocks main thread
    @Volatile private var cachedUsageText: String? = null

    // ─── Views ────────────────────────────────────────────────────────────────
    private var windowManager: WindowManager? = null
    private var overlayView: View? = null
    private var gateOverlayView: View? = null
    private var brainrotOverlayView: View? = null
    private var bingeNudgeOverlayView: View? = null
    private var shieldOverlayView: View? = null
    private val shieldDismissRunnable = Runnable { hideSelfProtectShield() }
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
            // Heartbeat: lets us detect later if the engine was killed mid-session.
            prefs.edit().putLong("last_engine_heartbeat", now).apply()
            if (blockExpiryTime in 1..now && !isBlockingSuspended) {
                Log.d(TAG, "Session expired. Tearing down.")
                teardownAllBlocks()
            }
            val scheduleActive = checkNativeSchedulesActive()
            if (!isBlockingSuspended && (blockExpiryTime > now || scheduleActive)) {
                // Periodic multi-window scan: catches blocked apps sitting in a background
                // split-screen pane that haven't fired TYPE_WINDOW_STATE_CHANGED yet.
                // Runs every 10s — same cadence as this heartbeat, zero event overhead.
                checkAllWindowsForBlockedApps()
            } else if (!isBlockingSuspended && overlayView?.parent != null) {
                // Nothing should be blocked right now (schedule window ended, no manual
                // session active) yet the wall is still on screen. The user is stuck behind
                // it and can't generate accessibility events to trigger a re-evaluation, and
                // the end-alarm may be inexact/delayed. This timer-based teardown is the
                // reliable path that lowers a schedule wall within 10s of the window ending.
                Log.d(TAG, "Heartbeat: no active block but wall is up — tearing down.")
                setWallVisibility(false)
                hideIntentGate()
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
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, createNotification(), android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(NOTIFICATION_ID, createNotification())
        }
        // Clear stale shutdown marker on connect
        prefs.edit().putLong("last_shutdown_watchdog", 0L).apply()
        // Detect a mid-session engine kill (force-stop / OEM) that happened while we were dead.
        detectIntegrityBreakOnConnect()
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

    /**
     * Runs when the accessibility engine (re)binds — including right after the user reopens the
     * app following a force-stop. If our last heartbeat is stale while a session was still meant
     * to be enforcing, the engine was killed mid-session. We latch a one-shot "integrity break"
     * flag for the JS layer to surface (streak break + accountability), unless the silence is
     * explained by the device simply being powered off (a reboot, not a deliberate kill).
     */
    private fun detectIntegrityBreakOnConnect() {
        try {
            val now = System.currentTimeMillis()
            val lastBeat = prefs.getLong("last_engine_heartbeat", 0L)
            val expiry = prefs.getLong("block_expiry_time", 0L)
            val start = prefs.getLong("session_start_time", 0L)
            val suspended = prefs.getBoolean("is_blocking_suspended", false)
            if (lastBeat <= 0L || start <= 0L || suspended) return
            val sessionWasActive = expiry > lastBeat   // engine last beat while time remained
            val silence = now - lastBeat
            val uptime = android.os.SystemClock.elapsedRealtime()
            val explainedByReboot = uptime < silence + 5_000L  // device was off for the gap
            if (sessionWasActive && silence > 60_000L && !explainedByReboot) {
                val alreadyReported = prefs.getLong("integrity_reported_session", 0L)
                if (alreadyReported != start) {
                    prefs.edit()
                        .putBoolean("integrity_break_pending", true)
                        .putLong("integrity_break_silence_ms", silence)
                        .putLong("integrity_break_session_start", start)
                        .putLong("integrity_reported_session", start)
                        .apply()
                    Log.d(TAG, "INTEGRITY_BREAK: engine killed mid-session (silent ${silence / 1000}s).")
                }
            }
        } catch (_: Exception) {}
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
        safeRemoveView(shieldOverlayView);    shieldOverlayView = null
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
            // A schedule/session window may have just ended while its wall was showing.
            // No code below this fast-path runs, so tear the wall down explicitly here —
            // otherwise the overlay stays stuck on screen past the schedule end time.
            if (overlayView?.parent != null) setWallVisibility(false)
            return
        }

        if (eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED &&
            eventType != AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED &&
            eventType != AccessibilityEvent.TYPE_VIEW_SCROLLED) return

        val pkg = rootInActiveWindow?.packageName?.toString()
            ?: event.packageName?.toString()
            ?: return
        if (pkg == packageName) return

        // Drop the self-protection shield + stop the watchdog the instant the user is
        // no longer on a settings/security surface (e.g. bounced home) — keeps it lag-free.
        if (!isSelfProtectSurface(pkg)) {
            mainHandler.removeCallbacks(selfProtectWatchdog)
            if (shieldOverlayView != null) hideSelfProtectShield()
        }

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

        // ── 1. Self-protection — ONLY runs when user has explicitly enabled Strict Mode.
        //    When Strict Mode is OFF this entire block is skipped — settings, force-stop,
        //    and uninstall all work normally. This mirrors how Regain / parental-control
        //    apps handle committed focus sessions: user opts in, user controls the pin.
        if (isSelfProtectSurface(pkg)) {
            val sessionActive = isBlockActive("com.shahil.unlink")
            if (!isStrictModeEnabled || !sessionActive) {
                // On a settings/security screen but the guard is OFF — this is the #1 reason
                // "it doesn't bounce". Surfaced so the logs make it obvious.
                diag("gateoff:$pkg:$isStrictModeEnabled:$sessionActive",
                     "[$pkg] GUARD INACTIVE (strictMode=$isStrictModeEnabled session=$sessionActive) — allowing, no protection")
            }
        }

        if (isStrictModeEnabled && isBlockActive("com.shahil.unlink")) {
            if (isSelfProtectSurface(pkg)) {
                // Keep a fast watchdog alive while parked on a dangerous surface so a
                // static screen / first-frame timing miss can't slip through. Re-armed
                // idempotently; the runnable self-terminates once we leave the surface.
                mainHandler.removeCallbacks(selfProtectWatchdog)
                mainHandler.postDelayed(selfProtectWatchdog, 400L)
                val root = rootInActiveWindow
                val nowCheck = System.currentTimeMillis()
                if (nowCheck - lastSelfProtectCheckTime > 300L) { // Debounce checks (300ms)
                    lastSelfProtectCheckTime = nowCheck
                    if (checkSelfProtection(root)) {
                        lastUnlinkSettingsSeen = nowCheck
                        // Cover the buttons FIRST (wins the race even if BACK is slow), then bounce.
                        showSelfProtectShield()
                        Toast.makeText(applicationContext, "Focus Mode Active. Control locked. ❤️🩹", Toast.LENGTH_SHORT).show()
                        performGlobalAction(GLOBAL_ACTION_BACK)
                        return
                    }
                    // Force-stop / uninstall CONFIRM dialogs ("Force stop?", "Do you want to
                    // uninstall this app?") usually drop the app name, so checkSelfProtection
                    // can't see "Unlink" and misses them. If we were JUST on Unlink's own App
                    // Info screen, treat such a dialog as the same destructive intent and bounce
                    // it too — this closes the small race where a fast tap reaches the dialog.
                    if (nowCheck - lastUnlinkSettingsSeen < 4000L && looksLikeDestructiveConfirm(root)) {
                        showSelfProtectShield()
                        Toast.makeText(applicationContext, "Focus Mode Active. Control locked. ❤️🩹", Toast.LENGTH_SHORT).show()
                        performGlobalAction(GLOBAL_ACTION_BACK)
                        return
                    }
                    // On a settings/security surface but nothing destructive — drop any stale shield.
                    hideSelfProtectShield()
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

    /** Deduped diagnostic logging — filter with `adb logcat -s UnlinkWarden`. */
    private fun diag(sig: String, msg: String) {
        if (sig == lastDiagSig) return
        lastDiagSig = sig
        Log.d(TAG, "DIAG $msg")
    }

    /**
     * Returns true ONLY when the user is actively trying to destroy Unlink.
     * Freely browsing settings always returns false.
     */
    private fun checkSelfProtection(node: AccessibilityNodeInfo?): Boolean {
        if (node == null) return false
        val now = System.currentTimeMillis()
        val pkg = node.packageName?.toString() ?: "?"

        // Locale-proof identity: the app label "Unlink" never translates, and these are
        // its own package ids. We ONLY ever act when one of these is actually on screen
        // (or — narrow exception below — we just came straight from Unlink's App Info).
        val hasUnlinkIdentity = findTextNodesSafely(node, "Unlink") ||
                                findTextNodesSafely(node, "com.unlink") ||
                                findTextNodesSafely(node, "com.shahil.unlink")

        // Precise App-Info signature. The header, the force-stop/uninstall resource IDs, or
        // "Uninstall" AND "Force stop" together only co-occur on the real App Info detail
        // page — never on a search-results list. Checked FIRST so App Info ALWAYS bounces,
        // even though the Settings window also carries a (collapsed) search box.
        if (hasUnlinkIdentity) {
            // Settings SEARCH (com.google.android.settings.intelligence) lists "App info" /
            // "Uninstall" as result text while you type "unli", which falsely tripped the
            // loose-text App-Info match below and bounced every keystroke. A real App-Info
            // DETAIL page never has an active text field; search always does. So the loose
            // TEXT signals only count when there's no editable field. Hard signals
            // (force_stop/uninstall_button resource IDs — actual buttons that never appear in
            // a search list) stay unconditional, so App Info still always bounces.
            val hasInput = hasEditableField(node)
            val isAppInfoPage = hasAppInfoResourceId(node) ||
                                // Strong, App-Info-only signal: both destructive BUTTONS present.
                                // A search list never renders "Uninstall" AND "Force stop" together,
                                // so this stays unconditional → the WHOLE App Info page bounces on
                                // entry (the collapsed search box on App Info no longer suppresses it).
                                (findTextNodesSafely(node, "Uninstall") && findTextNodesSafely(node, "Force stop")) ||
                                // Loose header text false-positives on Settings search results
                                // ("App info" shown as a result subtitle), so only trust it when
                                // there is no editable field — i.e. a real detail page, not search.
                                (!hasInput && (
                                    findTextNodesSafely(node, "App info") ||
                                    findTextNodesSafely(node, "Application details") ||
                                    findTextNodesSafely(node, "App details")
                                ))
            if (isAppInfoPage) {
                armedFromUnlinkAppInfoAt = now   // arm overlay-detail guard
                diag("ai:$pkg", "[$pkg] unlink=Y appInfo=Y → BOUNCE rule=APPINFO (armed overlay)")
                return true
            }
        }

        // ── Pure-navigation screens (search / list / home) carry a text-input field ────
        // App Info already handled above, so here an editable field means a results list /
        // home — you can't disable our permissions there (tapping a result opens the detail
        // page, which we still catch). This is what stops "un"/"display" searches bouncing.
        if (hasEditableField(node)) {
            armedFromUnlinkAppInfoAt = 0L
            diag("nav:$pkg", "[$pkg] text-input present (search/list/home) → ALLOW")
            return false
        }

        if (hasUnlinkIdentity) {
            // Unlink + a toggle widget (detected by CLASS, not text), no input field = its
            // accessibility / overlay-list detail page. Locale/OEM-proof. Bounce.
            if (hasClickableToggle(node)) {
                diag("tg:$pkg", "[$pkg] unlink=Y toggle=Y → BOUNCE rule=UNLINK+TOGGLE")
                return true
            }
            // Unlink name + a destructive CONFIRM ("Force stop?", "Uninstall this app?",
            // "Stop Unlink?") — these dialogs render the app name but carry no toggle and
            // aren't App-Info-classified, so without this they leaked through "mention only".
            // This is the direct uninstall / force-stop / disable-accessibility escape. Bounce.
            if (looksLikeDestructiveConfirm(node)) {
                armedFromUnlinkAppInfoAt = now
                diag("dc:$pkg", "[$pkg] unlink=Y destructive-confirm → BOUNCE rule=CONFIRM")
                return true
            }
            // Unlink only *mentioned* with no actionable control → allow.
            armedFromUnlinkAppInfoAt = 0L
            diag("um:$pkg", "[$pkg] unlink=Y appInfo=N toggle=N → ALLOW (mention only)")
            return false
        }

        // ── No "Unlink" on screen ─────────────────────────────────────────────
        // The overlay / "appear on top" DETAIL page renders only a toggle, never the app
        // name. Bounce it ONLY when we arrived directly from Unlink's App Info moments ago
        // (armed). This is the key to ZERO collateral: a "display" search, or ANOTHER app's
        // overlay page, is never armed, so other apps are never affected.
        val armed = armedFromUnlinkAppInfoAt != 0L && (now - armedFromUnlinkAppInfoAt < 5000L)
        val overlay = isOverlayPermissionPage(node)
        if (armed && overlay) {
            armedFromUnlinkAppInfoAt = now // keep armed while the page is in front
            diag("ov:$pkg", "[$pkg] unlink=N overlay=Y armed=Y → BOUNCE rule=OVERLAY-DETAIL")
            return true
        }
        if (overlay) {
            diag("ovna:$pkg", "[$pkg] unlink=N overlay=Y armed=N → ALLOW (not opened from Unlink App Info)")
        }

        // Any other screen (Settings home, search, another app's pages, launcher) → neutral.
        // Disarm so nothing unrelated can ever bounce. THIS is what stops the false positives.
        armedFromUnlinkAppInfoAt = 0L
        return false
    }

    /**
     * True if the screen is the "display over other apps" / "appear on top" permission
     * page. Cross-OEM label coverage: Pixel/AOSP/Realme/Oppo/Vivo ("display over other
     * apps"), Samsung ("appear on top"), Xiaomi/MIUI ("display pop-up windows"), plus
     * generic "draw over" / "floating window" variants. Case-insensitive substring match.
     */
    private fun isOverlayPermissionPage(node: AccessibilityNodeInfo?): Boolean {
        if (node == null) return false
        val keys = listOf(
            "over other apps",        // Display/Allow display over other apps (AOSP/Pixel/Realme/Oppo/Vivo)
            "on top of other apps",   // some AOSP variants
            "appear on top",          // Samsung One UI
            "display pop-up",         // Xiaomi / MIUI ("Display pop-up windows…")
            "draw over",              // generic / older
            "floating window"         // Vivo / some ColorOS
        )
        return keys.any { findTextNodesSafely(node, it) }
    }

    /**
     * True if the screen contains an editable text field (search box / input). Used to
     * recognise Settings search / list / home screens — which are navigation, never a
     * place permissions get disabled — so they are always allowed (no false bounces).
     * Permission DETAIL pages never contain an input field.
     */
    private fun hasEditableField(node: AccessibilityNodeInfo?): Boolean {
        if (node == null) return false
        if (node.isEditable) return true
        val cls = node.className?.toString()?.lowercase() ?: ""
        if (cls.contains("edittext") || cls.contains("autocomplete")) return true
        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            val result = hasEditableField(child)
            child.recycle()
            if (result) return true
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
     * True if the screen is a destructive CONFIRM dialog ("Force stop?" / uninstall prompt)
     * that typically omits the app name. Only consulted right after we were on Unlink's own
     * App Info screen, so the blast radius is a ~4s window during an active strict session.
     */
    private fun looksLikeDestructiveConfirm(node: AccessibilityNodeInfo?): Boolean {
        if (node == null) return false
        // findTextNodesSafely is a case-insensitive substring match, so each entry also
        // covers its title-case / trailing-"?" variants.
        return findTextNodesSafely(node, "force stop") ||      // Force stop button + "Force stop?" dialog
               findTextNodesSafely(node, "uninstall this app") ||
               findTextNodesSafely(node, "want to uninstall") ||
               // Accessibility-toggle OFF confirm: "Stop Unlink?" / "Turn off Unlink?" /
               // "Disable Unlink?". The "…Unlink" suffix keeps these from ever matching an
               // unrelated dialog, so it's safe even in the no-identity armed window.
               findTextNodesSafely(node, "Stop Unlink") ||
               findTextNodesSafely(node, "Turn off Unlink") ||
               findTextNodesSafely(node, "Disable Unlink")
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
     * Like hasClickableToggle but only returns true when the toggle is currently CHECKED (ON).
     * Used so self-protection only fires when the user is trying to DISABLE the service,
     * not when they are trying to ENABLE it (toggle is off).
     */
    private fun hasEnabledClickableToggle(node: AccessibilityNodeInfo?): Boolean {
        if (node == null) return false
        val cls = node.className?.toString()?.lowercase() ?: ""
        val rid = node.viewIdResourceName?.lowercase() ?: ""
        val isToggle = cls.contains("switch") || cls.contains("checkbox") ||
                       cls.contains("togglebutton") || cls.contains("secswitch") ||
                       cls.contains("appcompatswitch") ||
                       rid.contains("switch") || rid.contains("toggle")
        if (isToggle && node.isClickable && node.isEnabled && node.isChecked) return true
        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            val result = hasEnabledClickableToggle(child)
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
        // Only match App-Info-specific button IDs. The generic AOSP dialog IDs
        // "right_button"/"left_button" were removed — they caused false-positive
        // bounces on unrelated settings dialogs that merely contained "Unlink" text.
        if (rid.contains("force_stop") || rid.contains("uninstall_button")) {
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
        return ScheduleEvaluator.isAnyActive(cachedSchedules, cachedStopRecords)
    }

    private fun checkNativeSchedules(pkg: String): Boolean {
        if (cachedSchedules.isEmpty()) return false
        // "com.shahil.unlink" is the self-protection / "is anything active" probe — it matches
        // any active window. Real target apps match only schedules that explicitly list them.
        return if (pkg == "com.shahil.unlink")
            ScheduleEvaluator.isAnyActive(cachedSchedules, cachedStopRecords)
        else
            ScheduleEvaluator.matchesPackage(cachedSchedules, cachedStopRecords, pkg)
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

            // ─── Parse & Cache Schedules + Stop Records (via ScheduleEvaluator) ──
            cachedSchedules = ScheduleEvaluator.parse(prefs)
            cachedStopRecords = ScheduleEvaluator.parseStops(prefs)

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
    // Self-protection shield
    // ─────────────────────────────────────────────────────────────────────────

    // OEM packages that host the App-Info / force-stop / uninstall / permission
    // screens. Covers AOSP plus the major OEM "security center" apps that route
    // these destructive actions through their own package instead of settings.
    private val SELF_PROTECT_PACKAGES = listOf(
        "settings",                  // AOSP + most OEMs (com.android.settings)
        "packageinstaller",          // uninstall confirm (com.android/google.packageinstaller)
        "securitycenter",            // Xiaomi / MIUI (com.miui.securitycenter)
        "com.miui.securitycore",
        "com.coloros.safecenter",    // Oppo / Realme (ColorOS)
        "com.coloros.phonemanager",
        "com.oppo.safe",             // older Oppo
        "com.iqoo.secure",           // Vivo / iQOO
        "com.vivo.permissionmanager",
        "com.vivo.abe",
        "com.huawei.systemmanager",  // Huawei / Honor (EMUI / MagicOS)
        "com.samsung.android.lool",  // Samsung Device Care
        "com.samsung.android.sm",    // Samsung Smart Manager (older)
        "com.transsion.phonemaster"  // Tecno / Infinix / itel
    )

    private fun isSelfProtectSurface(pkg: String): Boolean =
        SELF_PROTECT_PACKAGES.any { pkg.contains(it, ignoreCase = true) }

    /**
     * Fast re-scan that stays alive ONLY while the user is parked on a settings /
     * security surface during an active strict session. A single event-driven check
     * misses static screens (App-Info opened via Recents) and first-frame timing
     * (toggle not yet reported "checked"); this closes both. It self-terminates the
     * instant the foreground leaves the surface, so it costs nothing the rest of the time.
     */
    private val selfProtectWatchdog = object : Runnable {
        override fun run() {
            if (!isStrictModeEnabled || !isBlockActive("com.shahil.unlink")) { hideSelfProtectShield(); return }
            val root = rootInActiveWindow
            val pkg = root?.packageName?.toString()
            if (pkg == null || !isSelfProtectSurface(pkg)) {   // left the danger zone — stop & clear
                hideSelfProtectShield(); return
            }
            val now = System.currentTimeMillis()
            if (checkSelfProtection(root) ||
                (now - lastUnlinkSettingsSeen < 4000L && looksLikeDestructiveConfirm(root))) {
                lastUnlinkSettingsSeen = now
                showSelfProtectShield()
                performGlobalAction(GLOBAL_ACTION_BACK)
            } else {
                hideSelfProtectShield()   // on a settings list, but not on a dangerous toggle/screen
            }
            mainHandler.postDelayed(this, 400L)
        }
    }

    /**
     * Instantly draws an opaque full-screen overlay over the App-Info / force-stop /
     * uninstall screen so the destructive buttons are physically untappable. This wins
     * the race that GLOBAL_ACTION_BACK alone can lose when the OS is slow to navigate.
     * Built programmatically (no XML dependency) and self-dismisses as a safety net.
     * Called on the accessibility main thread; addView is therefore synchronous & instant.
     */
    private fun showSelfProtectShield() {
        // Refresh the safety dismissal on every detection so it stays up while the
        // dangerous screen is in front, and auto-clears if detections stop.
        mainHandler.removeCallbacks(shieldDismissRunnable)
        mainHandler.postDelayed(shieldDismissRunnable, 1500L)
        if (shieldOverlayView != null) return
        if (windowManager == null) windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        val view = FrameLayout(this).apply {
            setBackgroundColor(Color.parseColor("#F2000000"))
            isClickable = true   // absorb taps so they never reach the buttons behind
            isFocusable = false
            addView(TextView(this@UnlinkAccessibilityService).apply {
                text = "Focus Mode Active\nControl locked ❤️🩹"
                setTextColor(Color.WHITE)
                textSize = 18f
                gravity = Gravity.CENTER
            }, FrameLayout.LayoutParams(-1, -1, Gravity.CENTER))
        }
        val params = WindowManager.LayoutParams(
            -1, -1,
            WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        )
        // TYPE_ACCESSIBILITY_OVERLAY does not require the draw-overlays permission,
        // so the shield works on the accessibility grant alone. try/catch guards
        // any OEM that still rejects the add.
        try {
            windowManager?.addView(view, params)
            shieldOverlayView = view
            vibrate(20)
            Log.d(TAG, "DIAG shield shown (covering buttons)")
        } catch (e: Exception) {
            Log.e(TAG, "DIAG shield addView FAILED: ${e.message}")
        }
    }

    private fun hideSelfProtectShield() {
        mainHandler.removeCallbacks(shieldDismissRunnable)
        shieldOverlayView?.let { safeRemoveView(it); shieldOverlayView = null }
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
                "Unlink Focus Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps your focus session active"
                setShowBadge(false)
            }
            (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(serviceChannel)
        }
    }

    private fun createNotification(): Notification {
        val pi = PendingIntent.getActivity(this, 0, packageManager.getLaunchIntentForPackage(packageName), PendingIntent.FLAG_IMMUTABLE)
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Unlink Focus Active")
            .setContentText("Your focus session is running")
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .setContentIntent(pi)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setOngoing(true)
            .build()
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        // AccessibilityService cannot be restarted via Intent — only the user can re-enable it.
        // Keep the FallbackBlockingService alive so blocking continues if the main task is removed.
        Log.d(TAG, "onTaskRemoved detected — ensuring FallbackBlockingService survives.")
        val restartIntent = Intent(applicationContext, FallbackBlockingService::class.java)
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
