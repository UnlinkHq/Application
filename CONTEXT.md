# Unlink

A React Native / Expo app & focus blocker for Android (and iOS) that helps users manage screen time by blocking distracting apps. The core mechanic is the **BlockSession** — a user-configured period of enforced app blocking enforced at the OS level via a native module.

---

## Language

### Core Session Concepts

**BlockSession**:
The central data object representing a configured block — holds the apps to block, duration, strictness config, break allowances, and schedule. Exists in two modes: `block_now` and `schedule`.
_Avoid_: Session, rule, block config

**Block Now** (`type: 'block_now'`):
A manually triggered BlockSession that starts immediately and runs for a fixed duration.
_Avoid_: Manual block, instant block, one-time block

**Schedule** (`type: 'schedule'`):
A BlockSession configured to auto-activate on specific days and times via the TemporalEngine. Persists in the Library.
_Avoid_: Recurring block, timed block, automatic block

**Active Session**:
The single BlockSession currently enforced on the device. Only one can be active at a time. Stored in AsyncStorage under `@unlink_active_session`.
_Avoid_: Current session, running block, live block

**Library**:
The user's saved collection of BlockSessions (both `block_now` templates and `schedule` entries). Stored under `@unlink_library_blocks`.
_Avoid_: Saved blocks, templates, presets

**Session History**:
A log of completed or interrupted BlockSessions. Stored under `@unlink_session_history`. Used for streak calculation and analytics.
_Avoid_: Block history, past sessions, logs

---

### Blocking & Enforcement

**Focus Protocol**:
The atomic native call (`startFocusProtocol`) that commits all session state to the native layer in a single write — apps to block, duration, surgical flags, break config, and strict mode. Eliminates race conditions from the old multi-call approach.
_Avoid_: Native sync, block activation, start blocking

**Native Layer**:
The Android native module (`modules/screen-time`) that enforces blocking at the OS level. Receives session state from JS via `startFocusProtocol` and related calls.
_Avoid_: Native module, Android module, OS layer

**Hard Block**:
An app that is fully blocked via the native layer — no access at all.
_Avoid_: Full block, complete block

**Surgical Block** (`scrollingProtocol`):
A per-app mode where the app is NOT hard-blocked but scrolling/feed content is intercepted. Currently supported for YouTube and Instagram.
_Avoid_: Soft block, partial block, scroll block

**Strict Mode** (`strictnessConfig.isUninstallProtected`):
A session configuration that prevents the user from uninstalling Unlink to escape a block. Enforced at the native layer.
_Avoid_: Hard mode, locked mode

**Strictness Mode** (`strictnessConfig.mode`):
The escalation level of session enforcement. Values: `normal`, `qr_code`, `mom_test`, `money`.
_Avoid_: Difficulty, lock level

---

### Breaks & Integrity

**Timed Break** (`timedBreaks`):
A short, permitted pause within an active BlockSession. The user has a fixed allowance of breaks (`allowedCount`), each of fixed duration (`durationMins`).
_Avoid_: Pause, rest, exception

**Break Overlay**:
The full-screen UI component (`BreakOverlay.tsx`) shown when the user is on a Timed Break. Displays countdown and prevents interaction with blocked apps.
_Avoid_: Break screen, pause screen

**Integrity Break**:
An event recorded when a BlockSession was force-terminated unexpectedly (e.g. the user killed the app). Detected on next launch via the native layer and triggers consequences: streak break, brainrot penalty, and optional accountability partner email.
_Avoid_: Session break, force stop, kill event

**Brainrot Score**:
A running penalty score (`globalBrainrot`) incremented when a user abuses breaks, force-stops sessions, or watches excessive short-form video. Displayed to the user as a measure of digital discipline.
_Avoid_: Penalty, score, damage

---

### Scheduling & Time

**TemporalEngine**:
A JS service that polls every 10 seconds to check whether any scheduled BlockSessions should auto-activate or auto-terminate based on the current time. It is the only place schedule deployment logic lives.
_Avoid_: Scheduler, cron, schedule checker

**Schedule Window**:
The time range `[startTime, endTime]` on specific days during which a Schedule BlockSession is active. Can cross midnight.
_Avoid_: Block window, time slot, block period

**Midnight-Crossing Schedule**:
A Schedule whose `endTime` is earlier in the day than its `startTime` (i.e. starts at 23:00, ends at 06:00). Requires special handling for stop records and duration calculation.
_Avoid_: Overnight schedule, cross-day schedule

**Stop Record**:
A per-schedule record (keyed by `@unlink_stop_record_<id>`) that marks the date a user manually stopped a Schedule. Prevents the TemporalEngine from re-deploying the same schedule window the user opted out of.
_Avoid_: Manual stop log, opt-out record

---

### Accountability & Metrics

**Accountability Partner**:
An optional email address configured in `strictnessConfig.emailAddress` that receives an alert email (via ResendService) when an Integrity Break occurs.
_Avoid_: Partner, monitor, guardian

**Session Streak**:
A count of consecutive days the user completed their BlockSessions without Integrity Breaks. Derived from Session History.
_Avoid_: Streak, combo, run

**MetricsEngine**:
A service responsible for computing user-facing analytics — streak, brainrot trends, usage summaries. Reads from Session History and ScreenTime data.
_Avoid_: Analytics engine, stats service

---

### Platform & Architecture

**Screen Time Module** (`modules/screen-time`):
The Expo native module that bridges JS to Android OS APIs — provides usage stats, blocking enforcement, brainrot tracking, and schedule syncing.
_Avoid_: Native module, Android SDK, permissions module

**FocusStorageService**:
The single source of truth for all session persistence — active session, library, history, and integrity breaks. All reads and writes to AsyncStorage go through here.
_Avoid_: Storage, persistence layer, database

**BlockingContext**:
The React context that exposes real-time blocking state (isBlocked, timer, progress) to UI components without them needing to know about the storage or native layers.
_Avoid_: Block state, global state, context

---

> **Note for AI agents:** When a new term is resolved during a `/grill-with-docs` or `/domain-modeling` session, add it here immediately under the appropriate section. Keep definitions to 1-2 sentences. Only include terms specific to Unlink — no generic programming concepts.
