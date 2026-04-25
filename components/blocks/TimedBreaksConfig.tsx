import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Animated, { FadeIn, Layout } from 'react-native-reanimated';
import { ModernToggle } from '../ui/ModernToggle';

interface TimedBreaksConfigProps {
    enabled: boolean;
    onEnabledChange: (value: boolean) => void;
    breakCount: number;
    onBreakCountChange: (count: number) => void;
    breakDuration: number;
    onBreakDurationChange: (duration: number) => void;
}

export const TimedBreaksConfig = ({
    enabled,
    onEnabledChange,
    breakCount,
    onBreakCountChange,
    breakDuration,
    onBreakDurationChange
}: TimedBreaksConfigProps) => {
    return (
        <View className="mt-2">
            <View className="border border-white/10 p-5 bg-black/20">
                <View className="flex-row items-center justify-between mb-4">
                    <View>
                        <Text className="text-white font-headline font-black text-xs uppercase tracking-widest">Allow Timed Breaks</Text>
                        <Text className="text-white/40 font-label text-[10px] mt-1">Temporary relief during sessions</Text>
                    </View>
                    <ModernToggle value={enabled} onValueChange={onEnabledChange} />
                </View>

                {enabled && (
                    <Animated.View layout={Layout.springify()} entering={FadeIn} className="flex-row gap-4 mt-2">
                        <View className="flex-1">
                            <Text className="text-white/20 font-headline font-black text-[9px] uppercase tracking-widest mb-3">Break Count</Text>
                            <View className="flex-row gap-2">
                                {[1, 2, 3].map(num => (
                                    <TouchableOpacity
                                        key={num}
                                        onPress={() => onBreakCountChange(num)}
                                        className={`flex-1 h-12 items-center justify-center border ${breakCount === num ? 'bg-white border-white' : 'border-white/20 bg-transparent'}`}
                                    >
                                        <Text className={`font-headline font-black text-xs ${breakCount === num ? 'text-black' : 'text-white/40'}`}>{num}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                        <View className="flex-1">
                            <Text className="text-white/20 font-headline font-black text-[9px] uppercase tracking-widest mb-3">Minutes per break</Text>
                            <View className="flex-row gap-2">
                                {[5, 10, 15].map(min => (
                                    <TouchableOpacity
                                        key={min}
                                        onPress={() => onBreakDurationChange(min)}
                                        className={`flex-1 h-12 items-center justify-center border ${breakDuration === min ? 'bg-white border-white' : 'border-white/20 bg-transparent'}`}
                                    >
                                        <Text className={`font-headline font-black text-xs ${breakDuration === min ? 'text-black' : 'text-white/40'}`}>{min}M</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </Animated.View>
                )}
            </View>
        </View>
    );
};
