import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence } from 'react-native-reanimated';

export const AIBetaTeaser = () => {
    const pulseValue = useSharedValue(0.4);

    useEffect(() => {
        pulseValue.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 1000 }),
                withTiming(0.4, { duration: 1000 })
            ),
            -1,
            true
        );
    }, []);

    const pulseStyle = useAnimatedStyle(() => ({
        opacity: pulseValue.value,
        transform: [{ scale: pulseValue.value }]
    }));

    return (
        <View className="mt-6 mb-4">
            <View className="flex-row items-center gap-2 mb-3">
                <Text className="text-white/40 font-headline font-black text-[9px] uppercase ml-1 tracking-widest">AI  PERSONALIZED</Text>
                <View className="flex-1 h-[1px] bg-[#7851ff]/10 ml-2" />
                <View className="bg-[#7851ff]/10 px-1.5 py-0.5 border border-[#7851ff]/20">
                    <Text className="text-[#7851ff] font-label text-[8px] font-black">BETA</Text>
                </View>
            </View>

            <View className="border border-[#7851ff]/20 bg-[#7851ff]/5 p-5 relative overflow-hidden">
                <LinearGradient
                    colors={['rgba(120, 81, 255, 0.1)', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                />
                <View className="flex-row items-start gap-4">
                    <View className="w-10 h-10 bg-[#7851ff]/20 items-center justify-center border border-[#7851ff]/30">
                        <MaterialCommunityIcons name="auto-fix" size={20} color="#7851ff" />
                    </View>
                    <View className="flex-1">
                        <Text className="text-white font-headline font-black text-sm uppercase tracking-tight">AI FOCUS COACH</Text>
                        <Text className="text-white/40 font-label text-[10px] mt-1 leading-4">
                            A personalized coach that learns your friction points and automatically adjusts blocks based on your cognitive load.
                        </Text>
                        <View className="flex-row items-center gap-2 mt-3">
                            <Animated.View style={pulseStyle} className="w-1.5 h-1.5 rounded-full bg-[#7851ff]" />
                            <Text className="text-[#7851ff] font-label text-[9px] font-black uppercase tracking-widest">DEVELOPMENT IN PROGRESS</Text>
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
};
