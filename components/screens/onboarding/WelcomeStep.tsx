import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

interface WelcomeStepProps {
  onNext: () => void;
}

export const WelcomeStep: React.FC<WelcomeStepProps> = ({ onNext }) => {
  return (
    <View className="flex-1 bg-black flex-col">
      {/* Header Area */}
      <View className="w-full flex-row items-center justify-between px-8 py-6 z-20 border-b border-white/10">
        <View className="flex-1" />
        <View className="flex-[2] items-center">
          <Text className="text-lg  tracking-[3px] text-white font-headline uppercase">UNLINK</Text>
        </View>
        <View className="flex-1 flex-row justify-end">
          <Text className="font-label text-[10px] tracking-[2px] text-white/40 uppercase">V-0.1BETA</Text>
        </View>
      </View>

      {/* Main Content Area */}
      <View className="flex-1 items-center justify-center px-8 z-10 w-full">
        <View className="w-full">
          <Text className="text-5xl  font-headline text-white uppercase text-center" style={{ lineHeight: 48, letterSpacing: -1 }}>
            THE 48-HOUR{'\n'}CRASH IS REAL.
          </Text>
        </View>
      </View>

      {/* Footer Action Area */}
      <View className="w-full px-8 pb-8 flex-col items-center z-20">
        <View className="w-full items-center">
          <Text className="text-white/40 font-body text-[10px] tracking-[2px] uppercase mb-8 text-center" style={{ lineHeight: 18 }}>
            The dopamine cycle is quantifiable.{'\n'}Break it now.
          </Text>
          <TouchableOpacity 
            onPress={onNext}
            activeOpacity={0.8}
            className="w-full bg-white py-6 items-center justify-center rounded-none active:scale-[0.98] mb-10 transition-transform"
          >
            <Text className="text-black font-headline font-bold uppercase tracking-[2px]  text-center">
              BREAK THE CYCLE
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};
