package com.shahil.screentime

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class UnlinkDeviceAdminReceiver : DeviceAdminReceiver() {
    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
        Log.d("UnlinkAdmin", "Device Admin Enabled")
    }

    override fun onDisabled(context: Context, intent: Intent) {
        super.onDisabled(context, intent)
        Log.d("UnlinkAdmin", "Device Admin Disabled")
    }

    override fun onDisableRequested(context: Context, intent: Intent): CharSequence? {
        // You can return a message here to show to the user when they try to deactivate admin
        return "Disabling this will allow Unlink to be uninstalled."
    }
}
