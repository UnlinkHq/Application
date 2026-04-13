import { requireNativeModule, requireNativeViewManager } from 'expo-modules-core';
import { ViewProps } from 'react-native';

// Define the native module interface
interface ScreenTimeModuleInterface {
    hasPermission(): Promise<boolean>;
    requestPermission(): void;
    isAdminActive(): boolean;
    requestAdmin(): void;
    deactivateAdmin(): void;
    getUsageStats(startTime: number, endTime: number): Promise<any>;
    getInstalledApps(): Promise<{ packageName: string, label: string, icon: string, category?: number }[]>;
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
        requestPermission: () => {
            console.warn('[ScreenTime] requestPermission: Native module missing.');
        },
        isAdminActive: () => false,
        requestAdmin: () => {},
        deactivateAdmin: () => {},
        getUsageStats: async () => ({}),
        getInstalledApps: async () => [],
        activateShield: () => {},
        deactivateShield: () => {},
        getSelectionCount: () => 0
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

export function activateShield(): void {
    ScreenTimeModule.activateShield();
}

export function deactivateShield(): void {
    ScreenTimeModule.deactivateShield();
}

export function getSelectionCount(): number {
    return ScreenTimeModule.getSelectionCount();
}
