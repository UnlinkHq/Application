import { requireNativeModule } from 'expo-modules-core';

// Define the native module interface
interface ScreenTimeModuleInterface {
    hasPermission(): Promise<boolean>;
    requestPermission(): void;
    getUsageStats(startTime: number, endTime: number): Promise<any>;
    getInstalledApps(): Promise<{ packageName: string, label: string, icon: string }[]>;
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
        getUsageStats: async () => ({}),
        getInstalledApps: async () => []
    };
}

export default ScreenTimeModule;

export async function hasPermission(): Promise<boolean> {
    return await ScreenTimeModule.hasPermission();
}

export function requestPermission(): void {
    ScreenTimeModule.requestPermission();
}

export async function getUsageStats(startTime: number, endTime: number): Promise<any> {
    return await ScreenTimeModule.getUsageStats(startTime, endTime);
}

export async function getInstalledApps(): Promise<{ packageName: string, label: string, icon: string }[]> {
    return await ScreenTimeModule.getInstalledApps();
}
