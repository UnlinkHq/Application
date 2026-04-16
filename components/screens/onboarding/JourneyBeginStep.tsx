import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

interface JourneyBeginStepProps {
  onFinish: () => void;
}

export const JourneyBeginStep: React.FC<JourneyBeginStepProps> = ({ onFinish }) => {
  return (
    <View className="flex-1 bg-black relative items-center justify-center pt-20 pb-32">
        {/* Center Aesthetic & Logo */}
        <View className="flex-col items-center justify-center w-full max-w-lg z-10 px-10 gap-20">
            {/* Minimalist Logo Placeholder */}
            <View className="relative mt-8">
                <View className="w-32 h-32 border border-white/20 flex items-center justify-center">
                    <View className="w-16 h-16 border-2 border-white flex items-center justify-center">
                        <View className="w-2 h-2 bg-white" />
                    </View>
                </View>
                {/* Decorative Crosshair corners for 'surgical' feel */}
                <View className="absolute -top-2 -left-2 w-4 h-[1px] bg-white/40" />
                <View className="absolute -top-2 -left-2 w-[1px] h-4 bg-white/40" />
                
                <View className="absolute -bottom-2 -right-2 w-4 h-[1px] bg-white/40" />
                <View className="absolute -bottom-2 -right-2 w-[1px] h-4 bg-white/40" />
            </View>

            {/* Typography Cluster */}
            <View className="flex-col items-center w-full mt-4">
                <Text className="text-4xl md:text-5xl font-headline font-black text-white leading-tight tracking-widest uppercase text-center">
                    YOUR JOURNEY{'\n'}BEGINS NOW.
                </Text>
                
                <View className="flex-row items-center justify-center space-x-6 mt-8 mb-8">
                    <View className="h-[1px] w-8 bg-white/20" />
                    <Text className="text-[10px] font-headline font-black uppercase tracking-widest text-white/40">PHASE 01</Text>
                    <View className="h-[1px] w-8 bg-white/20" />
                </View>

                <Text className="text-[10px] font-body text-white/40 max-w-xs text-center leading-relaxed">
                    Initialize your first blocking sequence to reclaim focus.
                </Text>
            </View>
        </View>

        {/* Primary Action */}
        <View className="absolute bottom-12 w-full max-w-xs px-6 self-center z-50">
            <TouchableOpacity 
                onPress={onFinish}
                activeOpacity={0.8}
                className="w-full bg-white flex items-center justify-center py-6 px-8 rounded-none active:scale-[0.98] transition-transform border border-white"
            >
                <Text className="text-black font-headline font-black text-sm tracking-widest uppercase">
                    LET'S GO
                </Text>
            </TouchableOpacity>
        </View>

    </View>
  );
};
