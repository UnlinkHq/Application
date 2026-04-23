import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS, withSpring } from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

interface ScreenTimeGoalStepProps {
    onNext: () => void;
    screenTimeGoal: number;
    setScreenTimeGoal: (hours: number) => void;
}

export const ScreenTimeGoalStep: React.FC<ScreenTimeGoalStepProps> = ({ onNext, screenTimeGoal, setScreenTimeGoal }) => {
    const MAX_HOURS = 12;
    const progress = useSharedValue(Math.min(1, Math.max(0, screenTimeGoal / MAX_HOURS)));
    const isPressed = useSharedValue(false);
    const context = useSharedValue(0);
    const sliderWidth = useSharedValue(300); // Default, updated onLayout

    useEffect(() => {
        const targetProgress = Math.min(1, Math.max(0, screenTimeGoal / MAX_HOURS));
        if (Math.abs(progress.value - targetProgress) > 0.01 && !isPressed.value) {
            progress.value = withSpring(targetProgress, { damping: 20, stiffness: 100 });
        }
    }, [screenTimeGoal]);

    const triggerHapticIfNeeded = (hours: number) => {
        if (hours !== screenTimeGoal && hours >= 0 && hours <= MAX_HOURS) {
            setScreenTimeGoal(hours);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    };

    const gesture = Gesture.Pan()
        .onBegin(() => {
            isPressed.value = true;
            context.value = progress.value;
        })
        .onUpdate((e) => {
            const width = sliderWidth.value || 300;
            const sensitivity = 1 / width;
            let newProgress = context.value + (e.translationX * sensitivity);
            newProgress = Math.max(0, Math.min(1, newProgress));

            progress.value = newProgress;

            const hours = Math.round(progress.value * MAX_HOURS);
            runOnJS(triggerHapticIfNeeded)(hours);
        })
        .onFinalize(() => {
            isPressed.value = false;
        });

    const thumbStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { translateX: progress.value * sliderWidth.value }
            ]
        };
    });

    return (
        <View className="flex-1 bg-black flex-col px-6 pb-6 pt-16">
            <View className="flex-1 w-full justify-between items-center">

                {/* Title Section */}
                <View className="w-full mt-4">
                    <Text className="font-headline font-black text-5xl text-white tracking-widest uppercase" style={{ lineHeight: 54 }}>
                        SET YOUR{"\n"}DAILY LIMIT.
                    </Text>
                </View>

                {/* Main Display */}
                <View className="mt-16 flex-col items-center">
                    <Text className="font-label text-[10px] uppercase tracking-widest text-white/40 mb-2">
                        TARGET HOURS
                    </Text>
                    <View className="flex-row items-baseline space-x-2">
                        <Text className="font-headline font-black text-8xl text-white tracking-widest uppercase" style={{ fontSize: 130, lineHeight: 140 }}>
                            {screenTimeGoal.toString().padStart(2, '0')}
                        </Text>
                        <Text className="font-headline font-black text-2xl uppercase text-white/40 tracking-widest">
                            HRS
                        </Text>
                    </View>
                </View>

                {/* Slider Ruler */}
                <View className="w-full mt-24 px-4">
                    <GestureHandlerRootView className="w-full h-16 relative justify-center">
                        <GestureDetector gesture={gesture}>
                            <Animated.View
                                className="w-full h-full relative justify-center"
                                onLayout={(event) => {
                                    const { width } = event.nativeEvent.layout;
                                    if (width > 0) sliderWidth.value = width;
                                }}
                            >
                                {/* Background Track */}
                                <View className="absolute left-0 right-0 h-[1px] bg-white" />

                                {/* Modern Thumb */}
                                <Animated.View
                                    className="absolute w-2 h-8 bg-white"
                                    style={[{ left: -4 }, thumbStyle]}
                                />
                            </Animated.View>
                        </GestureDetector>
                    </GestureHandlerRootView>

                    <View className="flex-row justify-between mt-6">
                        <Text className="font-label text-[10px] uppercase tracking-widest font-black text-white">00:00</Text>
                        <Text className="font-label text-[10px] uppercase tracking-widest font-black text-white/40">06:00</Text>
                        <Text className="font-label text-[10px] uppercase tracking-widest font-black text-white">12:00</Text>
                    </View>
                </View>

                <View className="flex-1" />



                {/* Confirm Button */}
                <View className="mt-10 w-full flex-col justify-end">
                    <TouchableOpacity
                        onPress={onNext}
                        activeOpacity={0.8}
                        className="w-full py-6 bg-white flex-row items-center justify-center space-x-4 rounded-none active:scale-[0.98] transition-transform"
                    >
                        <Text className="text-black font-headline font-black text-lg tracking-widest uppercase text-center">
                            CONFIRM GOAL
                        </Text>
                        <Ionicons name="arrow-forward" size={20} color="black" />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};
