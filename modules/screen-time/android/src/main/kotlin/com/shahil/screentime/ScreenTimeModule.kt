package com.shahil.screentime

import android.app.AppOpsManager
import android.app.usage.UsageStats
import android.app.usage.UsageStatsManager
import android.content.BroadcastReceiver
import android.content.IntentFilter
import android.content.Context
import android.content.Intent
import android.content.ComponentName
import android.content.pm.PackageManager
import android.util.Log
import android.os.Process
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.app.admin.DevicePolicyManager
import android.widget.Toast
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.Calendar

class ScreenTimeModule : Module() {
  
  override fun definition() = ModuleDefinition {
    Name("ScreenTime")
    Events("onNativeBreakToggle")

    Function("isAdminActive") {
      try {
        val context = appContext.reactContext ?: return@Function false
        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val adminComponent = ComponentName(context.packageName, "com.shahil.screentime.UnlinkDeviceAdminReceiver")
        return@Function dpm.isAdminActive(adminComponent)
      } catch (e: Exception) {
        return@Function false
      }
    }

    Function("startFocusProtocol") { config: Map<String, Any> ->
      appContext.reactContext?.let { context ->
        val packageNames = config["apps"] as? List<String> ?: emptyList()
        val durationMins = (config["durationMins"] as? Double ?: 0.0).toLong()
        val surgicalFlagsMap = config["surgicalFlags"] as? Map<String, Any>
        val surgicalYoutube = (surgicalFlagsMap?.get("youtube") as? Boolean) ?: (config["surgicalYoutube"] as? Boolean ?: false)
        val surgicalInstagram = (surgicalFlagsMap?.get("instagram") as? Boolean) ?: (config["surgicalInstagram"] as? Boolean ?: false)
        val message = config["message"] as? String ?: "FOCUS_PROTOCOL_ENGAGED"
        
        val set = packageNames.toSet()
        val prefs = context.getSharedPreferences("UnlinkBlockingPrefs", Context.MODE_PRIVATE)
        
        val startTime = System.currentTimeMillis()
        val expiryTime = if (durationMins > 0) startTime + (durationMins * 60 * 1000L) else 0L

        prefs.edit().apply {
            putStringSet("blocked_apps", set)
            putString("focus_message", message)
            putBoolean("surgical_youtube", surgicalYoutube)
            putBoolean("surgical_instagram", surgicalInstagram)
            putLong("block_expiry_time", expiryTime)
            putLong("session_start_time", startTime)
            putBoolean("is_blocking_suspended", false)
            putInt("breaks_remaining", (config["breaksRemaining"] as? Double ?: 0.0).toInt())
            commit()
        }
        
        syncBlockingService(context)
        
        // Broadcast to Accessibility Service
        UnlinkAccessibilityService.instance?.refreshServiceConfig()
        UnlinkAccessibilityService.instance?.setSuspendedState(false)
        
        val intent = Intent("com.shahil.unlink.SYNC_LIST")
        intent.setPackage(context.packageName)
        context.sendBroadcast(intent)
      }
      return@Function null
    }

    Function("setBreaksRemaining") { remaining: Int ->
      appContext.reactContext?.let { context ->
        val prefs = context.getSharedPreferences("UnlinkBlockingPrefs", Context.MODE_PRIVATE)
        prefs.edit().putInt("breaks_remaining", remaining).commit()
        UnlinkAccessibilityService.instance?.refreshServiceConfig()
      }
      return@Function null
    }

    // LEGACY_SUPPORT: Keep for compatibility but ensure they don't reset each other
    Function("setBlockedApps") { packageNames: List<String>, message: String, timeLeft: String ->
      appContext.reactContext?.let { context ->
        val set = packageNames.toSet()
        val prefs = context.getSharedPreferences("UnlinkBlockingPrefs", Context.MODE_PRIVATE)
        prefs.edit().apply {
            putStringSet("blocked_apps", set)
            putString("focus_message", message)
            putString("time_remaining", timeLeft)
            commit()
        }
        UnlinkAccessibilityService.instance?.refreshServiceConfig()
      }
      return@Function null
    }

    AsyncFunction("getEngineHealth") {
        val context = appContext.reactContext ?: return@AsyncFunction mapOf("status" to "error")
        
        val hasOverlay = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) Settings.canDrawOverlays(context) else true
        
        val expectedService = "${context.packageName}/com.shahil.screentime.UnlinkAccessibilityService"
        val enabledServices = Settings.Secure.getString(context.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES)
        val hasAccess = enabledServices?.contains(expectedService) == true
        
        val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val usageMode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
        } else {
            @Suppress("DEPRECATION")
            appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
        }
        val hasUsage = usageMode == AppOpsManager.MODE_ALLOWED
        
