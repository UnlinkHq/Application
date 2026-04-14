import AsyncStorage from '@react-native-async-storage/async-storage';

const METRICS_KEY = '@unlink_focus_metrics';

export interface UserMetrics {
    bypassCount: number;
    lastBypassTimestamp: number | null;
    weakestHour: number | null; // 0-23
    points: number;
    sessionsCompleted: number;
}

export class MetricsEngine {
    static async getMetrics(): Promise<UserMetrics> {
        const data = await AsyncStorage.getItem(METRICS_KEY);
        if (!data) {
            return {
                bypassCount: 0,
                lastBypassTimestamp: null,
                weakestHour: null,
                points: 0,
                sessionsCompleted: 0
            };
        }
        return JSON.parse(data);
    }

    static async recordBypass(): Promise<void> {
        const metrics = await this.getMetrics();
        const now = new Date();
        
        metrics.bypassCount += 1;
        metrics.lastBypassTimestamp = now.getTime();
        
        // Simple logic for "Weakest Hour"
        // In a real app, we'd average this, but for now we set it to the hour of bypass
        metrics.weakestHour = now.getHours();
        
        await AsyncStorage.setItem(METRICS_KEY, JSON.stringify(metrics));
    }

    static async recordSessionSuccess(): Promise<void> {
        const metrics = await this.getMetrics();
        metrics.sessionsCompleted += 1;
        metrics.points += 50; // Give points for focus
        await AsyncStorage.setItem(METRICS_KEY, JSON.stringify(metrics));
    }

    static getMessage(metrics: UserMetrics): string {
        if (metrics.bypassCount > 5) {
            return `You've paused ${metrics.bypassCount} times this week. Small steps lead to big changes.`;
        }
        if (metrics.weakestHour !== null) {
            const period = metrics.weakestHour >= 12 ? 'PM' : 'AM';
            const displayHour = metrics.weakestHour % 12 || 12;
            return `We noticed ${displayHour} ${period} is your weakest hour. Let's push through.`;
        }
        return "Your focus is building momentum. 45 more mins = deep work.";
    }
}
