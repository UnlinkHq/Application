import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ScreenTime, { startFocusProtocol } from '../modules/screen-time';

const ACTIVE_SESSION_KEY = '@unlink_active_session';
const LIBRARY_BLOCKS_KEY = '@unlink_library_blocks';
const SESSION_HISTORY_KEY = '@unlink_session_history';

export interface SessionHistoryEntry {
    id: string;
    title: string;
    type: 'block_now' | 'schedule';
    durationMins: number;
    apps: string[];
    completedAt: number;
    wasCompleted: boolean;
}

export interface ScrollingAppConfig {
    enabled: boolean;
}

export interface BlockSession {
    id: string; // Unique ID for each session or template
    title: string;
    startTime: number;
    durationMins: number;
    apps: string[];
    appIcons?: string[];
    type: 'block_now' | 'schedule';
    
    schedule?: {
        days: string[];
        startTime: string; // HH:mm
        endTime: string;   // HH:mm
        isEnabled: boolean;
    };

    scrollingProtocol: {
        enabled: boolean;
        youtube: ScrollingAppConfig;
        instagram: ScrollingAppConfig;
    };

    strictnessConfig: {
        mode: 'normal' | 'qr_code' | 'mom_test' | 'money';
        qrCodeData?: string; // The generated signature
        isUninstallProtected: boolean;
        emailAddress?: string;
        isVerified?: boolean;
    };
    timedBreaks: {
        enabled: boolean;
        allowedCount: number;
        durationMins: number;
        usedCount: number;
    };
    isOnBreak?: boolean;
    breakStartTime?: number;
    accumulatedBreakMs?: number;
}

export class FocusStorageService {
    // --- Active Session Management ---

