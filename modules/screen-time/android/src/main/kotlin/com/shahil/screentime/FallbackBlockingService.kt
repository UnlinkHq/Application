package com.shahil.screentime

import android.app.*
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.WindowManager
import android.widget.TextView
import androidx.core.app.NotificationCompat
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit

class FallbackBlockingService : Service() {

    private var windowManager: WindowManager? = null
    private var overlayView: View? = null
    private val handler = Handler(Looper.getMainLooper())
    private var pollingExecutor: ScheduledExecutorService? = null

    private var currentBlockedApps: Set<String> = emptySet()
    private var blockExpiryTime: Long = 0L
    private var isBlockingSuspended: Boolean = false
    private var cachedSchedules: List<ScheduleEvaluator.Schedule> = emptyList()
    private var cachedStopRecords: Map<String, String> = emptyMap()
    private var cachedUsageStatsManager: android.app.usage.UsageStatsManager? = null
    private var lastHeartbeatWrite = 0L

    companion object {
        private const val NOTIFICATION_ID = 1002
        private const val CHANNEL_ID = "unlink_fallback_channel"
    }

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        createNotificationChannel()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, createNotification(), android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(NOTIFICATION_ID, createNotification())
        }
        refreshConfig()

        // Register for config refresh broadcasts
        val filter = IntentFilter().apply {
            addAction("com.shahil.unlink.SYNC_LIST")
            addAction("com.shahil.ACTION_REFRESH_BLOCKS")
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(configReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(configReceiver, filter)
        }

        startPolling()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        refreshConfig()
        return START_STICKY
    }

    private val configReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            Log.d("UnlinkFallback", "Config refresh broadcast received: ${intent?.action}")
            refreshConfig()
        }
    }

    private fun refreshConfig() {
        val prefs = getSharedPreferences("UnlinkBlockingPrefs", Context.MODE_PRIVATE)
        currentBlockedApps = prefs.getStringSet("blocked_apps", emptySet()) ?: emptySet()
        blockExpiryTime = prefs.getLong("block_expiry_time", 0L)
        isBlockingSuspended = prefs.getBoolean("is_blocking_suspended", false)

        // Parse schedules for native-blocking fallback (shared ScheduleEvaluator)
        cachedSchedules = ScheduleEvaluator.parse(prefs)
        cachedStopRecords = ScheduleEvaluator.parseStops(prefs)
    }

    private fun startPolling() {
        pollingExecutor?.shutdownNow()
        pollingExecutor = Executors.newSingleThreadScheduledExecutor { r ->
            Thread(r, "UnlinkFallbackPoller").apply { isDaemon = true }
        }
        pollingExecutor?.scheduleAtFixedRate({
            checkForegroundApp()
        }, 0, 1000, TimeUnit.MILLISECONDS)
    }

    private fun checkForegroundApp() {
        val time = System.currentTimeMillis()
        val isManualSessionActive = !isBlockingSuspended && blockExpiryTime > time
        val isAnyScheduleActive = ScheduleEvaluator.isAnyActive(cachedSchedules, cachedStopRecords)

        // If neither a manual session nor a schedule is active, hide the wall and bail.
        if (!isManualSessionActive && !isAnyScheduleActive) {
            handler.post { setWallVisibility(false) }
            return
        }

        // If the Accessibility Service is alive it handles enforcement — fallback steps aside.
        if (UnlinkAccessibilityService.instance != null) {
            handler.post { setWallVisibility(false) }
            return
        }

        // Fallback is the live enforcer now — keep the shared engine heartbeat fresh so a genuine
        // kill (BOTH services dead) is distinguishable from a normal accessibility handoff.
        if (time - lastHeartbeatWrite > 10_000L) {
            lastHeartbeatWrite = time
            getSharedPreferences("UnlinkBlockingPrefs", Context.MODE_PRIVATE)
                .edit().putLong("last_engine_heartbeat", time).apply()
        }

        if (cachedUsageStatsManager == null) {
            cachedUsageStatsManager = getSystemService(Context.USAGE_STATS_SERVICE) as android.app.usage.UsageStatsManager
        }

        val events = cachedUsageStatsManager!!.queryEvents(time - 30_000, time)
        val event = android.app.usage.UsageEvents.Event()
        var topPackage: String? = null

        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            if (event.eventType == android.app.usage.UsageEvents.Event.MOVE_TO_FOREGROUND ||
                event.eventType == android.app.usage.UsageEvents.Event.ACTIVITY_RESUMED) {
                topPackage = event.packageName
            }
        }

        if (topPackage != null) {
            if (topPackage == packageName) {
                handler.post { setWallVisibility(false) }
                return
            }

            val manualBlock = isManualSessionActive &&
                    currentBlockedApps.any { topPackage.contains(it, ignoreCase = true) }
            val scheduleBlock = ScheduleEvaluator.matchesPackage(cachedSchedules, cachedStopRecords, topPackage)
            val isBlocked = manualBlock || scheduleBlock

            handler.post { setWallVisibility(isBlocked) }
        }
    }

    private fun setWallVisibility(visible: Boolean) {
        if (visible) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
                !Settings.canDrawOverlays(this)) {
                Log.w("UnlinkFallback", "Overlay permission not granted, cannot show wall")
                return
            }
            if (overlayView == null) {
                createOverlay()
            }
            if (overlayView?.parent == null) {
                try {
                    val params = overlayView?.layoutParams as WindowManager.LayoutParams
                    windowManager?.addView(overlayView, params)
                } catch (e: Exception) {
                    Log.e("UnlinkFallback", "Error showing overlay: ${e.message}")
                }
            }
            updateOverlayContent()
        } else {
            if (overlayView?.parent != null) {
                try {
                    windowManager?.removeView(overlayView)
                } catch (e: Exception) {
                    Log.e("UnlinkFallback", "Error removing overlay: ${e.message}")
                }
            }
        }
    }

    private fun createOverlay() {
        val inflater = getSystemService(Context.LAYOUT_INFLATER_SERVICE) as LayoutInflater
        val layoutId = resources.getIdentifier("blocking_overlay_full", "layout", packageName)
        if (layoutId == 0) {
            Log.e("UnlinkFallback", "blocking_overlay_full layout not found — overlay skipped")
            return
        }
        overlayView = inflater.inflate(layoutId, null)

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            else
                @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_SYSTEM_ALERT,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        )
        overlayView?.layoutParams = params

        val btnId = resources.getIdentifier("goHomeButton", "id", packageName)
        overlayView?.findViewById<View>(btnId)?.setOnClickListener {
            val homeIntent = Intent(Intent.ACTION_MAIN)
            homeIntent.addCategory(Intent.CATEGORY_HOME)
            homeIntent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
            startActivity(homeIntent)
        }
    }

    private fun updateOverlayContent() {
        val messageId = resources.getIdentifier("messageText", "id", packageName)
        val prefs = getSharedPreferences("UnlinkBlockingPrefs", Context.MODE_PRIVATE)
        val message = prefs.getString("focus_message", "FOCUS_PROTOCOL_ENFORCED")
        overlayView?.findViewById<TextView>(messageId)?.text = message
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val serviceChannel = NotificationChannel(
                CHANNEL_ID,
                "Unlink Focus Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps your focus session active in the background"
                setShowBadge(false)
                enableVibration(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(serviceChannel)
        }
    }

    private fun createNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Unlink Focus Active")
            .setContentText("Your focus session is running")
            .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setOngoing(true)
            .build()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    /**
     * Xiaomi/MIUI (and other aggressive OEM ROMs) fires onTaskRemoved even when
     * android:stopWithTask="false" is set.  We schedule an immediate self-restart
     * via AlarmManager so the service resumes within ~1 second of being swiped away.
     */
    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        Log.d("UnlinkFallback", "onTaskRemoved — scheduling self-restart for OEM survival")
        val restartIntent = Intent(applicationContext, FallbackBlockingService::class.java)
        val pending = android.app.PendingIntent.getService(
            applicationContext, 1,
            restartIntent,
            android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
        )
        val alarmManager = getSystemService(Context.ALARM_SERVICE) as android.app.AlarmManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarmManager.canScheduleExactAlarms()) {
            alarmManager.setAndAllowWhileIdle(
                android.app.AlarmManager.ELAPSED_REALTIME_WAKEUP,
                android.os.SystemClock.elapsedRealtime() + 1_000L,
                pending
            )
        } else {
            alarmManager.setExactAndAllowWhileIdle(
                android.app.AlarmManager.ELAPSED_REALTIME_WAKEUP,
                android.os.SystemClock.elapsedRealtime() + 1_000L,
                pending
            )
        }
    }

    override fun onDestroy() {
        pollingExecutor?.shutdownNow()
        setWallVisibility(false)
        try { unregisterReceiver(configReceiver) } catch (_: Exception) {}
        super.onDestroy()
    }
}