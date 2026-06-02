# Unlink — Play Store Release Guide

The single source of truth for shipping Unlink to the Google Play Store.
Last updated: 2026-05. Re-verify the Play Console links if Google changes the flow.

---

## 0. ⚠️ Timeline reality — read this first

Google requires **personal** developer accounts (created after 2023‑11‑13) to run
**14 consecutive days of closed testing with ≥12 real testers** before you can
publish to **Production**. **Organization accounts are exempt.**

| Account type | Time to go live |
|---|---|
| **Organization** (needs business verification / D‑U‑N‑S) | ~3–7 day review only |
| **Personal** (new) | **14 days testing + 3–7 day review ≈ 3 weeks** |

> If Unlink is a registered business → create an **Organization** account to skip the 14‑day gate.
> If not → **start the closed test immediately** so the 14‑day clock runs while you finish everything else.
> "Going live in 2 days" is only possible on an Organization account. On a personal account you can
> *start* in 2 days, but the app won't be public for ~3 weeks.

---

## 1. ⚠️ Accessibility policy — the make-or-break item

Unlink uses the AccessibilityService to detect the foreground app and show a focus overlay.
This is a **permitted** use (same category as AppBlock, one sec, Stay Focused, Freedom — all live).
But it gets **manual review**, so do all of this:

- [x] **Do NOT** declare `isAccessibilityTool` (already removed — we are not a disability tool).
- [x] **Prominent in-app disclosure** before enabling (shipped: `AccessibilityDisclosureScreen`).
- [ ] Submit the **Permission Declaration Form** in Play Console.
- [ ] Provide a **demo video**: app opens → user enables Accessibility → blocking happens.
      Add captions/voice-over explaining *why* the service is used.
- [ ] Describe the data accessed (package name only) and that it stays **on-device**.

### 2026 tightening (know this)
- **Stricter review (enforced 2026‑01‑28):** accessibility apps get a tougher human review.
  App-blocking is still allowed; AI/RPA "screen-reading + auto-tapping" apps are now banned —
  we are NOT that, but say so plainly in the declaration.
- **Advanced Protection Mode:** on newer Android, if a user enables this security setting, the OS
  blocks non-accessibility-tool apps from turning on Accessibility. Small subset of users; not a
  Play blocker, just a functional limit on those devices.
- **Strict-Mode self-protection is the riskiest feature.** We use `performGlobalAction(BACK)` to
  bounce the user out of Settings/uninstall during a session. **Frame it in the declaration as
  user-initiated focus enforcement (a session the user chose to start), NOT device control.**
  Recommended: keep it **optional / off by default**. If a reviewer objects, disable it for the
  Play build rather than fighting it.
- **Device Admin API was removed (2026-05).** "Uninstall protection" used to request Device Admin
  (`DeviceAdminReceiver` + `force-lock`). That is gone because: (a) Android 7+ no longer lets Device
  Admin block uninstall, so it didn't even work, and (b) "app prevents its own removal" is the single
  biggest Play rejection trigger (malware signature). Uninstall protection is now enforced **only**
  by the accessibility strict-mode self-protection above — it detects the App Info / uninstall /
  force-stop screen during an active session and fires `BACK`. This is the same mechanism AppBlock /
  Stay Focused ship with and get approved. The old JS API (`requestAdmin`/`isAdminActive`/
  `deactivateAdmin`) now just toggles strict mode (see `modules/screen-time/index.ts`).

---

## 2. Build the release artifact (local)

Play requires a **release-signed AAB** (not a debug-signed APK).

### One-time: create the upload keystore (BACK IT UP FOREVER — losing it = can't update the app)
```bash
keytool -genkey -v -keystore unlink-release.keystore -alias unlink \
  -keyalg RSA -keysize 2048 -validity 10000
```

### One-time: add secrets to `~/.gradle/gradle.properties` (NEVER commit these)
```properties
UNLINK_STORE_FILE=/absolute/path/to/unlink-release.keystore
UNLINK_STORE_PASSWORD=your_store_password
UNLINK_KEY_ALIAS=unlink
UNLINK_KEY_PASSWORD=your_key_password
```
`android/app/build.gradle` already uses the `release` signingConfig when `UNLINK_STORE_FILE` is set,
and falls back to debug signing when it isn't. **If you forget these, you get a debug-signed build
that Play will reject.**

