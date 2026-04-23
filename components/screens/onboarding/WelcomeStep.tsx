import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { BrandLogo } from '../../ui/BrandLogo';
import * as Notifications from 'expo-notifications';

interface WelcomeStepProps {
  onNext: () => void;
}

export const WelcomeStep: React.FC<WelcomeStepProps> = ({ onNext }) => {
  const handleStart = async () => {
    try {
      await Notifications.requestPermissionsAsync();
    } catch (e) {
      console.log('Permission request failed or ignored', e);
    }
    onNext();
  };

  return (
    <View className="flex-1 bg-black flex-col">
      {/* Header Area */}
      <View className="w-full flex-row items-center justify-between px-8 py-6 z-20 border-b border-white/10">
        <View className="flex-1" />
        <View className="flex-[2] items-center">
          <BrandLogo width={100} height={30} />
        </View>
        <View className="flex-1 flex-row justify-end">
          <Text className="font-label text-[10px] tracking-widest text-white/40 uppercase">BETA</Text>
        </View>
      </View>

      {/* Main Content Area */}
      <View className="flex-1 items-center justify-center px-8 z-10 w-full">
        <View className="w-full">
          <Text className="text-xl font-label  text-white/50 uppercase text-center tracking-[0.3em] mb-4">
            The only solution
          </Text>
          <Text className="text-xl font-headline font-semibold text-white uppercase text-center tracking-tighter" style={{ lineHeight: 20 }}>
            FOR FOCUS
          </Text>
        </View>
      </View>

      {/* Footer Action Area */}
      <View className="w-full px-8 pb-8 flex-col items-center z-20">
        <View className="w-full items-center">
          <Text className="text-white/40 font-body text-[10px] mb-8 text-center" style={{ lineHeight: 18 }}>
            The dopamine cycle is quantifiable.{'\n'}Break it now.
          </Text>
          <TouchableOpacity
            onPress={handleStart}
            activeOpacity={0.8}
            className="w-full bg-white py-6 items-center justify-center rounded-none active:scale-[0.98] mb-10"
          >
            <Text className="text-black font-headline font-black uppercase tracking-widest text-center">
              BREAK THE CYCLE
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};
