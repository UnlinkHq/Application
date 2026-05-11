import { BlockSession } from '../services/FocusStorageService';

export class TemporalUtils {
    public static isCurrentlyInSchedule(block: BlockSession): boolean {
        const isEnabled = (block as any).enabled !== false;
        if (!block.schedule || !isEnabled) return false;

        const now = new Date();
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const currentDay = dayNames[now.getDay()];
        const yesterdayDay = dayNames[(now.getDay() + 6) % 7];

        const currentTime = now.getHours() * 60 + now.getMinutes();
        const [startH, startM] = block.schedule.startTime.split(':').map(Number);
        const [endH, endM] = block.schedule.endTime.split(':').map(Number);

        const startTimeInMins = startH * 60 + startM;
        const endTimeInMins = endH * 60 + endM;
        const isMidnightCrossing = endTimeInMins <= startTimeInMins;

        // Post-midnight portion of a midnight-crossing schedule: the schedule day is yesterday.
        // e.g. Sunday 19:00–Monday 08:00: at Mon 02:00, check if Sunday is in days.
        if (isMidnightCrossing && currentTime < endTimeInMins) {
            return block.schedule.days.includes(yesterdayDay);
        }

        if (!block.schedule.days.includes(currentDay)) {
            return false;
        }

        return isMidnightCrossing
            ? currentTime >= startTimeInMins
            : currentTime >= startTimeInMins && currentTime < endTimeInMins;
    }
}