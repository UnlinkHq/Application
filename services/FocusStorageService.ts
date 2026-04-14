import AsyncStorage from '@react-native-async-storage/async-storage';
import ScreenTime from '../modules/screen-time';

const ACTIVE_SESSION_KEY = '@unlink_active_session';
const LIBRARY_BLOCKS_KEY = '@unlink_library_blocks';

export interface BlockSession {
    id: string;
    title: string;
    durationMins: number;
    apps: string[];
    appIcons?: string[]; // Base64 or URIs
    surgicalFlags: {
        youtube: boolean;
        instagram: boolean;
    };
    strictMode: string;
    startTime: number;
}

export class FocusStorageService {
    // --- Active Session Management ---
    
    static async startSession(session: BlockSession): Promise<void> {
        // 1. Save locally as active
        await AsyncStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
        
        // 2. Sync to Native Layer
        ScreenTime.setBlockedApps(session.apps);
        ScreenTime.setSurgicalFlags(session.surgicalFlags.youtube, session.surgicalFlags.instagram);
        ScreenTime.setSessionData(session.startTime, session.durationMins);
    }

    static async stopSession(): Promise<void> {
        await AsyncStorage.removeItem(ACTIVE_SESSION_KEY);
        ScreenTime.setBlockedApps([]);
        ScreenTime.setSurgicalFlags(false, false);
        ScreenTime.stopBlockingService();
    }

    static async getActiveSession(): Promise<BlockSession | null> {
        const data = await AsyncStorage.getItem(ACTIVE_SESSION_KEY);
        if (!data) return null;
        
        const session: BlockSession = JSON.parse(data);
        const elapsed = (Date.now() - session.startTime) / (1000 * 60);
        
        if (elapsed >= session.durationMins) {
            await this.stopSession();
            return null;
        }
        
        return session;
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
