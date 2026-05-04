import { DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FocusStorageService, BlockSession } from './FocusStorageService';
import { TemporalUtils } from '../utils/TemporalUtils';

export class TemporalEngine {
    private static interval: NodeJS.Timeout | null = null;

    static start() {
        if (this.interval) return;
        
        console.log('--- [TEMPORAL_ENGINE] ACTIVATED ---');
        // Run every 10 seconds to be highly responsive to schedule boundaries
        this.interval = setInterval(() => {
            this.checkAndDeploySchedules();
        }, 10000);
        
        // Initial run
        this.checkAndDeploySchedules();
        this.syncSchedulesToNative();
    }

    private static async syncSchedulesToNative() {
        try {
            const library = await FocusStorageService.getLibraryBlocks();
            const schedules = library.filter(b => b.type === 'schedule');
            
            const { setNativeSchedules } = require('../modules/screen-time');
            setNativeSchedules(JSON.stringify(schedules));
            console.log(`--- [TEMPORAL_ENGINE] NATIVE_SYNC: ${schedules.length} schedules pushed to Android ---`);
        } catch (e) {
            console.error('TemporalEngine: Native sync failed', e);
        }
    }

    static stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    private static async checkAndDeploySchedules() {
        const activeSession = await FocusStorageService.getActiveSession();
        
        // AUTO_RELEASE_LOGIC: If a scheduled session is active but the window has closed, terminate it.
        if (activeSession && activeSession.type === 'schedule') {
            const isStillInWindow = this.isCurrentlyInSchedule(activeSession);
            if (!isStillInWindow) {
                console.log(`--- [TEMPORAL_ENGINE] AUTO_RELEASING_SCHEDULE: ${activeSession.title} (Window Closed) ---`);
                await FocusStorageService.stopSession(true); // Complete session
                return;
            }
        }

        // Priority: If there's already an active session, don't auto-deploy others
        if (activeSession) return;

        const library = await FocusStorageService.getLibraryBlocks();
        const schedules = library.filter(b => b.type === 'schedule' && (b as any).enabled !== false);
        
        if (library.length > 0) {
            console.log(`--- [TEMPORAL_ENGINE] SCANNING_LIBRARY: ${library.length} blocks, ${schedules.length} schedules found ---`);
        }

        const now = new Date();
        const dayStr = now.toDateString();

        for (const block of schedules) {
            const isInWindow = this.isCurrentlyInSchedule(block);
            if (isInWindow) {
                // Check if this specific window was already manually stopped today
                const stopRecord = await this.getStopRecord(block.id);
                if (stopRecord === dayStr) {
                    console.log(`--- [TEMPORAL_ENGINE] SKIP_DEPLOY: Manual Stop Record Found for Today (${block.title}) ---`);
                    continue; 
                }

                console.log(`--- [TEMPORAL_ENGINE] AUTO_DEPLOYING_SCHEDULE: ${block.title} ---`);
                
                const [endH, endM] = block.schedule!.endTime.split(':').map(Number);
                const endDate = new Date(now);
                endDate.setHours(endH, endM, 0, 0);
                const diffMs = endDate.getTime() - now.getTime();
                const durationMins = Math.max(1, Math.ceil(diffMs / (1000 * 60)));

                console.log(`--- [TEMPORAL_ENGINE] CALCULATED_DURATION: ${durationMins}m ---`);
                console.log(`--- [TEMPORAL_ENGINE] TARGET_APPS: ${block.apps.join(', ')} ---`);

                await FocusStorageService.startSession({
                    ...block,
                    durationMins
                });
                DeviceEventEmitter.emit('UNLINK REFRESH DATA');
                break; 
            }
        }
    }

    private static async getStopRecord(id: string): Promise<string | null> {
        try {
            return await AsyncStorage.getItem(`@unlink_stop_record_${id}`);
        } catch {
            return null;
        }
    }

    public static async recordManualStop(id: string) {
        // Mark this schedule as manually stopped for the current day
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const currentDay = dayNames[new Date().getDay()];
        const today = new Date().toDateString();
        await AsyncStorage.setItem(`@unlink_stop_record_${id}`, today);

        // Sync to native so the accessibility service also knows to skip today
        try {
            const { setNativeStopRecord } = require('../modules/screen-time');
            setNativeStopRecord(id, currentDay);
        } catch (e) {}
    }

    public static isCurrentlyInSchedule(block: BlockSession): boolean {
        const { TemporalUtils } = require('../utils/TemporalUtils');
        return TemporalUtils.isCurrentlyInSchedule(block);
    }

    public static checkOverlap(newBlock: BlockSession, library: BlockSession[]): BlockSession | null {
        if (newBlock.type !== 'schedule' || !newBlock.schedule) return null;

        const schedules = library.filter(b => b.type === 'schedule' && b.id !== newBlock.id);

        for (const existing of schedules) {
            if (!existing.schedule) continue;

            // Check if any days overlap
            const commonDays = newBlock.schedule.days.filter(day => existing.schedule!.days.includes(day));
            if (commonDays.length === 0) continue;

            // Check if time ranges overlap
            const [newStartH, newStartM] = newBlock.schedule.startTime.split(':').map(Number);
            const [newEndH, newEndM] = newBlock.schedule.endTime.split(':').map(Number);
            const newStart = newStartH * 60 + newStartM;
            const newEnd = newEndH * 60 + newEndM;

            const [exStartH, exStartM] = existing.schedule.startTime.split(':').map(Number);
            const [exEndH, exEndM] = existing.schedule.endTime.split(':').map(Number);
            const exStart = exStartH * 60 + exStartM;
            const exEnd = exEndH * 60 + exEndM;

            // Overlap if (StartA < EndB) and (EndA > StartB)
            if (newStart < exEnd && newEnd > exStart) {
                return existing;
            }
        }
        return null;
    }

    public static async checkManualOverlap(durationMins: number): Promise<BlockSession | null> {
        const library = await FocusStorageService.getLibraryBlocks();
        const now = new Date();
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const currentDay = dayNames[now.getDay()];

        const schedules = library.filter(b => b.type === 'schedule' && (b as any).enabled !== false);
        const activeSchedules = schedules.filter(b => TemporalUtils.isCurrentlyInSchedule(b));

        const nowMins = now.getHours() * 60 + now.getMinutes();
        const endMins = nowMins + durationMins;

        for (const block of schedules) {
            if (!block.schedule) continue;

            const [startH, startM] = block.schedule.startTime.split(':').map(Number);
            const [endH, endM] = block.schedule.endTime.split(':').map(Number);
            
            const schStart = startH * 60 + startM;
            const schEnd = endH * 60 + endM;

            // Overlap check
            if (nowMins < schEnd && endMins > schStart) {
                return block;
            }
        }

        return null;
    }
}
