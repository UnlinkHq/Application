import { useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { getEngineHealth } from '../modules/screen-time';

export type EngineHealth = {
  overlay: boolean;
  accessibility: boolean;
  usage: boolean;
  batteryExempt: boolean;
  isEnforcing: boolean;
};

// Optimistic default: assume everything is fine until a real check proves otherwise.
const DEFAULT_HEALTH: EngineHealth = {
  overlay: true,
  accessibility: true,
  usage: true,
  batteryExempt: true,
  isEnforcing: true,
};

// Module-level cache shared by every consumer. Survives screen remounts,
// so switching tabs reuses the last CONFIRMED reading instead of resetting
// to "checking" and flashing the banner.
let cachedHealth: EngineHealth = DEFAULT_HEALTH;
let hasCheckedOnce = false;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((l) => l());

const refresh = async (): Promise<void> => {
  // De-dupe concurrent checks triggered by multiple mounted banners.
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const next = await getEngineHealth();
      cachedHealth = next;
      hasCheckedOnce = true;
      notify();
    } catch (e) {
      console.error('Health check failed:', e);
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
};

// Single global driver: one interval + AppState listener for the whole app,
// regardless of how many components subscribe.
let started = false;
const ensureStarted = () => {
  if (started) return;
  started = true;
  refresh();
  setInterval(refresh, 5000);
  AppState.addEventListener('change', (s: AppStateStatus) => {
    if (s === 'active') refresh();
  });
};

export const refreshEngineHealth = refresh;

export const useEngineHealth = () => {
  const [, force] = useState(0);

  useEffect(() => {
    ensureStarted();
    const listener = () => force((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return { health: cachedHealth, hasChecked: hasCheckedOnce };
};
