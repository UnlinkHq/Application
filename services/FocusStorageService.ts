import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ScreenTime from '../modules/screen-time';

const ACTIVE_SESSION_KEY = '@unlink_active_session';
const LIBRARY_BLOCKS_KEY = '@unlink_library_blocks';

export interface ScrollingAppConfig {
    enabled: boolean;
    intentGate: boolean;
    hideShorts?: boolean; // YouTube specific
    dmSafeZone?: boolean; // Instagram specific
    finiteFeed: boolean;
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
        console.log('--- [STORAGE_ENGINE] DEPLOYING_PROTOCOL ---');
        console.log(JSON.stringify(rawSession, null, 2));

        // 1. Instantly migrate/harden the session so there's no missing data
        const session = FocusStorageService.migrateSession(rawSession);

        // 2. Save locally as active
        await AsyncStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));

        // 3. Transmit to Native Layer
        await FocusStorageService.syncNativeLayer(session);
    }

    private static async syncNativeLayer(session: BlockSession): Promise<void> {
        
        if (Platform.OS === 'android') {
            console.log(`--- [NATIVE_SYNC] SYNCHRONIZING_PROTOCOL: ${session.id} ---`);
            ScreenTime.setBlockingSuspended(false);

            // Send config BEFORE blocks so the background service is ready
            ScreenTime.setSurgicalConfig({
                youtube: session.scrollingProtocol?.youtube?.enabled || false,
                instagram: session.scrollingProtocol?.instagram?.enabled || false,
                config: {
                    ytGate: session.scrollingProtocol?.youtube?.intentGate ?? true,
                    ytShelf: session.scrollingProtocol?.youtube?.hideShorts ?? true,
                    ytFinite: session.scrollingProtocol?.youtube?.finiteFeed ?? true,
                    igGate: session.scrollingProtocol?.instagram?.intentGate ?? true,
                    igDMs: session.scrollingProtocol?.instagram?.dmSafeZone ?? true,
                    igFinite: session.scrollingProtocol?.instagram?.finiteFeed ?? true
                }
            });
            ScreenTime.setUninstallProtection(session.strictnessConfig?.isUninstallProtected ?? false);
            
            // Calculate duration based on session type
            let durationMins = session.durationMins || 0;
            if (session.type === 'schedule' && session.schedule) {
                try {
                    const now = new Date();
                    const [endH, endM] = session.schedule.endTime.split(':').map(Number);
                    const endDate = new Date(now);
                    endDate.setHours(endH, endM, 0, 0);
                    
                    const diffMs = endDate.getTime() - now.getTime();
                    durationMins = Math.max(0, Math.floor(diffMs / (1000 * 60)));
                    console.log(`--- [NATIVE_SYNC] SCHEDULE_REMAINING: ${durationMins}m ---`);
                } catch (e) {
                    console.error('Temporal Calculation Failure:', e);
                }
            }
            ScreenTime.setSessionDuration(durationMins);

            let hardBlockedApps = session.apps || [];

            // Exclude apps from hard blocking if their surgical (scrolling) protocol is enabled
            if (session.scrollingProtocol?.youtube?.enabled) {
                hardBlockedApps = hardBlockedApps.filter((app: string) => app !== 'com.google.android.youtube');
            }
            if (session.scrollingProtocol?.instagram?.enabled) {
                hardBlockedApps = hardBlockedApps.filter((app: string) => app !== 'com.instagram.android');
            }

            ScreenTime.setBlockedApps(hardBlockedApps, "FORCE_FOCUS_ACTIVE", "");
            const breaksLeft = (session.timedBreaks?.allowedCount || 0) - (session.timedBreaks?.usedCount || 0);
            ScreenTime.setBreaksRemaining(Math.max(0, breaksLeft));
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
                
                if (wasCompleted) {
                    // REWARD_LOGIC: Calculate brain health boost
                    const durationMins = session.durationMins || 0;
                    const isSurgical = session.scrollingProtocol?.youtube?.enabled || session.scrollingProtocol?.instagram?.enabled;
                    const baseReward = -(durationMins / 10); 
                    const finalReward = isSurgical ? baseReward * 2 : baseReward;

                    console.log(`--- [REWARD_ENGINE] SESSION_COMPLETED: ${finalReward}% brain improvement ---`);
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
                    console.log(`--- [PENALTY_ENGINE] SESSION_ABORTED: +${penalty}% brain rot ---`);
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

        await AsyncStorage.removeItem(ACTIVE_SESSION_KEY);

        if (Platform.OS === 'android') {
            ScreenTime.setBlockingSuspended(false);
            ScreenTime.stopBlockingService();
            ScreenTime.setUninstallProtection(false);
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
            console.log('--- [PENALTY_ENGINE] BREAK_TAKEN: +2.0% brain rot ---');

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
            ScreenTime.setBlockingSuspended(isOnBreak);
            // TRIGGER_RESYNC: When re-locking, push the apps and refreshed expiry back to native explicitly
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
                } else if (session.isOnBreak && session.breakStartTime) {
                    // AUTO_EXPIRY_CHECK: If break duration is exceeded, re-engage the block automatically
                    const breakDurationMs = (session.timedBreaks?.durationMins || 0) * 60 * 1000;
                    const breakElapsed = Date.now() - session.breakStartTime;

                    if (breakElapsed >= breakDurationMs) {
                        console.log('--- [AUTO_LOCK] BREAK_EXPIRED_PROTOCOL_RE_ENFORCED ---');
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
        const items = JSON.parse(data);
        return items.map((item: any) => FocusStorageService.migrateSession(item));
    }

    static async saveBlock(block: BlockSession): Promise<void> {
        console.log('--- [STORAGE_ENGINE] PERSISTING_NEW_BLOCK_PROTOCOL ---');
        console.log(JSON.stringify(block, null, 2));
        
        const library = await this.getLibraryBlocks();
        const exists = library.findIndex(b => b.id === block.id);

        if (exists >= 0) {
            library[exists] = block;
        } else {
            library.push(block);
        }

        await AsyncStorage.setItem(LIBRARY_BLOCKS_KEY, JSON.stringify(library));
    }

    static async deleteBlock(id: string): Promise<void> {
        const library = await this.getLibraryBlocks();
        const updated = library.filter(b => b.id !== id);
        await AsyncStorage.setItem(LIBRARY_BLOCKS_KEY, JSON.stringify(updated));
    }

    static migrateSession(session: any): BlockSession {
        const sp = session.scrollingProtocol || {};
        const yt = sp.youtube || {};
        const ig = sp.instagram || {};

        return {
            ...session,
            type: session.type || 'block_now',
            durationMins: session.durationMins || 0,
            startTime: session.startTime || Date.now(),
            apps: session.apps || [],
            appIcons: session.appIcons || [],
            scrollingProtocol: {
                enabled: sp.enabled || false,
                youtube: {
                    enabled: yt.enabled || false,
                    intentGate: yt.intentGate ?? true,
                    hideShorts: yt.hideShorts ?? true,
                    finiteFeed: yt.finiteFeed ?? true
                },
                instagram: {
                    enabled: ig.enabled || false,
                    intentGate: ig.intentGate ?? true,
                    dmSafeZone: ig.dmSafeZone ?? true,
                    finiteFeed: ig.finiteFeed ?? true
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
