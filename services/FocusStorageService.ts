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
        
        // 1. Instantly migrate/harden the session so there's no missing data
        const session = FocusStorageService.migrateSession(rawSession);
        
        // 2. Save locally as active
        await AsyncStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
        
        // 3. Transmit to Native Layer (Android)
        if (Platform.OS === 'android') {
            ScreenTime.setBlockingSuspended(false);
            
            // Send config BEFORE blocks so the background service is ready
            ScreenTime.setSurgicalConfig({
                youtube: session.scrollingProtocol.youtube.enabled,
                instagram: session.scrollingProtocol.instagram.enabled,
                config: {
                    ytGate: session.scrollingProtocol.youtube.intentGate,
                    ytShelf: session.scrollingProtocol.youtube.hideShorts,
                    ytFinite: session.scrollingProtocol.youtube.finiteFeed,
                    igGate: session.scrollingProtocol.instagram.intentGate,
                    igDMs: session.scrollingProtocol.instagram.dmSafeZone,
                    igFinite: session.scrollingProtocol.instagram.finiteFeed
                }
            });
            ScreenTime.setUninstallProtection(session.strictnessConfig?.isUninstallProtected ?? false);
            ScreenTime.setSessionDuration(session.durationMins || 0);
            
            let hardBlockedApps = session.apps || [];
            
            // Exclude apps from hard blocking if their surgical (scrolling) protocol is enabled
            if (session.scrollingProtocol?.youtube?.enabled) {
                hardBlockedApps = hardBlockedApps.filter((app: string) => app !== 'com.google.android.youtube');
            }
            if (session.scrollingProtocol?.instagram?.enabled) {
                hardBlockedApps = hardBlockedApps.filter((app: string) => app !== 'com.instagram.android');
            }

            ScreenTime.setBlockedApps(hardBlockedApps, "FOCUS_PROTOCOL_ENGAGED", "");
        }
        
        // 4. For iOS, we rely on the activateShield call or standard family controls
        if (Platform.OS === 'ios') {
            ScreenTime.activateShield();
        }
    }

    static async stopSession(): Promise<void> {
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

            const isOnBreak = !session.isOnBreak;
            const usedCount = isOnBreak ? (session.timedBreaks.usedCount || 0) + 1 : (session.timedBreaks.usedCount || 0);

            if (isOnBreak && (session.timedBreaks.allowedCount - (session.timedBreaks.usedCount || 0) <= 0)) {
                return; // No breaks left
            }

            if (Platform.OS === 'android') {
                ScreenTime.setBlockingSuspended(isOnBreak);
            }

            let newBreakStartTime = session.breakStartTime;
            let totalAccumulatedBreakMs = session.accumulatedBreakMs || 0;

            if (isOnBreak) {
                // STARTING BREAK: Record the exact moment the pause initiated
                newBreakStartTime = Date.now();
            } else if (session.breakStartTime) {
                // ENDING BREAK: Add this break's duration to the total session pause time
                const latestBreakDuration = Date.now() - session.breakStartTime;
                totalAccumulatedBreakMs += latestBreakDuration;
                newBreakStartTime = undefined;
                console.log(`--- [CUMULATIVE_PAUSE] TOTAL_REST_TIME: ${Math.round(totalAccumulatedBreakMs/1000)}s ---`);
            }

            const updatedSession: BlockSession = { 
                ...session, 
                isOnBreak, 
                breakStartTime: newBreakStartTime,
                accumulatedBreakMs: totalAccumulatedBreakMs,
                timedBreaks: { ...session.timedBreaks, usedCount } 
            };
            
            await AsyncStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(updatedSession));
            
            return updatedSession;
        } catch (error) {
            console.error('FocusStorageService: Error toggling break:', error);
        }
    }

    static async getActiveSession(): Promise<BlockSession | null> {
        const data = await AsyncStorage.getItem(ACTIVE_SESSION_KEY);
        if (!data) return null;
        
        try {
            const sessionData = JSON.parse(data);
            const session = FocusStorageService.migrateSession(sessionData);
            
            // Time-Aware Validation: If the focus budget is exhausted, terminate the session
            if (!session.isOnBreak) {
                const totalEffectivePause = session.accumulatedBreakMs || 0;
                const activeElapsedMs = Date.now() - session.startTime - totalEffectivePause;
                const activeElapsedMins = activeElapsedMs / (1000 * 60);
                
                if (activeElapsedMins >= session.durationMins) {
                    await FocusStorageService.stopSession();
                    return null;
                }
            }
            
            return session;
        } catch (e) {
            return null;
        }
    }

    // --- Library Management ---

    static async getLibraryBlocks(): Promise<BlockSession[]> {
        const data = await AsyncStorage.getItem(LIBRARY_BLOCKS_KEY);
        if (!data) return [];
        const items = JSON.parse(data);
        return items.map((item: any) => FocusStorageService.migrateSession(item));
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
    }

    static async deleteBlock(id: string): Promise<void> {
        const library = await this.getLibraryBlocks();
        const updated = library.filter(b => b.id !== id);
        await AsyncStorage.setItem(LIBRARY_BLOCKS_KEY, JSON.stringify(updated));
    }

    static migrateSession(session: any): BlockSession {
        // Deep clone or construct to ensure we aren't mutating the original
        // while also providing default fallbacks everywhere
        const oldFlags = session.surgicalFlags || {};
        const oldConfig = oldFlags.config || {};
        
        const sp = session.scrollingProtocol || {};
        const yt = sp.youtube || {};
        const ig = sp.instagram || {};

        return {
            ...session,
            scrollingProtocol: {
                enabled: sp.enabled ?? (oldFlags.youtube || oldFlags.instagram || false),
                youtube: {
                    enabled: yt.enabled ?? (oldFlags.youtube || false),
                    intentGate: yt.intentGate ?? oldConfig.ytGate ?? true,
                    hideShorts: yt.hideShorts ?? oldConfig.ytShelf ?? true,
                    finiteFeed: yt.finiteFeed ?? oldConfig.ytFinite ?? true
                },
                instagram: {
                    enabled: ig.enabled ?? (oldFlags.instagram || false),
                    intentGate: ig.intentGate ?? oldConfig.igGate ?? true,
                    dmSafeZone: ig.dmSafeZone ?? oldConfig.igDMs ?? true,
                    finiteFeed: ig.finiteFeed ?? oldConfig.igFinite ?? true
                }
            }
        };
    }
}
