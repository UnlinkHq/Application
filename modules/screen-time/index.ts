import { requireNativeModule, requireNativeViewManager, EventEmitter } from 'expo-modules-core';
import { Platform } from 'react-native';
// Define the native module interface
interface ScreenTimeModuleInterface {
    hasPermission(): Promise<boolean>;
    requestPermission(): void;
    getUsageStats(startTime: number, endTime: number): Promise<any>;
    getInstalledApps(): Promise<{ packageName: string, label: string, icon: string, category?: number }[]>;

    // Permission Functions
    hasOverlayPermission(): Promise<boolean>;
    requestOverlayPermission(): void;
    isAccessibilityServiceEnabled(): Promise<boolean>;
    requestAccessibilityPermission(): Promise<void>;
    isUsageStatsPermissionGranted(): Promise<boolean>;
    requestUsageStatsPermission(): Promise<void>;
    openAppInfoSettings(): Promise<void>;

    // Persistence Functions
    isBatteryOptimizationExempted(): Promise<boolean>;
    requestBatteryOptimizationExemption(): void;
    openBatteryOptimizationSettings(): void;
    getEngineHealth(): Promise<{
        overlay: boolean;
        accessibility: boolean;
        usage: boolean;
        batteryExempt: boolean;
        isEnforcing: boolean;
    }>;

    // Blocking & Dashboard Functions
    startFocusProtocol(config: {
        apps: string[];
        durationMins: number;
        surgicalFlags: { youtube: boolean; instagram: boolean };
        breaksRemaining: number;
        breakDurationMs: number;
        strictMode: boolean;
    }): void;
    setBlockedApps(packageNames: string[], message: string, timeLeft: string): Promise<void>;
    setSurgicalFlags(youtubeShorts: boolean, instagramReels: boolean, studyMode?: boolean): void;
    setSurgicalConfig(config: any): void;
    setUninstallProtection(enabled: boolean): void;
    setSessionDuration(minutes: number): void;
    setBlockingSuspended(suspended: boolean, durationMs?: number): void;
    setSessionData(startTime: number, durationMins: number): void;
    setBreaksRemaining(count: number): void;
    getAppIcon(packageName: string): Promise<string>;
    stopBlockingService(): void;
    getGlobalBrainrot(): Promise<{score: number, date: string, shortsCount: number}>;
    setBlockExpiryTime(timestamp: number): void;
    updateGlobalBrainrot(delta: number): void;
    setGlobalBrainrot(score: number): void;
    setNativeSchedules(schedulesJson: string): void;
    setNativeStopRecord(blockId: string, dateStr: string): void;
    setStrictMode(enabled: boolean): void;
    getStrictMode(): Promise<boolean>;
    isDefaultLauncher(): boolean;
    setLauncherEnabled(enabled: boolean): void;
    openHomeSettings(): void;
    consumeIntegrityBreak(): Promise<{ pending: boolean; silenceMs?: number; sessionStart?: number }>;
    canScheduleExactAlarms(): boolean;
    requestExactAlarmPermission(): void;

    // OEM background-survival ("don't kill my app")
    getManufacturer(): string;
    openAutoStartSettings(): boolean;

    // iOS Shield functions
    activateShield(): void;
    deactivateShield(): void;
    getSelectionCount(): number;
}

// Get the native module with a safe fallback
let ScreenTimeModule: ScreenTimeModuleInterface;

try {
    ScreenTimeModule = requireNativeModule<ScreenTimeModuleInterface>('ScreenTime');
} catch (error) {
    console.warn('[ScreenTime] Native module not found. Using fallbacks. Error:', error);
    // Mock implementation for development/Expo Go
    ScreenTimeModule = {
        hasPermission: async () => false,
        requestPermission: () => { },
        getUsageStats: async () => ({}),
        getInstalledApps: async () => [],
        hasOverlayPermission: async () => false,
        requestOverlayPermission: () => { },
        isAccessibilityServiceEnabled: async () => false,
        requestAccessibilityPermission: async () => { },
        isUsageStatsPermissionGranted: async () => false,
        requestUsageStatsPermission: async () => { },
        openAppInfoSettings: async () => { },
        isBatteryOptimizationExempted: async () => false,
        requestBatteryOptimizationExemption: () => { },
        openBatteryOptimizationSettings: () => { },
        getEngineHealth: async () => ({
            overlay: false,
            accessibility: false,
            usage: false,
            batteryExempt: false,
            isEnforcing: false
        }),
        startFocusProtocol: () => { },
        setBlockedApps: async () => { },
        setSurgicalFlags: () => { },
        setSurgicalConfig: () => { },
        setUninstallProtection: () => { },
        setSessionDuration: () => { },
        setBlockingSuspended: () => { },
        setSessionData: () => { },
        setBreaksRemaining: () => { },
        getAppIcon: async () => '',
        stopBlockingService: () => { },
        getGlobalBrainrot: async () => ({ score: 0, date: '', shortsCount: 0 }),
        activateShield: () => { },
        deactivateShield: () => { },
        getSelectionCount: () => 0,
        setBlockExpiryTime: () => { },
        updateGlobalBrainrot: () => { },
        setGlobalBrainrot: () => { },
        setNativeSchedules: () => { },
        setNativeStopRecord: () => { },
        setStrictMode: () => { },
        getStrictMode: async () => false,
        isDefaultLauncher: () => false,
        setLauncherEnabled: () => { },
        openHomeSettings: () => { },
        consumeIntegrityBreak: async () => ({ pending: false }),
        canScheduleExactAlarms: () => true,
        requestExactAlarmPermission: () => { },
        getManufacturer: () => 'unknown',
        openAutoStartSettings: () => false
    };
}

