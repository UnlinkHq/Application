const { withAndroidManifest } = require('@expo/config-plugins');

const withUnlinkAccessibility = (config) => {
  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults.manifest;
    
    // 1. Add tools namespace for merger overrides
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

    // 2. Add Permissions for Android 14+ support
    const permissions = [
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
      'android.permission.VIBRATE',
      'android.permission.RECEIVE_BOOT_COMPLETED',
      'android.permission.BIND_ACCESSIBILITY_SERVICE'
    ];

    manifest['uses-permission'] = manifest['uses-permission'] || [];
    permissions.forEach(permission => {
      if (!manifest['uses-permission'].some(p => p.$['android:name'] === permission)) {
        manifest['uses-permission'].push({ $: { 'android:name': permission } });
      }
    });

    const application = manifest.application[0];
    
    // 3. Register UnlinkAccessibilityService
    const service = {
      $: {
        'android:name': 'com.shahil.screentime.UnlinkAccessibilityService',
        'android:permission': 'android.permission.BIND_ACCESSIBILITY_SERVICE',
        'android:exported': 'true',
        'android:foregroundServiceType': 'specialUse',
        'android:label': 'Unlink Surgical Engine'
      },
      'intent-filter': [{
        action: [{ $: { 'android:name': 'android.accessibilityservice.AccessibilityService' } }]
      }],
      'meta-data': [{
        $: {
          'android:name': 'android.accessibilityservice',
          'android:resource': '@xml/accessibility_service_config'
        }
      }]
    };

    application.service = application.service || [];
    // Remove old registration if exists
    application.service = application.service.filter(s => s.$['android:name'] !== service.$['android:name']);
    application.service.push(service);

    // 4. Register BootReceiver (with tools:replace to avoid merger fail)
    const receiver = {
      $: {
        'android:name': 'com.shahil.screentime.BootReceiver',
        'android:exported': 'true',
        'tools:replace': 'android:exported'
      },
      'intent-filter': [{
        action: [
            { $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } },
            { $: { 'android:name': 'android.intent.action.QUICKBOOT_POWERON' } }
        ]
      }]
    };

    application.receiver = application.receiver || [];
    application.receiver = application.receiver.filter(r => r.$['android:name'] !== receiver.$['android:name']);
    application.receiver.push(receiver);

    return config;
  });
};

module.exports = withUnlinkAccessibility;
