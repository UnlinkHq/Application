package com.shahil.screentime

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import android.widget.Toast

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
        val prefs = context.getSharedPreferences("UnlinkBlockingPrefs", Context.MODE_PRIVATE)
        val isProtected = prefs.getBoolean("is_uninstall_protected", false)
        
        return if (isProtected) {
            Toast.makeText(context, "UNLINK: Uninstall Protection is ACTIVE! 🛡️", Toast.LENGTH_LONG).show()
            "CRITICAL: PROTOCOL_ACTIVE. UNINSTALL_PROTECTION_IS_ENFORCED. DISABLE_NOT_ALLOWED."
        } else {
            "Disabling this will allow Unlink to be uninstalled."
        }
    }
}