export default ScreenTimeModule;

// Native View for iOS App Picker
export const FamilyPickerView = requireNativeViewManager('ScreenTime');

export async function hasPermission(): Promise<boolean> {
    return await ScreenTimeModule.hasPermission();
}

export function requestPermission(): void {
    ScreenTimeModule.requestPermission();
}

// ── Uninstall protection — accessibility-only (no Device Admin) ───────────────
// For the Play launch we deliberately do NOT use Device Admin (the Accessibility +
// "prevents uninstall" combo is the highest review-risk pattern; Regain ships
// accessibility-only and is approved). Uninstall protection is enforced entirely by
// the strict-mode self-protection in UnlinkAccessibilityService: during a session it
// detects + bounces (with an overlay shield) the App Info / uninstall / force-stop /
// accessibility / overlay screens. These three functions keep the original API
// surface so callers don't change — they just toggle the strict-mode flag.
// (Device Admin is a deliberate post-launch Phase 2 — see RELEASE.md §1.)
let _uninstallProtectionCache = false;
getStrictMode().then(v => { _uninstallProtectionCache = v; }).catch(() => { });

export function isAdminActive(): boolean {
    return _uninstallProtectionCache;
}

export function requestAdmin(): void {
    _uninstallProtectionCache = true;
    setStrictMode(true);
}

export function deactivateAdmin(): void {
    _uninstallProtectionCache = false;
    setStrictMode(false);
}

// ── Launcher resilience (optional, opt-in) ───────────────────────────────────
// Making Unlink the Home app stops aggressive OEM battery-killers from tearing
// down the focus engine (this is how Regain "feels unbreakable"). The HOME alias
// ships DISABLED, so there is zero behavior change unless the user opts in here.
export function isDefaultLauncher(): boolean {
    try { return ScreenTimeModule.isDefaultLauncher(); } catch { return false; }
}

// Enables the HOME alias, then opens the system Home-app picker so the user can
// choose Unlink. Call from a clearly-labelled, optional settings toggle.
export function enableLauncherResilience(): void {
    ScreenTimeModule.setLauncherEnabled(true);
    ScreenTimeModule.openHomeSettings();
}

// Disables the alias. The user should also re-pick their normal launcher in
// Settings (openHomeSettings) — Android can't switch the default Home for them.
export function disableLauncherResilience(): void {
    ScreenTimeModule.setLauncherEnabled(false);
}

export function openHomeSettings(): void {
    ScreenTimeModule.openHomeSettings();
}

export async function getUsageStats(startTime: number, endTime: number): Promise<any> {
    return await ScreenTimeModule.getUsageStats(startTime, endTime);
}

export async function getInstalledApps(): Promise<{ packageName: string, label: string, icon: string, category?: number }[]> {
    return await ScreenTimeModule.getInstalledApps();
}

export async function hasOverlayPermission(): Promise<boolean> {
    return await ScreenTimeModule.hasOverlayPermission();
}

export function requestOverlayPermission(): void {
    ScreenTimeModule.requestOverlayPermission();
}

export function startFocusProtocol(config: {
    apps: string[];
    durationMins: number;
    surgicalFlags: { youtube: boolean; instagram: boolean };
    breaksRemaining: number;
    breakDurationMs: number;
    strictMode: boolean;
}): void {
    ScreenTimeModule.startFocusProtocol(config);
}

export function setBlockedApps(packageNames: string[], message: string, timeLeft: string): void {
    ScreenTimeModule.setBlockedApps(packageNames, message, timeLeft);
}

