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
    
    // CORE_STATE: Blocked apps and active filters
    private var currentBlockedApps: Set<String> = emptySet()
    
    // CACHED_STATE: Fast access to session data
    private var cachedIsBlockingSuspended = false
    private var currentFocusMessage = "QUICK_BREATH"
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
            if (isBlockingSuspended) setWallVisibility(false)
            else performSecurityCheck()
        }
    }

    private var lastEventTime = 0L

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        val eventType = event.eventType
        val pkg = event.packageName?.toString() ?: return

        if (isLauncherOrHomePackage(pkg) || pkg == packageName) {
            setWallVisibility(false, false)
            return
        }

        // FULL_BLOCK_PRIORITY: If the app is hard-blocked, show the wall immediately.
        if (isBlockActive(pkg)) {
            setWallVisibility(true, false)
            return
        }

        // INTENT_GATE_LOGIC: Target apps (Instagram/YouTube) trigger the Entry Gate.
        val isTargetApp = pkg == "com.google.android.youtube" || pkg == "com.instagram.android"
        if (isTargetApp) {
            if (!authorizedApps.contains(pkg)) {
                showIntentGate(pkg)
            } else {
                setWallVisibility(false, false)
            }
            return
        }

        // DEFAULT: No action for other apps unless they were recently blocked.
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
        refreshFromDiskInternal()
        
        val targetPackages = mutableSetOf<String>()
        targetPackages.addAll(currentBlockedApps)
        targetPackages.add("com.google.android.youtube")
        targetPackages.add("com.instagram.android")
        
        // PROACTIVE_SCAN: Monitor launcher and SystemUI for zero-latency blocking
        targetPackages.add(getLauncherPackageName())
        targetPackages.add("com.android.systemui")

        val info = serviceInfo
        info.eventTypes = AccessibilityEvent.TYPE_WINDOWS_CHANGED or
                        AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED or
                        AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED or
                        AccessibilityEvent.TYPE_VIEW_CLICKED
        info.packageNames = targetPackages.toTypedArray()
        
        // Immediate check
        performSecurityCheck()
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
        setWallVisibility(false, false)
    }

    private fun refreshFromDiskInternal() {
        try {
            val prefs = getSharedPreferences("UnlinkBlockingPrefs", Context.MODE_PRIVATE)
            currentBlockedApps = prefs.getStringSet("blocked_apps", emptySet()) ?: emptySet()
            currentFocusMessage = prefs.getString("focus_message", "QUICK_BREATH") ?: "QUICK_BREATH"
            currentTimeRemaining = prefs.getString("time_remaining", "00:00") ?: "00:00"
            blockExpiryTime = prefs.getLong("block_expiry_time", 0L)
            cachedIsBlockingSuspended = prefs.getBoolean("is_blocking_suspended", false)
            isBlockingSuspended = prefs.getBoolean("is_blocking_suspended", false)
        } catch (e: Exception) {}
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
                if (!authorizedApps.contains(pkg)) {
                    showIntentGate(pkg)
                } else {
                    setWallVisibility(false)
                }
                return
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

    private fun updateWallContent() {
        try {
            val myPackageName = getPackageName()
            val messageId = resources.getIdentifier("messageText", "id", myPackageName)
            if (messageId != 0) overlayView?.findViewById<TextView>(messageId)?.text = currentFocusMessage
        } catch (e: Exception) {}
    }

    private fun createAbsoluteWall() {
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

    private fun showIntentGate(pkg: String) {
        if (gateOverlayView != null) return
        
        visibilityHandler.post {
            try {
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

                // Interaction Logic
                val dmBtnId = resources.getIdentifier("dmOnlyButton", "id", myPackageName)
                val commBtnId = resources.getIdentifier("communityButton", "id", myPackageName)
                val cancelId = resources.getIdentifier("cancelButton", "id", myPackageName)

                gateOverlayView?.findViewById<View>(dmBtnId)?.setOnClickListener { authorizeSession(pkg) }
                gateOverlayView?.findViewById<View>(commBtnId)?.setOnClickListener { authorizeSession(pkg) }
                gateOverlayView?.findViewById<View>(cancelId)?.setOnClickListener { hideIntentGate(); goHome() }

                windowManager?.addView(gateOverlayView, params)
                startGateCountdown()
            } catch (e: Exception) {
                Log.e("UnlinkGate", "Failed to show gate: ${e.message}")
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

    private fun authorizeSession(pkg: String) {
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
}
