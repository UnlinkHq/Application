# Privacy Policy — Unlink

**Effective Date:** 26 May 2025
**App:** Unlink — Focus & Screen Time
**Developer:** Shahil KV
**Contact:** mshahilkv@gmail.com
**Website:** https://www.getunlink.com/privacy

---

## Overview

Unlink is a digital wellbeing app that helps you manage screen time and reduce compulsive app usage. We built Unlink on a simple principle: **your data stays on your device.** We do not sell data, run ads, or upload your behaviour to any server. Unlink is open source so users can inspect how the app works.

This policy explains exactly what we access, why, and what we never do.

---

## 1. Accessibility Service

Unlink uses Android's Accessibility Service API. This is required to reliably detect which app is in the foreground so we can show a focus reminder when you open a blocked app.

**What the service reads:**
- The package name of the app currently on screen (e.g. `com.instagram.android`)
- In Surgical Mode only: whether specific UI elements inside YouTube or Instagram are visible, identified by their resource ID (e.g. `com.google.android.youtube:id/reel_recycler`). This tells us if you are in Shorts or Reels — not what you are watching.

**What the service never reads:**
- Passwords, PINs, or payment card numbers
- Password fields or login credentials. Never share your passwords with Unlink or anyone claiming to represent Unlink.
- Messages, emails, or notifications
- Browser history or URLs
- Screen content from any app other than for the package name check described above
- Keystrokes or clipboard contents

**Where this data goes:** Nowhere. All Accessibility Service processing happens locally on your device. No accessibility data is transmitted to any server, including ours.

**How to disable it:** Android Settings → Accessibility → Installed Services → Unlink Focus Guard → Off. Disabling the service will pause app blocking.

---

## 2. App Usage Statistics (PACKAGE_USAGE_STATS)

We request access to Android's Usage Stats API to:
- Show you how much time you have spent in each app today
- Calculate your daily Brainrot Score (an engagement metric for Shorts and Reels usage)
- Display your focus session history

This data is stored locally on your device and never uploaded.

---

## 3. Display Over Other Apps (SYSTEM_ALERT_WINDOW)

This permission allows Unlink to draw the blocking overlay screen above other apps when a focus session is active. We use it exclusively to show our own blocking UI — we do not use it to read or interact with any other app's content.

---

## 4. Focus Session Protection (Optional)

Focus Session Protection is optional and off by default. If you manually enable it, Unlink uses the already-granted Accessibility Service during a focus session you started to help keep that session active until its timer ends.

- This feature is entirely optional
- It is only active during a user-started focus session
- It does not use Device Administrator permission
- It does not block other apps' settings
- We do not use it to wipe data, change your lock screen password, read passwords, or monitor your device

You can disable it inside Unlink settings. You can also disable Unlink's Accessibility Service at any time in Android Settings → Accessibility → Unlink Focus Guard → Off.

---

## 5. Camera (Optional)

The camera permission is used only if you select **QR Code** as your strictness mode. In this mode, a QR code is generated at the start of your session, and you must scan it to end the session early. The camera is never accessed outside of this specific flow.

---

## 6. Email Address (Mom Test Feature Only)

The **Mom Test** feature lets you nominate a trusted contact (such as a parent or friend) who receives a one-time verification code when you request to end a locked focus session early.

- You provide the email address voluntarily when setting up this feature
- The email address is stored locally on your device
- When you request early termination, the email address and a one-time code are sent to our email proxy, which forwards it via Resend.com
- **We do not store your trusted contact's email on any server.** The proxy receives the request, sends the email, and discards the data immediately
- Resend.com's privacy policy applies to the email delivery: resend.com/privacy

If you do not use the Mom Test feature, no email data is ever collected or transmitted.

---

## 7. Internet Permission

The app requests internet access for:
- Sending verification emails via the Mom Test feature (described above)
- No other network requests are made from the app

We do not use the internet permission for analytics, advertising, crash reporting, or any background data upload.

---

## 8. Data We Store Locally

The following data is stored on your device in local storage. None of it is uploaded.

| Data | Purpose |
|------|---------|
| Block list (app package names) | Your chosen apps to block |
| Focus session history | Showing your past sessions |
| Brainrot score and scroll count | Daily engagement metric |
| Schedule configurations | Your recurring focus schedules |
| Break settings and counts | Managing breaks within a session |
| Session state (expiry time, suspension) | Maintaining blocking across reboots |
| Trusted contact email | Mom Test feature (local only) |

---

## 9. Data We Do Not Collect

- We do not collect analytics or crash reports
- We do not use Firebase, Mixpanel, Amplitude, or any analytics SDK
- We do not have user accounts or a user database
- We do not collect device identifiers (IMEI, advertising ID)
- We do not track your location

---

## 10. Third-Party Services

The only cloud provider Unlink uses for user data is **Resend.com**, and only when the Mom Test feature is used to send a verification email. Resend acts as our email delivery provider. Everything else in Unlink is processed and stored on-device.

We do not use Firebase Analytics, Mixpanel, Amplitude, advertising SDKs, or third-party tracking services.

Resend's privacy policy: resend.com/privacy

---

## 11. Children's Privacy

Unlink is not directed at children under 13. We do not knowingly collect personal information from children. If you believe your child has provided information through this app, contact us and we will delete it.

---

## 12. Data Deletion

Because all data is stored locally on your device, you can delete it at any time by:
- Clearing app data in Android Settings → Apps → Unlink → Storage → Clear Data
- Uninstalling the app

For any data that passed through our email proxy (Mom Test emails), contact mshahilkv@gmail.com and we will confirm deletion from any logs within 30 days.

---

## 13. Note on Banking Applications

Some banking and financial apps detect when any Accessibility Service is active on the device and show a security warning or refuse to open. This is a security policy enforced by those apps — not a data collection practice by Unlink. If your banking app is affected, temporarily disable Unlink's accessibility service in Android Settings → Accessibility → Unlink Focus Guard → Off, complete your banking, then re-enable it.

---

## 14. Changes to This Policy

We will update the Effective Date at the top of this page when changes are made. Significant changes will be notified in-app.

---

## 15. Contact

**Shahil KV**
mshahilkv@gmail.com
https://www.getunlink.com/privacy
