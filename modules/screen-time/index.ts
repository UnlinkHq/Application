import { requireNativeModule, requireNativeViewManager, EventEmitter } from 'expo-modules-core';
import { Platform } from 'react-native';
// Define the native module interface
interface ScreenTimeModuleInterface {
    hasPermission(): Promise<boolean>;
    requestPermission(): void;
    isAdminActive(): boolean;
    requestAdmin(): void;
    deactivateAdmin(): void;
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
    getEngineHealth(): Promise<{
        overlay: boolean;
        accessibility: boolean;
        usage: boolean;
        batteryExempt: boolean;
        isEnforcing: boolean;
    }>;

    // Blocking & Dashboard Functions
    setBlockedApps(packageNames: string[], message: string, timeLeft: string): Promise<void>;
    setSurgicalFlags(youtubeShorts: boolean, instagramReels: boolean, studyMode?: boolean): void;
    setSurgicalConfig(config: any): void;
    setUninstallProtection(enabled: boolean): void;
    setSessionDuration(minutes: number): void;
    setBlockingSuspended(suspended: boolean): void;
    setSessionData(startTime: number, durationMins: number): void;
    setBreaksRemaining(count: number): void;
    getAppIcon(packageName: string): Promise<string>;
    stopBlockingService(): void;
    getGlobalBrainrot(): Promise<{score: number, date: string, shortsCount: number}>;
    setBlockExpiryTime(timestamp: number): void;
    updateGlobalBrainrot(delta: number): void;
    setGlobalBrainrot(score: number): void;

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
        isAdminActive: () => false,
        requestAdmin: () => { },
        deactivateAdmin: () => { },
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
        getEngineHealth: async () => ({
            overlay: false,
            accessibility: false,
            usage: false,
            batteryExempt: false,
            isEnforcing: false
        }),
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
        setGlobalBrainrot: () => { }
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

export function isAdminActive(): boolean {
    return ScreenTimeModule.isAdminActive();
}

export function requestAdmin(): void {
    ScreenTimeModule.requestAdmin();
}

export function deactivateAdmin(): void {
    ScreenTimeModule.deactivateAdmin();
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

export function setBlockingSuspended(suspended: boolean): void {
    ScreenTimeModule.setBlockingSuspended(suspended);
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

// Event Handling
const emitter = new EventEmitter(ScreenTimeModule as any);

export function addNativeBreakListener(listener: (event: any) => void): any {
  return (emitter as any).addListener('onNativeBreakToggle', listener);
}
