import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ScreenTime from '../modules/screen-time';

const ACTIVE_SESSION_KEY = '@unlink_active_session';
const LIBRARY_BLOCKS_KEY = '@unlink_library_blocks';

export interface BlockSession {
    id: string; // Unique ID for each session or template
    title: string;
    startTime: number;
    durationMins: number;
    apps: string[];
    appIcons?: string[];
    surgicalFlags: {
        youtube: boolean;
        instagram: boolean;
        studyMode?: boolean;
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
    
    static async startSession(session: BlockSession): Promise<void> {
        console.log('--- [STORAGE_ENGINE] DEPLOYING_PROTOCOL ---');
        console.log(JSON.stringify(session, null, 2));
        
        // 1. Save locally as active
        await AsyncStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
        
        // 2. Transmit to Native Layer (Android)
        if (Platform.OS === 'android') {
            ScreenTime.setBlockingSuspended(false);
            ScreenTime.setSurgicalConfig(
                session.surgicalFlags.youtube,
                session.surgicalFlags.instagram,
                session.surgicalFlags.studyMode || false
            );
            ScreenTime.setUninstallProtection(session.strictnessConfig.isUninstallProtected);
            ScreenTime.setSessionDuration(session.durationMins);
            
            ScreenTime.setBlockedApps(session.apps, "FOCUS_PROTOCOL_ENGAGED", "");
        }
        
        // 3. For iOS, we rely on the activateShield call or standard family controls
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
            const session: BlockSession = JSON.parse(data);
            
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
        return data ? JSON.parse(data) : [];
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
}