### Each release
```bash
# 1. Bump version in android/app/build.gradle
#    versionCode  -> integer, +1 every upload (e.g. 1 -> 2)
#    versionName  -> human string (e.g. "1.0.0" -> "1.0.1")

# 2. Build the AAB from the PROJECT ROOT (not from android/)
cd /Users/shahil/Documents/Coding/Personal/Startup/Unlink/Unlink-Application
cd android && ./gradlew bundleRelease

# 3. Output to upload:
#    android/app/build/outputs/bundle/release/app-release.aab
```

> You do **not** need `npx expo export` for a store build — gradle bundles the JS itself.
> Run commands from the project root. The `ConfigError: .../android/package.json does not exist`
> only appears when you run `expo`/gradle from the wrong directory; it's harmless.

### Alternative: EAS build (auto-manages signing)
```bash
eas build -p android --profile production   # eas.json already has a production profile
```

---

## 3. Play Console — account setup (web)

| # | Step | Where |
|---|------|-------|
| A1 | Create Play Developer account, pay **$25** one-time | play.google.com/console |
| A2 | Verify identity (government ID) + address | Play Console (1–2 days) |
| A3 | Accept **Play App Signing** (Google holds app key, you hold upload key) | Play Console |

---

## 4. Store listing & required declarations (web)

| # | Item | Spec / requirement | Done |
|---|------|--------------------|------|
| C1 | Title / short / full description | 30 / 80 / 4000 chars | [ ] |
| C2 | App icon | 512×512 PNG | [ ] |
| C3 | Feature graphic | 1024×500 | [ ] |
| C4 | Phone screenshots | 2–8 | [ ] |
| C5 | Privacy policy URL (must be **live**) | https://www.getunlink.com/privacy | [ ] |
| C6 | **AccessibilityService declaration + demo video** | enable→use flow (see §1) | [ ] |
| C7 | **Data Safety form** | Declare **email = collected** (via Resend); all else on-device. **Do NOT** select "no data collected." | [ ] |
| C8 | Sensitive permission declarations | `QUERY_ALL_PACKAGES`, `SCHEDULE_EXACT_ALARM` | [ ] |
| C9 | Content rating | IARC questionnaire (issued in minutes) | [ ] |
| C10 | Target audience, ads, government/news flags | standard forms | [ ] |

---

## 5. Testing → Production (web)

| # | Step | Notes | Done |
|---|------|-------|------|
| D1 | Upload AAB to **Internal testing** | instant; smoke-test on a real device | [ ] |
| D2 | Create **Closed testing** track, add ≥12 testers | personal accounts only | [ ] |
| D3 | Keep ≥12 testers opted in for **14 continuous days** | counter resets if you drop below 12 | [ ] |
| D4 | Apply for **production access** | personal accounts only | [ ] |
| D5 | Promote to **Production**, staged rollout (start 1–5%) | review 3–7 days for new devs | [ ] |

---

## 6. Future releases (the easy path)

Once the app is live and the account is established, updates go live in **<24h** with no re-testing:

1. Bump `versionCode` (+1) and `versionName` in `android/app/build.gradle`.
2. `cd android && ./gradlew bundleRelease` (or `eas build -p android --profile production`).
3. Upload the AAB to the **Production** track.
4. Use **staged rollout** every time so you can halt a bad release.
5. **Keep the same upload keystore forever** — it's the identity of the app.

---

## 7. Pre-submit checklist (final gate)

- [ ] Release-signed **AAB** built (not debug, not APK)
- [ ] `versionCode` bumped
- [ ] Privacy policy URL is live
- [ ] Accessibility declaration form + demo video submitted
- [ ] Data Safety declares email collection (Resend)
- [ ] `QUERY_ALL_PACKAGES` + `SCHEDULE_EXACT_ALARM` declared
- [ ] Strict-Mode self-protection framed as user-initiated (or off by default)
- [ ] Confirm **no Device Admin** (`BIND_DEVICE_ADMIN` / `DeviceAdminReceiver`) in the final merged manifest
- [ ] 14-day closed test passed (personal accounts)
- [ ] Store listing assets uploaded

---

## Reference links
- Use of the AccessibilityService API: https://support.google.com/googleplay/android-developer/answer/10964491
- Prominent disclosure & consent: https://support.google.com/googleplay/android-developer/answer/11150561
- New personal-account testing requirement: https://support.google.com/googleplay/android-developer/answer/14151465
- Create & set up your app: https://support.google.com/googleplay/android-developer/answer/9859152
- Declare permissions: https://support.google.com/googleplay/android-developer/answer/9214102
