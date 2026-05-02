import { BlockSession } from '../services/FocusStorageService';

export class TemporalUtils {
    public static isCurrentlyInSchedule(block: BlockSession): boolean {
        const isEnabled = (block as any).enabled !== false;
        if (!block.schedule || !isEnabled) return false;

        const now = new Date();
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const currentDay = dayNames[now.getDay()];

        if (!block.schedule.days.includes(currentDay)) {
            console.log(`--- [TEMPORAL_UTILS] DAY_MISMATCH: ${currentDay} not in ${block.schedule.days.join(', ')} for ${block.title} ---`);
            return false;
        }

        const currentTime = now.getHours() * 60 + now.getMinutes();
        const [startH, startM] = block.schedule.startTime.split(':').map(Number);
        const [endH, endM] = block.schedule.endTime.split(':').map(Number);
        
        const startTimeInMins = startH * 60 + startM;
        const endTimeInMins = endH * 60 + endM;

        const isInWindow = currentTime >= startTimeInMins && currentTime < endTimeInMins;
        if (isInWindow) {
            console.log(`--- [TEMPORAL_UTILS] WINDOW_MATCH: ${currentTime} mins inside ${startTimeInMins}-${endTimeInMins} ---`);
        }
        
        return isInWindow;
    }
}