        val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        val isExempt = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) pm.isIgnoringBatteryOptimizations(context.packageName) else true
        
        val engineActive = UnlinkAccessibilityService.instance != null

        return@AsyncFunction mapOf(
            "overlay" to hasOverlay,
            "accessibility" to hasAccess,
            "usage" to hasUsage,
            "batteryExempt" to isExempt,
            "engineActive" to engineActive
        )
    }

    Function("stopBlockingService") {
        appContext.reactContext?.let { context ->
            val prefs = context.getSharedPreferences("UnlinkBlockingPrefs", Context.MODE_PRIVATE)
            prefs.edit().apply {
                putStringSet("blocked_apps", emptySet())
                putBoolean("surgical_youtube", false)
                putBoolean("surgical_instagram", false)
                putBoolean("is_blocking_suspended", false)
                putLong("block_expiry_time", 0L)
                commit()
            }
            syncBlockingService(context)
            UnlinkAccessibilityService.instance?.refreshServiceConfig()
        }
    }

    AsyncFunction("getGlobalBrainrot") {
        val context = appContext.reactContext ?: return@AsyncFunction mapOf("score" to 0f, "date" to "", "shortsCount" to 0)
        val prefs = context.getSharedPreferences("UnlinkBlockingPrefs", Context.MODE_PRIVATE)
        val score = prefs.getFloat("global_brainrot_score", 0f)
        val shorts = prefs.getInt("global_shorts_count", 0)
        val date = prefs.getString("global_brainrot_date", "") ?: ""
        return@AsyncFunction mapOf("score" to score, "date" to date, "shortsCount" to shorts)
    }

    Function("updateGlobalBrainrot") { delta: Double ->
        appContext.reactContext?.let { context ->
            val prefs = context.getSharedPreferences("UnlinkBlockingPrefs", Context.MODE_PRIVATE)
            val currentScore = prefs.getFloat("global_brainrot_score", 0f)
            val newScore = (currentScore + delta).toFloat().coerceIn(0f, 100f)
            
            prefs.edit().putFloat("global_brainrot_score", newScore).apply()
            
            // Sync with accessibility service if running
            UnlinkAccessibilityService.instance?.refreshServiceConfig()
        }
    }

    Function("setGlobalBrainrot") { score: Double ->
        appContext.reactContext?.let { context ->
            val prefs = context.getSharedPreferences("UnlinkBlockingPrefs", Context.MODE_PRIVATE)
            val newScore = score.toFloat().coerceIn(0f, 100f)
            
            prefs.edit().putFloat("global_brainrot_score", newScore).apply()
            
            // Sync with accessibility service if running
            UnlinkAccessibilityService.instance?.refreshServiceConfig()
        }
    }

    Function("isBatteryOptimizationExempted") {
        val context = appContext.reactContext ?: return@Function true
        val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            return@Function pm.isIgnoringBatteryOptimizations(context.packageName)
        }
        return@Function true
    }

    Function("requestBatteryOptimizationExemption") {
        val context = appContext.reactContext
        if (context != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
            intent.data = android.net.Uri.parse("package:${context.packageName}")
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        }
    }

    Function("setSurgicalConfig") { config: Map<String, Any> ->
      appContext.reactContext?.let { context ->
        val prefs = context.getSharedPreferences("UnlinkBlockingPrefs", Context.MODE_PRIVATE)
        
        val youtube = config["youtube"] as? Boolean ?: false
        val instagram = config["instagram"] as? Boolean ?: false
        val studyMode = config["studyMode"] as? Boolean ?: false
        
        // Granular Coach Config
        val coachConfig = config["config"] as? Map<String, Any>
        val ytGate = coachConfig?.get("ytGate") as? Boolean ?: true
        val ytShelf = coachConfig?.get("ytShelf") as? Boolean ?: true
        val ytFinite = coachConfig?.get("ytFinite") as? Boolean ?: true
        val igGate = coachConfig?.get("igGate") as? Boolean ?: true
        val igDMs = coachConfig?.get("igDMs") as? Boolean ?: true
        val igFinite = coachConfig?.get("igFinite") as? Boolean ?: true

        prefs.edit().apply {
            putBoolean("surgical_youtube", youtube)
            putBoolean("surgical_instagram", instagram)
            putBoolean("study_mode_active", studyMode)
            
            // Persist granular flags
            putBoolean("coach_yt_gate", ytGate)
            putBoolean("coach_yt_shelf", ytShelf)
            putBoolean("coach_yt_finite", ytFinite)
            putBoolean("coach_ig_gate", igGate)
            putBoolean("coach_ig_dms", igDMs)
            putBoolean("coach_ig_finite", igFinite)
            commit()
        }
        
        UnlinkAccessibilityService.instance?.refreshServiceConfig()
      }
      return@Function null
    }

    Function("setUninstallProtection") { enabled: Boolean ->
      appContext.reactContext?.let { context ->
        val prefs = context.getSharedPreferences("UnlinkBlockingPrefs", Context.MODE_PRIVATE)
        prefs.edit().apply {
            putBoolean("is_uninstall_protected", enabled)
            commit()
        }
      }
      return@Function null
    }

    Function("setSessionDuration") { minutes: Int ->
      appContext.reactContext?.let { context ->
        val prefs = context.getSharedPreferences("UnlinkBlockingPrefs", Context.MODE_PRIVATE)
        val startTime = System.currentTimeMillis()
        val expiryTime = startTime + (minutes * 60 * 1000L)
        
        prefs.edit().apply {
            putLong("session_duration_mins", minutes.toLong())
            putLong("session_start_time", startTime)
            putLong("block_expiry_time", expiryTime)
            commit()
        }
        
        // Force sync with service
        syncBlockingService(context)
        val service = UnlinkAccessibilityService.instance
        service?.refreshServiceConfig()
        service?.setSuspendedState(false)
      }
      return@Function null
    }

    Function("setBlockExpiryTime") { timestamp: Double ->
      appContext.reactContext?.let { context ->
        val prefs = context.getSharedPreferences("UnlinkBlockingPrefs", Context.MODE_PRIVATE)
        prefs.edit().putLong("block_expiry_time", timestamp.toLong()).commit()
        try {
            UnlinkAccessibilityService.instance?.refreshServiceConfig()
        } catch (e: Exception) {
            Log.e("ScreenTimeModule", "Error refreshing config: ${e.message}")
        }
      }
      return@Function null
    }

    Function("setBlockingSuspended") { suspended: Boolean ->
      appContext.reactContext?.let { context ->
        val prefs = context.getSharedPreferences("UnlinkBlockingPrefs", Context.MODE_PRIVATE)
        prefs.edit().apply {
            putBoolean("is_blocking_suspended", suspended)
            commit()
        }
        
        try {
            // 1. DIRECT_MEMORY_LINK: Instant sync if service is running
            UnlinkAccessibilityService.instance?.setSuspendedState(suspended)
        } catch (e: Exception) {
            Log.e("ScreenTimeModule", "Error setting suspended state: ${e.message}")
        }
        
        // 2. BROADCAST_FALLBACK: Redundant sync for safety
        val intent = Intent("com.shahil.unlink.SYNC_LIST")
        intent.setPackage(context.packageName)
        context.sendBroadcast(intent)
      }
      return@Function null
    }

    Function("requestAdmin") {
      val activity = appContext.currentActivity
      val context = appContext.reactContext
      if (activity != null && context != null) {
        try {
          val adminComponent = ComponentName(context.packageName, "com.shahil.screentime.UnlinkDeviceAdminReceiver")
          val intent = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN)
          intent.putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, adminComponent)
          intent.putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION, "Enabling this prevents Unlink from being uninstalled.")
          activity.startActivity(intent)
        } catch (e: Exception) {
          Log.e("UnlinkAdmin", "Failed to start admin activity", e)
        }
      }
    }

    Function("deactivateAdmin") {
      appContext.reactContext?.let { context ->
        try {
          val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
          val adminComponent = ComponentName(context.packageName, "com.shahil.screentime.UnlinkDeviceAdminReceiver")
          
          if (dpm.isAdminActive(adminComponent)) {
            dpm.removeActiveAdmin(adminComponent)
          }
        } catch (e: Exception) {
          // Silently fail - the JS layer will sync state via isAdminActive on next app resume
        }
      }
    }

    Function("hasPermission") {
      val context = appContext.reactContext ?: return@Function false
      val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
      val mode = appOps.checkOpNoThrow(
        AppOpsManager.OPSTR_GET_USAGE_STATS,
        Process.myUid(),
        context.packageName
      )
      return@Function mode == AppOpsManager.MODE_ALLOWED
    }

    Function("hasOverlayPermission") {
        val context = appContext.reactContext ?: return@Function false
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            return@Function Settings.canDrawOverlays(context)
        }
        return@Function true
    }

    Function("requestOverlayPermission") {
        val context = appContext.reactContext
        if (context != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION)
            intent.data = android.net.Uri.parse("package:${context.packageName}")
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        }
    }

    Function("requestPermission") {
      val context = appContext.reactContext
      if (context != null) {
        val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
      }
    }

    Function("isAccessibilityServiceEnabled") {
        val context = appContext.reactContext ?: return@Function false
        val expectedService = "${context.packageName}/com.shahil.screentime.UnlinkAccessibilityService"
        val enabledServices = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        )
        return@Function enabledServices?.contains(expectedService) == true
    }

    Function("isUsageStatsPermissionGranted") {
      val context = appContext.reactContext ?: return@Function false
      val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
      val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        appOps.unsafeCheckOpNoThrow(
          AppOpsManager.OPSTR_GET_USAGE_STATS,
          Process.myUid(),
          context.packageName
        )
      } else {
        appOps.checkOpNoThrow(
          AppOpsManager.OPSTR_GET_USAGE_STATS,
          Process.myUid(),
          context.packageName
        )
      }
      return@Function mode == AppOpsManager.MODE_ALLOWED
    }

    Function("requestUsageStatsPermission") {
      val context = appContext.reactContext ?: return@Function null
      val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK
      }
      context.startActivity(intent)
      return@Function null
    }

    Function("openAppInfoSettings") {
      val context = appContext.reactContext ?: return@Function null
      val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
        data = android.net.Uri.fromParts("package", context.packageName, null)
        flags = Intent.FLAG_ACTIVITY_NEW_TASK
      }
      context.startActivity(intent)
      return@Function null
    }

    Function("requestAccessibilityPermission") {
        val context = appContext.reactContext
        if (context != null) {
            val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        }
    }

    Function("openAccessibilitySettings") {
        val context = appContext.reactContext
        if (context != null) {
            val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        }
    }

    AsyncFunction("getUsageStats") { startTime: Double, endTime: Double ->
      val context = appContext.reactContext ?: return@AsyncFunction mapOf<String, Any>()
      val usageStatsManager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      
      val hourlyMap = mutableMapOf<String, MutableMap<String, Long>>()
      val dailyTotalMap = mutableMapOf<String, Long>()
      val pickupMap = mutableMapOf<String, Int>()

      val events = usageStatsManager.queryEvents(startTime.toLong(), endTime.toLong())
      val event = android.app.usage.UsageEvents.Event()
      
      var currentPkg: String? = null
      var currentStart: Long = 0L
      
      val ACTIVITY_RESUMED = android.app.usage.UsageEvents.Event.ACTIVITY_RESUMED
      val ACTIVITY_PAUSED = android.app.usage.UsageEvents.Event.ACTIVITY_PAUSED
      val MOVE_TO_FOREGROUND = android.app.usage.UsageEvents.Event.MOVE_TO_FOREGROUND
      val MOVE_TO_BACKGROUND = android.app.usage.UsageEvents.Event.MOVE_TO_BACKGROUND

      while (events.hasNextEvent()) {
          events.getNextEvent(event)
          val pkg = event.packageName
          val time = event.timeStamp
          val type = event.eventType

          if (type == ACTIVITY_RESUMED || type == MOVE_TO_FOREGROUND) {
              if (currentPkg != null) {
                   val duration = time - currentStart
                   if (duration > 0) {
                      addToMaps(currentPkg!!, duration, currentStart, hourlyMap, dailyTotalMap)
                   }
              }
              currentPkg = pkg
              currentStart = time
              pickupMap[pkg] = (pickupMap[pkg] ?: 0) + 1
          } else if (type == ACTIVITY_PAUSED || type == MOVE_TO_BACKGROUND) {
              if (currentPkg == pkg) {
                  val duration = time - currentStart
                  if (duration > 0) {
                      addToMaps(pkg, duration, currentStart, hourlyMap, dailyTotalMap)
                  }
                  currentPkg = null
              }
          }
      }
      return@AsyncFunction mapOf("hourly" to hourlyMap, "daily" to dailyTotalMap, "pickups" to pickupMap)
    }

    AsyncFunction("getInstalledApps") {
      val context = appContext.reactContext ?: return@AsyncFunction listOf<Map<String, Any>>()
      val packageManager = context.packageManager
      val mainIntent = Intent(Intent.ACTION_MAIN, null).addCategory(Intent.CATEGORY_LAUNCHER)
      val resolvedActivities = packageManager.queryIntentActivities(mainIntent, 0)
      val appList = mutableListOf<Map<String, Any>>()
      for (resolveInfo in resolvedActivities) {
        val packageName = resolveInfo.activityInfo.packageName
        try {
            val applicationInfo = packageManager.getApplicationInfo(packageName, 0)
            val label = packageManager.getApplicationLabel(applicationInfo).toString()
            val iconDrawable = packageManager.getApplicationIcon(applicationInfo)
            val iconBase64 = bitmapToBase64(iconDrawable)
            appList.add(mapOf("packageName" to packageName, "label" to label, "icon" to (iconBase64 ?: "")))
        } catch (e: Exception) {}
      }
      return@AsyncFunction appList
    }

    OnCreate {
        val context = appContext.reactContext ?: return@OnCreate
        val filter = IntentFilter("com.shahil.unlink.REQUEST_BREAK")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(object : BroadcastReceiver() {
                override fun onReceive(context: Context?, intent: Intent?) {
                    this@ScreenTimeModule.sendEvent("onNativeBreakToggle", mapOf("suspended" to true))
                }
            }, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            context.registerReceiver(object : BroadcastReceiver() {
                override fun onReceive(context: Context?, intent: Intent?) {
                    this@ScreenTimeModule.sendEvent("onNativeBreakToggle", mapOf("suspended" to true))
                }
            }, filter)
        }
    }
  }

  private fun addToMaps(pkg: String, duration: Long, startTime: Long, hourlyMap: MutableMap<String, MutableMap<String, Long>>, dailyMap: MutableMap<String, Long>) {
      dailyMap[pkg] = (dailyMap[pkg] ?: 0L) + duration
      val calendar = Calendar.getInstance().apply { timeInMillis = startTime }
      val hour = calendar.get(Calendar.HOUR_OF_DAY).toString()
      val hourMap = hourlyMap.getOrPut(hour) { mutableMapOf() }
      hourMap[pkg] = (hourMap[pkg] ?: 0L) + duration
  }

  private fun bitmapToBase64(drawable: android.graphics.drawable.Drawable): String? {
    try {
        val bitmap = if (drawable is android.graphics.drawable.BitmapDrawable) drawable.bitmap else {
            val b = android.graphics.Bitmap.createBitmap(drawable.intrinsicWidth.takeIf { it > 0 } ?: 1, drawable.intrinsicHeight.takeIf { it > 0 } ?: 1, android.graphics.Bitmap.Config.ARGB_8888)
            val canvas = android.graphics.Canvas(b)
            drawable.setBounds(0, 0, canvas.width, canvas.height)
            drawable.draw(canvas)
            b
        }
        val outputStream = java.io.ByteArrayOutputStream()
        bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 70, outputStream)
        return android.util.Base64.encodeToString(outputStream.toByteArray(), android.util.Base64.NO_WRAP)
    } catch (e: Exception) { return null }
  }

  private fun syncBlockingService(context: Context) {
    val prefs = context.getSharedPreferences("UnlinkBlockingPrefs", Context.MODE_PRIVATE)
    val expiryTime = prefs.getLong("block_expiry_time", 0L)
    val isSessionActive = expiryTime > System.currentTimeMillis()
    
    val expectedService = "${context.packageName}/com.shahil.screentime.UnlinkAccessibilityService"
    val enabledServices = Settings.Secure.getString(context.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES)
    val hasAccessibility = enabledServices?.contains(expectedService) == true
    
    val intent = Intent(context, FallbackBlockingService::class.java)
    if (isSessionActive && !hasAccessibility) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
        } else {
            context.startService(intent)
        }
    } else {
        context.stopService(intent)
    }
  }
}
