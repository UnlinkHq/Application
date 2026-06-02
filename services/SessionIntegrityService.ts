import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { consumeIntegrityBreak, updateGlobalBrainrot } from '../modules/screen-time';
import { FocusStorageService } from './FocusStorageService';
import { sendIntegrityBreakAlert } from './ResendService';

const ACTIVE_SESSION_KEY = '@unlink_active_session';

export interface IntegrityBreakResult {
    title: string;
    minutesSilent: number;
    partnerNotified: boolean;
}

/**
 * Closes the only unfillable part of the force-stop gap: prevention is impossible (Android's
 * "stopped state" can't be overridden), so instead we DETECT that a session was killed
 * mid-way and apply a real consequence — streak break, brain-rot penalty, and an optional
 * accountability-partner email. Pure app logic, zero Play-policy risk.
 */
export const SessionIntegrityService = {
    async checkAndConsume(): Promise<IntegrityBreakResult | null> {
        if (Platform.OS !== 'android') return null;

        let res: { pending: boolean; silenceMs?: number; sessionStart?: number };
        try {
            res = await consumeIntegrityBreak();
        } catch {
            return null;
        }
        if (!res?.pending) return null;

        const silenceMs = res.silenceMs || 0;
        const minutesSilent = Math.max(1, Math.round(silenceMs / 60000));

        // Pull the (still-stored) session for its title + accountability partner.
        let title = 'Focus session';
        let partnerEmail: string | undefined;
        let isVerified = false;
        let sessionId: string | undefined;
        try {
            const raw = await AsyncStorage.getItem(ACTIVE_SESSION_KEY);
            if (raw) {
                const s = JSON.parse(raw);
                title = s.title || title;
                sessionId = s.id;
                partnerEmail = s.strictnessConfig?.emailAddress;
                isVerified = !!s.strictnessConfig?.isVerified;
            }
        } catch (_) { }

        // Consequence 1 — record the break (logs it + writes a not-completed history entry,
        // which is what makes the streak reflect the bail).
        await FocusStorageService.recordInterruption({ title, silenceMs, sessionId });

        // Consequence 2 — brain-rot penalty, consistent with the manual-abort penalty.
        try { updateGlobalBrainrot(5.0); } catch (_) { }

        // Consequence 3 — notify the accountability partner if one is set up & verified.
        let partnerNotified = false;
        if (partnerEmail && isVerified) {
            try {
                await sendIntegrityBreakAlert(partnerEmail, title);
                partnerNotified = true;
            } catch (_) { }
        }

        return { title, minutesSilent, partnerNotified };
    },
};
