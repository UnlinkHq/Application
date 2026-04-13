package com.shahil.screentime

import android.app.AppOpsManager
import android.app.usage.UsageStats
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Process
import android.provider.Settings
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.Calendar

class ScreenTimeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ScreenTime")

    Function("isAdminActive") {
      val context = appContext.reactContext ?: return@Function false
      val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
      val adminComponent = ComponentName(context, UnlinkDeviceAdminReceiver::class.java)
      return@Function dpm.isAdminActive(adminComponent)
    }

    Function("requestAdmin") {
      val context = appContext.reactContext
      if (context != null) {
        val adminComponent = ComponentName(context, UnlinkDeviceAdminReceiver::class.java)
        val intent = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN)
        intent.putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, adminComponent)
        intent.putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION, "Enabling this prevents Unlink from being uninstalled.")
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
      }
    }

    Function("deactivateAdmin") {
      val context = appContext.reactContext
      if (context != null) {
        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val adminComponent = ComponentName(context, UnlinkDeviceAdminReceiver::class.java)
        dpm.removeActiveAdmin(adminComponent)
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

    Function("requestPermission") {
      val context = appContext.reactContext
      if (context != null) {
        val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
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
      
      // Track the currently active package and when it started
      var currentPkg: String? = null
      var currentStart: Long = 0L
      
      // Constants
      val MOVE_TO_FOREGROUND = android.app.usage.UsageEvents.Event.MOVE_TO_FOREGROUND
      val MOVE_TO_BACKGROUND = android.app.usage.UsageEvents.Event.MOVE_TO_BACKGROUND
      val SCREEN_INTERACTIVE = 15 // Screen On
      val SCREEN_NON_INTERACTIVE = 16 // Screen Off
      val KEYGUARD_SHOWN = 17 // Lock Screen
      val KEYGUARD_HIDDEN = 18 // Unlock
      val DEVICE_SHUTDOWN = 26

      while (events.hasNextEvent()) {
          events.getNextEvent(event)
          val pkg = event.packageName
          val time = event.timeStamp
          val type = event.eventType

          if (type == MOVE_TO_FOREGROUND) {
              // specific app started
              
              // If there was another app "open" (currentPkg), it implies we switched directly 
              // or the previous end event was missed. Close the previous session.
              if (currentPkg != null) {
                   val duration = time - currentStart
                   if (duration > 0) {
                      addToMaps(currentPkg!!, duration, currentStart, hourlyMap, dailyTotalMap)
                   }
              }

              // Start new session
              currentPkg = pkg
              currentStart = time
              
              // Count pickup
              pickupMap[pkg] = (pickupMap[pkg] ?: 0) + 1

          } else if (type == MOVE_TO_BACKGROUND) {
              // specific app ended
              if (currentPkg == pkg) {
                  val duration = time - currentStart
                  if (duration > 0) {
                      addToMaps(pkg, duration, currentStart, hourlyMap, dailyTotalMap)
                  }
                  currentPkg = null
              }
          } else if (type == SCREEN_NON_INTERACTIVE || type == KEYGUARD_SHOWN || type == DEVICE_SHUTDOWN) {
              // Device locked, Screen Off, or Shutdown -> End current session
              if (currentPkg != null) {
                  val duration = time - currentStart
                  if (duration > 0) {
                      addToMaps(currentPkg!!, duration, currentStart, hourlyMap, dailyTotalMap)
                  }
                  currentPkg = null
              }
          } else if (type == KEYGUARD_HIDDEN) { // Unlock
              pickupMap["total_pickups"] = (pickupMap["total_pickups"] ?: 0) + 1
          }
      }

      // If loop ends and app is still "open" (e.g. valid session until 'now'), close it.
      if (currentPkg != null) {
           val now = System.currentTimeMillis()
           // Use the smaller of 'endTime' (query limit) or 'now' (current time)
           // This prevents adding future time if we query for "Today" (ends at 23:59)
           val actualEnd = if (endTime.toLong() > now) now else endTime.toLong()
           
           val duration = actualEnd - currentStart
           if (duration > 0 && duration < 24 * 60 * 60 * 1000) { // Sanity check: < 24h
                addToMaps(currentPkg!!, duration, currentStart, hourlyMap, dailyTotalMap)
           }
      }
      
      return@AsyncFunction mapOf(
          "hourly" to hourlyMap,
          "daily" to dailyTotalMap,
          "pickups" to pickupMap
      )
    }

    AsyncFunction("getInstalledApps") {
      val context = appContext.reactContext ?: return@AsyncFunction listOf<Map<String, Any>>()
      val packageManager = context.packageManager
      
      val mainIntent = Intent(Intent.ACTION_MAIN, null)
      mainIntent.addCategory(Intent.CATEGORY_LAUNCHER)
      
      // Resolve launchable activities only to filter out background noise/extensions
      val resolvedActivities = packageManager.queryIntentActivities(mainIntent, 0)
      val appList = mutableListOf<Map<String, Any>>()
      val seenPackages = mutableSetOf<String>()

      for (resolveInfo in resolvedActivities) {
        val packageName = resolveInfo.activityInfo.packageName
        if (seenPackages.contains(packageName)) continue
        seenPackages.add(packageName)

        try {
            val applicationInfo = packageManager.getApplicationInfo(packageName, 0)
            val label = packageManager.getApplicationLabel(applicationInfo).toString()
            
            // Get Category (API 26+)
            val category = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                applicationInfo.category
            } else {
                -1 // Undefined
            }

            // Get Icon as Base64
            val iconDrawable = packageManager.getApplicationIcon(applicationInfo)
            val iconBase64 = bitmapToBase64(iconDrawable)

            if (label.isNotEmpty()) {
                appList.add(mapOf(
                    "packageName" to packageName,
                    "label" to label,
                    "icon" to (iconBase64 ?: ""),
                    "category" to category
                ))
            }
        } catch (e: Exception) {
            // Ignore apps we can't query
        }
      }
      return@AsyncFunction appList
    }
  }

  private fun addToMaps(
      pkg: String, 
      duration: Long, 
      startTime: Long, 
      hourlyMap: MutableMap<String, MutableMap<String, Long>>, 
      dailyMap: MutableMap<String, Long>
  ) {
      // Add to Daily
      dailyMap[pkg] = (dailyMap[pkg] ?: 0L) + duration

      // Add to Hourly
      val calendar = Calendar.getInstance()
      calendar.timeInMillis = startTime
      val hour = calendar.get(Calendar.HOUR_OF_DAY).toString()
      
      val hourMap = hourlyMap.getOrPut(hour) { mutableMapOf() }
      hourMap[pkg] = (hourMap[pkg] ?: 0L) + duration
  }

  private fun bitmapToBase64(drawable: android.graphics.drawable.Drawable): String? {
    try {
        val bitmap = if (drawable is android.graphics.drawable.BitmapDrawable) {
            drawable.bitmap
        } else {
            val bitmap = android.graphics.Bitmap.createBitmap(
                drawable.intrinsicWidth.takeIf { it > 0 } ?: 1,
                drawable.intrinsicHeight.takeIf { it > 0 } ?: 1,
                android.graphics.Bitmap.Config.ARGB_8888
            )
            val canvas = android.graphics.Canvas(bitmap)
            drawable.setBounds(0, 0, canvas.width, canvas.height)
            drawable.draw(canvas)
            bitmap
        }

        val outputStream = java.io.ByteArrayOutputStream()
        // Compress to PNG, quality 100 (lossless) or lower for size
        bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 70, outputStream)
        val byteArray = outputStream.toByteArray()
        return android.util.Base64.encodeToString(byteArray, android.util.Base64.NO_WRAP)
    } catch (e: Exception) {
        return null
    }
  }
}
