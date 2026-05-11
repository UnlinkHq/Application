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
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar
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
    private var cachedSchedules: List<CachedSchedule> = emptyList()
    private var cachedStopRecords: Map<String, String> = emptyMap()
    private var cachedUsageStatsManager: android.app.usage.UsageStatsManager? = null

    companion object {
        private const val NOTIFICATION_ID = 1002
        private const val CHANNEL_ID = "unlink_fallback_channel"

        private data class CachedSchedule(
            val id: String,
            val enabled: Boolean,
            val startTimeMins: Int,
            val endTimeMins: Int,
            val days: Set<String>,
            val appPackages: List<String>
        )
    }

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, createNotification())
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

        // Parse schedules for native-blocking fallback
        cachedSchedules = parseSchedules(prefs)
        cachedStopRecords = parseStopRecords(prefs)
    }

    private fun parseSchedules(prefs: android.content.SharedPreferences): List<CachedSchedule> {
        val json = prefs.getString("native_schedules", null) ?: return emptyList()
        return try {
            val array = JSONArray(json)
            (0 until array.length()).mapNotNull { i ->
                val block = array.getJSONObject(i)
                if (block.optString("type") != "schedule") return@mapNotNull null
                val sched = block.optJSONObject("schedule") ?: return@mapNotNull null
                val daysArr = sched.optJSONArray("days") ?: return@mapNotNull null
                val daysSet = (0 until daysArr.length()).mapTo(mutableSetOf()) { daysArr.getString(it) }
                val appsArr = block.optJSONArray("apps") ?: return@mapNotNull null
                val appList = (0 until appsArr.length()).map { appsArr.getString(it) }
                val start = parseTimeToMinutes(sched.optString("startTime", ""))
                val end = parseTimeToMinutes(sched.optString("endTime", ""))
                CachedSchedule(block.optString("id"), block.optBoolean("enabled", true), start, end, daysSet, appList)
            }
        } catch (e: Exception) {
            Log.e("UnlinkFallback", "Schedule parse error: ${e.message}")
            emptyList()
        }
    }

    private fun parseStopRecords(prefs: android.content.SharedPreferences): Map<String, String> {
        val json = prefs.getString("native_stop_records", "{}") ?: "{}"
        return try {
            val obj = JSONObject(json)
            val map = mutableMapOf<String, String>()
            val keys = obj.keys()
            while (keys.hasNext()) { val k = keys.next(); map[k] = obj.getString(k) }
            map
        } catch (e: Exception) { emptyMap() }
    }

    private fun parseTimeToMinutes(t: String): Int {
        val p = t.split(":")
        return if (p.size >= 2) (p[0].toIntOrNull() ?: 0) * 60 + (p[1].toIntOrNull() ?: 0) else 0
    }

    private fun isBlockedBySchedule(pkg: String): Boolean {
        if (cachedSchedules.isEmpty()) return false
        val cal = Calendar.getInstance()
        val dayNames = arrayOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat")
        val todayDayName = dayNames[cal.get(Calendar.DAY_OF_WEEK) - 1]
        val todayDateStr = String.format(java.util.Locale.US, "%04d-%02d-%02d", cal.get(Calendar.YEAR), cal.get(Calendar.MONTH) + 1, cal.get(Calendar.DAY_OF_MONTH))
        val yesterdayDayName = dayNames[(cal.get(Calendar.DAY_OF_WEEK) - 2 + 7) % 7]
        val yesterdayCal = cal.clone() as Calendar
        yesterdayCal.add(Calendar.DAY_OF_YEAR, -1)
        val yesterdayDateStr = String.format(java.util.Locale.US, "%04d-%02d-%02d", yesterdayCal.get(Calendar.YEAR), yesterdayCal.get(Calendar.MONTH) + 1, yesterdayCal.get(Calendar.DAY_OF_MONTH))
        val nowMins = cal.get(Calendar.HOUR_OF_DAY) * 60 + cal.get(Calendar.MINUTE)
        for (sched in cachedSchedules) {
            if (!sched.enabled) continue
            val isMidnightCrossing = sched.endTimeMins <= sched.startTimeMins
            val isPostMidnight = isMidnightCrossing && nowMins < sched.endTimeMins
            val effectiveDayName = if (isPostMidnight) yesterdayDayName else todayDayName
            val effectiveDateStr = if (isPostMidnight) yesterdayDateStr else todayDateStr
            if (cachedStopRecords[sched.id] == effectiveDateStr) continue
            if (!sched.days.contains(effectiveDayName)) continue
            val inWindow = if (isMidnightCrossing) {
                nowMins >= sched.startTimeMins || nowMins < sched.endTimeMins
            } else {
                nowMins >= sched.startTimeMins && nowMins < sched.endTimeMins
            }
            if (!inWindow) continue
            if (sched.appPackages.any { pkg.contains(it, ignoreCase = true) }) return true
        }
        return false
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
        val isAnyScheduleActive = isAnyScheduleCurrentlyActive()

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
            val scheduleBlock = isBlockedBySchedule(topPackage)
            val isBlocked = manualBlock || scheduleBlock

            handler.post { setWallVisibility(isBlocked) }
        }
    }

    /**
     * Returns true if ANY schedule is currently active (regardless of which app).
     * Used to decide whether the fallback service should even bother polling.
     */
    private fun isAnyScheduleCurrentlyActive(): Boolean {
        if (cachedSchedules.isEmpty()) return false
        val cal = Calendar.getInstance()
        val dayNames = arrayOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat")
        val todayDayName = dayNames[cal.get(Calendar.DAY_OF_WEEK) - 1]
        val todayDateStr = String.format(java.util.Locale.US, "%04d-%02d-%02d", cal.get(Calendar.YEAR), cal.get(Calendar.MONTH) + 1, cal.get(Calendar.DAY_OF_MONTH))
        val yesterdayDayName = dayNames[(cal.get(Calendar.DAY_OF_WEEK) - 2 + 7) % 7]
        val yesterdayCal = cal.clone() as Calendar
        yesterdayCal.add(Calendar.DAY_OF_YEAR, -1)
        val yesterdayDateStr = String.format(java.util.Locale.US, "%04d-%02d-%02d", yesterdayCal.get(Calendar.YEAR), yesterdayCal.get(Calendar.MONTH) + 1, yesterdayCal.get(Calendar.DAY_OF_MONTH))
        val nowMins = cal.get(Calendar.HOUR_OF_DAY) * 60 + cal.get(Calendar.MINUTE)
        for (sched in cachedSchedules) {
            if (!sched.enabled) continue
            val isMidnightCrossing = sched.endTimeMins <= sched.startTimeMins
            val isPostMidnight = isMidnightCrossing && nowMins < sched.endTimeMins
            val effectiveDayName = if (isPostMidnight) yesterdayDayName else todayDayName
            val effectiveDateStr = if (isPostMidnight) yesterdayDateStr else todayDateStr
            if (cachedStopRecords[sched.id] == effectiveDateStr) continue
            if (!sched.days.contains(effectiveDayName)) continue
            val inWindow = if (isMidnightCrossing) {
                nowMins >= sched.startTimeMins || nowMins < sched.endTimeMins
            } else {
                nowMins >= sched.startTimeMins && nowMins < sched.endTimeMins
            }
            if (inWindow) return true
        }
        return false
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
                "Unlink Fallback Protection",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Required for unbreakable focus protection"
                setShowBadge(false)
                enableVibration(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(serviceChannel)
        }
    }

    private fun createNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Unlink Focus Protection Active")
            .setContentText("Focus Engine is running in high-persistence mode")
            .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
            .setPriority(NotificationCompat.PRIORITY_MAX)
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
            android.app.PendingIntent.FLAG_ONE_SHOT or android.app.PendingIntent.FLAG_IMMUTABLE
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