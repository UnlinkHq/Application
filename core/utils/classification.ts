export enum AppCategory {
  DISTRACTION = 'DISTRACTION',
  PRODUCTIVITY = 'PRODUCTIVITY'
}

const ANDROID_CATEGORY_MAP: Record<number, AppCategory> = {
  0: AppCategory.DISTRACTION,   // Games
  1: AppCategory.DISTRACTION,   // Audio (Entertainment -> Distraction)
  2: AppCategory.DISTRACTION,   // Video (Entertainment -> Distraction)
  3: AppCategory.DISTRACTION,   // Image
  4: AppCategory.DISTRACTION,   // Social
  5: AppCategory.PRODUCTIVITY,  // News
  6: AppCategory.PRODUCTIVITY,  // Maps
  7: AppCategory.PRODUCTIVITY   // Productivity
};

const PACKAGE_NAME_OVERRIDES: Record<string, AppCategory> = {
  // Distractions (Social, Entertainment, Reddit, YouTube)
  'com.instagram.android': AppCategory.DISTRACTION,
  'com.facebook.katana': AppCategory.DISTRACTION,
  'com.twitter.android': AppCategory.DISTRACTION,
  'com.zhiliaoapp.musically': AppCategory.DISTRACTION, // TikTok
  'com.reddit.frontpage': AppCategory.DISTRACTION,
  'com.whatsapp': AppCategory.DISTRACTION,
  'com.snapchat.android': AppCategory.DISTRACTION,
  'com.google.android.youtube': AppCategory.DISTRACTION,
  'com.netflix.mediaclient': AppCategory.DISTRACTION,
  'com.disney.disneyplus': AppCategory.DISTRACTION,
  'com.hulu': AppCategory.DISTRACTION,
  'com.spotify.music': AppCategory.DISTRACTION,
  'com.amazon.mShop.android.shopping': AppCategory.DISTRACTION,
  'com.ebay.mobile': AppCategory.DISTRACTION,
  'com.flipkart.android': AppCategory.DISTRACTION,
  
  // Explicit Productivity overrides
  'com.slack': AppCategory.PRODUCTIVITY,
  'com.microsoft.teams': AppCategory.PRODUCTIVITY,
  'com.google.android.apps.docs': AppCategory.PRODUCTIVITY,
  'com.adobe.reader': AppCategory.PRODUCTIVITY,
  'com.google.android.calendar': AppCategory.PRODUCTIVITY,
  'com.google.android.gm': AppCategory.PRODUCTIVITY, // Gmail
};

// System apps that must ALWAYS be in Productivity (Common Noise)
const SYSTEM_TOOLS = [
    'com.android.settings',
    'com.android.calculator2',
    'com.android.calendar',
    'com.android.deskclock',
    'com.android.contacts',
    'android.contacts',
    'com.android.camera2',
    'android.camera2',
    'com.android.documentsui',
    'android.documentsui',
    'com.android.stk',
    'android.stk',
    'apps.messaging',
    'com.google.android.apps.messaging',
    'com.android.vending', // Play Store
    'com.google.android.googlequicksearchbox',
    'com.google.android.apps.maps',
    'com.android.chrome',
    'exp.exponent', // Expo Go
];

export function classifyApp(packageName: string, androidCategory?: number): AppCategory {
  // 1. Look for explicit package name overrides (highest priority)
  if (PACKAGE_NAME_OVERRIDES[packageName]) {
    return PACKAGE_NAME_OVERRIDES[packageName];
  }

  // 2. Fallback: Identify basic tools (known system noise)
  if (SYSTEM_TOOLS.includes(packageName) || packageName.includes('android.')) {
    return AppCategory.PRODUCTIVITY;
  }

  // 3. Check Android system category
  if (androidCategory !== undefined && androidCategory !== -1) {
    return ANDROID_CATEGORY_MAP[androidCategory] || AppCategory.PRODUCTIVITY;
  }

  return AppCategory.PRODUCTIVITY; // Default to productivity for safety
}

export const CATEGORY_LABELS: Record<AppCategory, { label: string, color: string }> = {
  [AppCategory.DISTRACTION]: { label: 'DISTRACTION', color: '#ffb4aa' },
  [AppCategory.PRODUCTIVITY]: { label: 'PRODUCTIVITY', color: '#c4e3f3' },
};
