import React from 'react';
import { NativeModules } from 'react-native';
import { ScreenBreakSDK, ScreenTimeStats } from './index';
import * as ScreenTimeModule from '../../modules/screen-time';

/**
 * SDK Provider (Internal)
 * 
 * This is the actual implementation of the ScreenBreak SDK that the app injects.
 */

let listeners: ((stats: ScreenTimeStats) => void)[] = [];

const SDKProviderInstance: ScreenBreakSDK = {
  stats: {
    todayTotalMinutes: 0,
    appUsage: {},
  },

  visuals: {
    setGrayscale: async (level: number) => {
      // Send the request over the bridge to the Android Accessibility Service
      if (NativeModules.ScreenBreak) {
        NativeModules.ScreenBreak.setGrayscale(level);
      } else {
        console.warn(`[SDK] Native Module 'ScreenBreak' not available.`);
      }
    },
    setBlueLightFilter: async (enabled: boolean) => {
    },
    openAccessibilitySettings: async () => {
      if (NativeModules.ScreenBreak && NativeModules.ScreenBreak.openAccessibilitySettings) {
        NativeModules.ScreenBreak.openAccessibilitySettings();
      } else {
        console.warn(`[SDK] Native Module 'openAccessibilitySettings' not available.`);
      }
    },
    hasAccessibilityPermission: async () => {
      // Ask Android if the user has physically enabled the Screen Break Accessibility service
      if (NativeModules.ScreenBreak && NativeModules.ScreenBreak.isAccessibilityServiceEnabled) {
        return await NativeModules.ScreenBreak.isAccessibilityServiceEnabled();
      }
      return false;
    }
  },

  challenges: {
    triggerChallenge: async (id: string) => {
      return true;
    },
    blockApp: async (bundleId: string) => {
    }
  },

  onUpdate: (callback) => {
    listeners.push(callback);
    return () => {
      listeners = listeners.filter(l => l !== callback);
    };
  }
};

/**
 * Updates the SDK state and notifies all extensions.
 */
export const updateSDKState = (newStats: ScreenTimeStats) => {
  SDKProviderInstance.stats = newStats;
  listeners.forEach(cb => cb(newStats));
};

// Inject into global scope for extensions
(global as any).ScreenBreak = SDKProviderInstance;

export const useSDK = () => SDKProviderInstance;
