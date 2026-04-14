import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { MetricsEngine, UserMetrics } from '../../services/MetricsEngine';
import { FocusStorageService, BlockSession } from '../../services/FocusStorageService';
import * as ScreenTime from '../../modules/screen-time';

interface FocusActiveScreenProps {
    session: BlockSession;
    onEnd: () => void;
}

export const FocusActiveScreen = ({ session, onEnd }: FocusActiveScreenProps) => {
    const [metrics, setMetrics] = useState<UserMetrics | null>(null);
    const [timeLeft, setTimeLeft] = useState<number>(0);
    const [hasOverlay, setHasOverlay] = useState(true);

    useEffect(() => {
        const check = async () => {
            const has = await ScreenTime.hasOverlayPermission();
            setHasOverlay(has);
        };
        const load = async () => {
            const m = await MetricsEngine.getMetrics();
            setMetrics(m);
        };
        check();
        load();
    }, []);

    useEffect(() => {
        const timer = setInterval(() => {
            const now = Date.now();
            const elapsed = (now - session.startTime) / (1000 * 60);
            const remaining = Math.max(0, session.durationMins - elapsed);
            setTimeLeft(remaining);
            
            if (remaining <= 0) {
                handleStop(true);
            }
        }, 1000);
        return () => clearInterval(timer);
    }, [session]);

    const handleStop = async (isAuto = false) => {
        await FocusStorageService.stopSession();
        if (!isAuto) {
            await MetricsEngine.recordBypass();
        } else {
            await MetricsEngine.recordSessionSuccess();
        }
        onEnd();
    };

    const formatTime = (mins: number) => {
        const h = Math.floor(mins / 60);
        const m = Math.floor(mins % 60);
        const s = Math.floor((mins * 60) % 60);
        return `${h > 0 ? h + ':' : ''}${m < 10 && h > 0 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
    };

    return (
        <SafeAreaView className="flex-1 bg-black">
            <Animated.View 
                entering={FadeIn.duration(800)}
                className="flex-1 items-center justify-center px-8"
            >
                <View className="items-center mb-12">
                    <Ionicons name="shield-checkmark" size={60} color="white" />
                    <Text className="text-white/40 font-headline font-black text-xs uppercase tracking-[0.4em] mt-4">
                        FOCUS_PROTOCOL_ENGAGED
                    </Text>
                </View>

                <View className="items-center mb-16">
                    <Text className="text-white font-headline font-black text-7xl tracking-tighter">
                        {formatTime(timeLeft)}
                    </Text>
                    <Text className="text-white/20 font-label text-[10px] uppercase tracking-widest mt-2">
                        REMAINING_RESTRICTION_PERIOD
                    </Text>
                </View>

                <Animated.View 
                    entering={FadeInDown.delay(400).duration(800)}
                    className="w-full bg-white/5 p-6 border border-white/10 rounded-2xl items-center"
                >
                    <Text className="text-white font-headline font-black text-lg text-center leading-6">
                        {metrics ? MetricsEngine.getMessage(metrics) : '...'}
                    </Text>
                    <View className="h-[1px] w-12 bg-white/20 my-4" />
                    <Text className="text-white/40 font-label text-[10px] text-center uppercase leading-4 italic">
                        "Your future self is thanking you for this hour of deep focus."
                    </Text>
                </Animated.View>

                <View className="flex-row items-center mt-12 gap-2">
                    <View className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    <Text className="text-white/40 font-label text-[10px] uppercase tracking-widest">
                        AIRTIGHT_LOCKDOWN_ACTIVE
                    </Text>
                </View>

                {/* Permission Warning if Enforcement might fail */}
                {!hasOverlay && (
                    <Animated.View 
                        entering={FadeIn.delay(800)}
                        className="mt-8 bg-red-900/20 border border-red-500/30 p-4 rounded-xl items-center w-full"
                    >
                        <Text className="text-red-500 font-headline font-black text-[10px] uppercase tracking-widest mb-2">
                            ENFORCEMENT_WARNING: OVERLAY_PERMISSION_MISSING
                        </Text>
                        <Text className="text-white/60 font-body text-[10px] text-center mb-4">
                            Unlink cannot physically block other apps without 'Display over other apps' permission.
                        </Text>
                        <TouchableOpacity 
                            onPress={() => ScreenTime.requestOverlayPermission()}
                            className="bg-red-500 px-4 py-2 rounded-sm"
                        >
                            <Text className="text-white font-headline font-black text-[10px] uppercase">GRANT_CONTROL_NOW</Text>
                        </TouchableOpacity>
                    </Animated.View>
                )}
            </Animated.View>

            <View className="px-6 pb-8">
                <TouchableOpacity
                    onPress={() => handleStop(false)}
                    className="h-16 border border-white/10 items-center justify-center bg-transparent"
                    activeOpacity={0.7}
                >
                    <Text className="text-white/40 font-headline font-black text-sm uppercase tracking-[0.3em]">
                        STOP_FOCUS_MODE
                    </Text>
                </TouchableOpacity>
                <Text className="text-white/20 font-label text-[8px] text-center mt-3 uppercase tracking-widest">
                    BYPASSING_WILL_IMPACT_YOUR_WEEKLY_CONSISTENCY_METRICS
                </Text>
            </View>
        </SafeAreaView>
    );
};