export function setSurgicalFlags(youtubeShorts: boolean, instagramReels: boolean, studyMode: boolean = false): void {
    ScreenTimeModule.setSurgicalFlags(youtubeShorts, instagramReels, studyMode);
}

export function setSurgicalConfig(config: any): void {
    ScreenTimeModule.setSurgicalConfig(config);
}

export function setUninstallProtection(enabled: boolean): void {
    ScreenTimeModule.setUninstallProtection(enabled);
}

export function setSessionDuration(minutes: number): void {
    ScreenTimeModule.setSessionDuration(Math.floor(minutes));
}

export function setBlockingSuspended(suspended: boolean, durationMs?: number): void {
    ScreenTimeModule.setBlockingSuspended(suspended, durationMs);
}

export function setSessionData(startTime: number, durationMins: number): void {
    ScreenTimeModule.setSessionData(startTime, durationMins);
}

export function setBreaksRemaining(count: number): void {
    ScreenTimeModule.setBreaksRemaining(count);
}

export function setBlockExpiryTime(timestamp: number): void {
    ScreenTimeModule.setBlockExpiryTime(timestamp);
}

export async function getAppIcon(packageName: string): Promise<string> {
    return await ScreenTimeModule.getAppIcon(packageName);
}

export function stopBlockingService(): void {
    ScreenTimeModule.stopBlockingService();
}

export function activateShield(): void {
    ScreenTimeModule.activateShield();
}

export function deactivateShield(): void {
    ScreenTimeModule.deactivateShield();
}

export function getSelectionCount(): number {
    return ScreenTimeModule.getSelectionCount();
}

export async function isAccessibilityServiceEnabled(): Promise<boolean> {
    return await ScreenTimeModule.isAccessibilityServiceEnabled();
}

export function requestAccessibilityPermission(): void {
    ScreenTimeModule.requestAccessibilityPermission();
}

export async function isBatteryOptimizationExempted(): Promise<boolean> {
    return await ScreenTimeModule.isBatteryOptimizationExempted();
}

export function requestBatteryOptimizationExemption(): void {
    ScreenTimeModule.requestBatteryOptimizationExemption();
}

export function openBatteryOptimizationSettings(): void {
    ScreenTimeModule.openBatteryOptimizationSettings();
}

export async function openAppInfoSettings(): Promise<void> {
    return await ScreenTimeModule.openAppInfoSettings();
}

export async function requestUsageStatsPermission(): Promise<void> {
    return await ScreenTimeModule.requestUsageStatsPermission();
}

export async function getEngineHealth() {
    return await ScreenTimeModule.getEngineHealth();
}

export async function getGlobalBrainrot(): Promise<{score: number, date: string, shortsCount: number}> {
    if (Platform.OS !== 'android') return {score: 0, date: '', shortsCount: 0};
    try {
        return await ScreenTimeModule.getGlobalBrainrot();
    } catch (e) {
        return {score: 0, date: '', shortsCount: 0};
    }
}

export function updateGlobalBrainrot(delta: number): void {
    ScreenTimeModule.updateGlobalBrainrot(delta);
}

export function setGlobalBrainrot(score: number): void {
    ScreenTimeModule.setGlobalBrainrot(score);
}

export function setNativeSchedules(schedulesJson: string): void {
    ScreenTimeModule.setNativeSchedules(schedulesJson);
}

export function setNativeStopRecord(blockId: string, dateStr: string): void {
    ScreenTimeModule.setNativeStopRecord(blockId, dateStr);
}

export function setStrictMode(enabled: boolean): void {
    ScreenTimeModule.setStrictMode(enabled);
}

export async function getStrictMode(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    return await ScreenTimeModule.getStrictMode();
}

export async function consumeIntegrityBreak(): Promise<{ pending: boolean; silenceMs?: number; sessionStart?: number }> {
    if (Platform.OS !== 'android') return { pending: false };
    try {
        return await ScreenTimeModule.consumeIntegrityBreak();
    } catch {
        return { pending: false };
    }
}

// Event Handling
const emitter = new EventEmitter(ScreenTimeModule as any);

export function addNativeBreakListener(listener: (event: any) => void): any {
  return (emitter as any).addListener('onNativeBreakToggle', listener);
}

export function canScheduleExactAlarms(): boolean {
    return ScreenTimeModule.canScheduleExactAlarms();
}

export function requestExactAlarmPermission(): void {
    ScreenTimeModule.requestExactAlarmPermission();
}

export function getManufacturer(): string {
    try {
        return ScreenTimeModule.getManufacturer();
    } catch {
        return 'unknown';
    }
}

export function openAutoStartSettings(): boolean {
    try {
        return ScreenTimeModule.openAutoStartSettings();
    } catch {
        return false;
    }
}