    static async startSession(rawSession: any): Promise<void> {

        // 1. Instantly migrate/harden the session so there's no missing data
        const session = FocusStorageService.migrateSession(rawSession);

        // 2. Save locally as active
        await AsyncStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));

        // 3. Transmit to Native Layer
        await FocusStorageService.syncNativeLayer(session);
    }

    private static async syncNativeLayer(session: BlockSession): Promise<void> {
        if (Platform.OS === 'android') {
            let hardBlockedApps = session.apps || [];
            if (session.scrollingProtocol?.youtube?.enabled) {
                hardBlockedApps = hardBlockedApps.filter((app: string) => app !== 'com.google.android.youtube');
            }
            if (session.scrollingProtocol?.instagram?.enabled) {
                hardBlockedApps = hardBlockedApps.filter((app: string) => app !== 'com.instagram.android');
            }

            let durationMins = session.durationMins || 0;
            if (session.type === 'schedule' && session.schedule) {
                try {
                    const now = new Date();
                    const [endH, endM] = session.schedule.endTime.split(':').map(Number);
                    const [startH, startM] = session.schedule.startTime.split(':').map(Number);
                    let endDate = new Date(now);
                    endDate.setHours(endH, endM, 0, 0);
                    const startTotalMins = startH * 60 + startM;
                    const endTotalMins = endH * 60 + endM;
                    if (endTotalMins <= startTotalMins && now.getHours() >= startH) {
                        endDate.setDate(endDate.getDate() + 1);
                    }
                    durationMins = Math.max(1, Math.ceil((endDate.getTime() - now.getTime()) / 60000));
                } catch (e) {
                    console.error('Temporal Calculation Failure:', e);
                }
            }

            const breaksLeft = Math.max(0, (session.timedBreaks?.allowedCount || 0) - (session.timedBreaks?.usedCount || 0));
            const breakDurationMs = (session.timedBreaks?.durationMins || 15) * 60 * 1000;

            // Single atomic write: all session state committed in one native call.
            // Eliminates every race condition that existed when calling setBlockedApps,
            // setSessionDuration, setSurgicalConfig, and setStrictMode separately.
            startFocusProtocol({
                apps: hardBlockedApps,
                durationMins,
                surgicalFlags: {
                    youtube: session.scrollingProtocol?.youtube?.enabled || false,
                    instagram: session.scrollingProtocol?.instagram?.enabled || false,
                },
                breaksRemaining: breaksLeft,
                breakDurationMs,
                strictMode: session.strictnessConfig?.isUninstallProtected || false,
            });
        }

        if (Platform.OS === 'ios') {
            ScreenTime.activateShield();
        }
    }

    static async stopSession(wasCompleted: boolean = false): Promise<void> {
        const sessionData = await AsyncStorage.getItem(ACTIVE_SESSION_KEY);
        if (sessionData) {
            try {
                const session = JSON.parse(sessionData);
                
                if (session.type === 'schedule' && !wasCompleted) {
                    const { TemporalEngine } = require('./TemporalEngine');
                    // For midnight-crossing schedules stopped in the post-midnight window,
                    // record yesterday's date so the stop-check (which also uses yesterday) matches.
                    let effectiveDate: string | undefined;
                    const sched = session.schedule;
                    if (sched?.startTime && sched?.endTime) {
                        const now = new Date();
                        const nowMins = now.getHours() * 60 + now.getMinutes();
                        const [sH, sM] = sched.startTime.split(':').map(Number);
                        const [eH, eM] = sched.endTime.split(':').map(Number);
                        const startMins = sH * 60 + sM;
                        const endMins = eH * 60 + eM;
                        if (endMins <= startMins && nowMins < endMins) {
                            const yesterday = new Date(now);
                            yesterday.setDate(yesterday.getDate() - 1);
                            effectiveDate = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
                        }
                    }
                    await TemporalEngine.recordManualStop(session.id, effectiveDate);
                }

                if (wasCompleted) {
                    // REWARD_LOGIC: Calculate brain health boost
                    const durationMins = session.durationMins || 0;
                    const isSurgical = session.scrollingProtocol?.youtube?.enabled || session.scrollingProtocol?.instagram?.enabled;
                    const baseReward = -(durationMins / 10); 
                    const finalReward = isSurgical ? baseReward * 2 : baseReward;

                    ScreenTime.updateGlobalBrainrot(finalReward);
                    
                    // Unified Feedback
                    await AsyncStorage.setItem('@unlink_gamification_feedback', JSON.stringify({
                        type: 'SUCCESS',
                        message: `Focus Protocol Complete! Brain Rot Improved ${Math.abs(finalReward).toFixed(1)}%`,
                        reward: finalReward,
                        triggerConfetti: true,
                        timestamp: Date.now()
                    }));
                } else {
                    // PENALTY_LOGIC: Manual stop penalty
                    const penalty = 3.0;
                    ScreenTime.updateGlobalBrainrot(penalty);

                    // Unified Feedback
                    await AsyncStorage.setItem('@unlink_gamification_feedback', JSON.stringify({
                        type: 'WARNING',
                        message: `Protocol Aborted. Brain Rot Increased +${penalty.toFixed(1)}%`,
                        timestamp: Date.now()
                    }));
                }
            } catch (e) {
                console.error('Error handling session stop gamification:', e);
            }
        }

        // Write to session history before clearing
        if (sessionData) {
            try {
                const session = JSON.parse(sessionData);
                await FocusStorageService.appendSessionHistory(session, wasCompleted);
            } catch (_) {}
        }

        await AsyncStorage.removeItem(ACTIVE_SESSION_KEY);

        if (Platform.OS === 'android') {
            ScreenTime.setBlockingSuspended(false);
            ScreenTime.stopBlockingService();
            ScreenTime.setStrictMode(false);
        } else {
            ScreenTime.deactivateShield();
        }
    }

    static async toggleBreak(): Promise<BlockSession | undefined> {
        try {
            const session = await FocusStorageService.getActiveSession();
            if (!session || !session.timedBreaks.enabled) return;
            return await FocusStorageService.applyToggleBreak(session);
        } catch (error) {
            console.error('FocusStorageService: Error toggling break:', error);
        }
    }

    private static async applyToggleBreak(session: BlockSession): Promise<BlockSession | undefined> {
        const isOnBreak = !session.isOnBreak;
        const usedCount = isOnBreak ? (session.timedBreaks.usedCount || 0) + 1 : (session.timedBreaks.usedCount || 0);

        if (isOnBreak && (session.timedBreaks.allowedCount - (session.timedBreaks.usedCount || 0) <= 0)) {
            return; // No breaks left
        }

        let newBreakStartTime = session.breakStartTime;
        let totalAccumulatedBreakMs = session.accumulatedBreakMs || 0;

        if (isOnBreak) {
            newBreakStartTime = Date.now();
            
            // PENALTY_LOGIC: Slight brainrot increase for taking a break
            ScreenTime.updateGlobalBrainrot(2.0); // +2% rot penalty

            // Feedback for Break
            await AsyncStorage.setItem('@unlink_gamification_feedback', JSON.stringify({
                type: 'PENALTY',
                message: `Break Taken. Brain Rot Increased +2.0%`,
                timestamp: Date.now()
            }));
        } else if (session.breakStartTime) {
            const latestBreakDuration = Date.now() - session.breakStartTime;
            totalAccumulatedBreakMs += latestBreakDuration;
            newBreakStartTime = undefined;
        }

        if (Platform.OS === 'android') {
            const breakDurationMs = (session.timedBreaks?.durationMins || 15) * 60 * 1000;
            ScreenTime.setBlockingSuspended(isOnBreak, breakDurationMs);
            // TRIGGER_RESYNC: When re-locking, push the apps and refreshed expiry back to native explicitly.
            // setBlockedApps must come before setBlockExpiryTime so the service reads the correct
            // blocked_apps when the expiry update triggers a refresh.
            if (!isOnBreak) {
                let hardBlockedApps = session.apps || [];
                if (session.scrollingProtocol?.youtube?.enabled) hardBlockedApps = hardBlockedApps.filter(app => app !== 'com.google.android.youtube');
                if (session.scrollingProtocol?.instagram?.enabled) hardBlockedApps = hardBlockedApps.filter(app => app !== 'com.instagram.android');

                ScreenTime.setBlockedApps(hardBlockedApps, "FOCUS_PROTOCOL_ENGAGED", "");

                // CRITICAL: Push adjusted deadline to native so it doesn't auto-unlock early
                const adjustedExpiry = session.startTime + (session.durationMins * 60 * 1000) + totalAccumulatedBreakMs;
                ScreenTime.setBlockExpiryTime(adjustedExpiry);
            }
        }

        const updatedSession: BlockSession = {
            ...session,
            isOnBreak,
            breakStartTime: newBreakStartTime,
            accumulatedBreakMs: totalAccumulatedBreakMs,
            timedBreaks: { ...session.timedBreaks, usedCount }
        };

        if (Platform.OS === 'android') {
            const breaksLeft = updatedSession.timedBreaks.allowedCount - updatedSession.timedBreaks.usedCount;
            ScreenTime.setBreaksRemaining(Math.max(0, breaksLeft));
        }

        await AsyncStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(updatedSession));
        return updatedSession;
    }

    static async getActiveSession(): Promise<BlockSession | null> {
        const data = await AsyncStorage.getItem(ACTIVE_SESSION_KEY);
        
        // Tier 1: Check for explicit ad-hoc focused sessions (manual start)
        if (data) {
            try {
                const sessionData = JSON.parse(data);
                const session = FocusStorageService.migrateSession(sessionData);

                // Time-Aware Validation: If the focus budget is exhausted, terminate the session
                if (!session.isOnBreak) {
                    const totalEffectivePause = session.accumulatedBreakMs || 0;
                    const activeElapsedMs = Date.now() - session.startTime - totalEffectivePause;
                    const activeElapsedMins = activeElapsedMs / (1000 * 60);

                    if (activeElapsedMins >= session.durationMins && session.type === 'block_now') {
                        await FocusStorageService.stopSession(true); // MARK_AS_COMPLETED
                        return null;
                    }

                    // AUTO_RELEASE_LOGIC: If a scheduled session is active but the window has closed, terminate it.
                    if (session.type === 'schedule') {
                        const { TemporalUtils } = require('../utils/TemporalUtils');
                        const isStillInWindow = TemporalUtils.isCurrentlyInSchedule(session);
                        if (!isStillInWindow) {
                            await FocusStorageService.stopSession(true);
                            return null;
                        }
                    }
                } else if (session.isOnBreak && session.breakStartTime) {
                    // AUTO_EXPIRY_CHECK: If break duration is exceeded, re-engage the block automatically
                    const breakDurationMs = (session.timedBreaks?.durationMins || 0) * 60 * 1000;
                    const breakElapsed = Date.now() - session.breakStartTime;

                    if (breakElapsed >= breakDurationMs) {
                        const locked = await FocusStorageService.applyToggleBreak(session);
                        return locked || null;
                    }
                }
                return session;
            } catch (e) {
                console.error('Core Session Analysis Failure:', e);
            }
        }

        return null;
    }

    // --- Library Management ---

    static async getLibraryBlocks(): Promise<BlockSession[]> {
        const data = await AsyncStorage.getItem(LIBRARY_BLOCKS_KEY);
        if (!data) return [];
        try {
            const items = JSON.parse(data);
            return items.map((item: any) => FocusStorageService.migrateSession(item));
        } catch {
            return [];
        }
    }

    static async saveBlock(block: BlockSession): Promise<void> {
        const library = await this.getLibraryBlocks();
        const exists = library.findIndex(b => b.id === block.id);

        if (exists >= 0) {
            library[exists] = block;
        } else {
            library.push(block);
        }

        await AsyncStorage.setItem(LIBRARY_BLOCKS_KEY, JSON.stringify(library));
        
        // TRIGGER_NATIVE_SYNC: Ensure the persistent Android service knows about the new rule
        try {
            const { TemporalEngine } = require('./TemporalEngine');
            TemporalEngine.syncSchedulesToNative();
        } catch (e) {}
    }

    static async deleteBlock(id: string): Promise<void> {
        const library = await this.getLibraryBlocks();
        const updated = library.filter(b => b.id !== id);
        await AsyncStorage.setItem(LIBRARY_BLOCKS_KEY, JSON.stringify(updated));

        // TRIGGER_NATIVE_SYNC: Remove from persistent Android service
        try {
            const { TemporalEngine } = require('./TemporalEngine');
            TemporalEngine.syncSchedulesToNative();
        } catch (e) {}
    }

    // --- Session History ---

    static async getSessionHistory(): Promise<SessionHistoryEntry[]> {
        const data = await AsyncStorage.getItem(SESSION_HISTORY_KEY);
        if (!data) return [];
        try { return JSON.parse(data); } catch { return []; }
    }

    private static async appendSessionHistory(session: BlockSession, wasCompleted: boolean): Promise<void> {
        const history = await FocusStorageService.getSessionHistory();
        const entry: SessionHistoryEntry = {
            id: session.id,
            title: session.title,
            type: session.type,
            durationMins: session.durationMins || 0,
            apps: session.apps || [],
            completedAt: Date.now(),
            wasCompleted,
        };
        const updated = [entry, ...history].slice(0, 60);
        await AsyncStorage.setItem(SESSION_HISTORY_KEY, JSON.stringify(updated));
    }

    static getStreak(history: SessionHistoryEntry[]): number {
        const completedDays = new Set(
            history
                .filter(e => e.wasCompleted)
                .map(e => {
                    const d = new Date(e.completedAt);
                    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                })
        );
        let streak = 0;
        const check = new Date();
        while (completedDays.has(`${check.getFullYear()}-${check.getMonth()}-${check.getDate()}`)) {
            streak++;
            check.setDate(check.getDate() - 1);
        }
        return streak;
    }

    static migrateSession(session: any): BlockSession {
        const sp = session.scrollingProtocol || {};
        const yt = sp.youtube || {};
        const ig = sp.instagram || {};

        return {
            ...session,
            type: session.type || 'block_now',
            durationMins: session.durationMins || (session.type === 'schedule' && session.schedule ? (() => {
                const now = new Date();
                const [endH, endM] = session.schedule.endTime.split(':').map(Number);
                const [startH, startM] = session.schedule.startTime.split(':').map(Number);
                
                let endDate = new Date(now);
                endDate.setHours(endH, endM, 0, 0);
                
                const startTotalMins = startH * 60 + startM;
                const endTotalMins = endH * 60 + endM;
                
                if (endTotalMins <= startTotalMins && now.getHours() >= startH) {
                    endDate.setDate(endDate.getDate() + 1);
                }
                
                const diffMs = endDate.getTime() - now.getTime();
                return Math.max(1, Math.ceil(diffMs / (1000 * 60)));
            })() : 60),
            startTime: session.startTime || Date.now(),
            apps: session.apps || [],
            appIcons: session.appIcons || [],
            scrollingProtocol: {
                enabled: sp.enabled || false,
                youtube: {
                    enabled: yt.enabled || false,
                },
                instagram: {
                    enabled: ig.enabled || false,
                }
            },
            strictnessConfig: session.strictnessConfig || {
                mode: 'normal',
                isUninstallProtected: false
            },
            timedBreaks: session.timedBreaks || {
                enabled: false,
                allowedCount: 0,
                durationMins: 0,
                usedCount: 0
            }
        };
    }
}
