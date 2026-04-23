import React from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BrandLogo } from '../../ui/BrandLogo';

interface OnboardingHeaderProps {
  currentStep: number;
  totalSteps: number;
  onBack: () => void;
  showBack?: boolean;
}

export const OnboardingHeader: React.FC<OnboardingHeaderProps> = ({
  currentStep,
  totalSteps,
  onBack,
  showBack = true
}) => {
  const { width } = Dimensions.get('window');
  const progress = (currentStep + 1) / totalSteps;

  return (
    <View className="w-full bg-black">
      <View className="w-full flex-row items-center justify-between px-6 py-4">
        {/* Back Button */}
        <View className="w-10 h-10 items-start justify-center">
          {showBack && (
            <TouchableOpacity onPress={onBack} activeOpacity={0.8} className="w-10 h-10 items-center justify-center -ml-2">
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
          )}
        </View>

        {/* Center Text */}
        <View className="flex-[2] items-center">
          <BrandLogo width={80} height={24} />
        </View>

        {/* Right Label */}
        <View className="w-10 items-end justify-center">
          <Text className="font-label text-[10px] tracking-widest text-white/40 uppercase hidden sm:flex">V.01</Text>
        </View>
      </View>

      {/* Sleek Progress Bar integrated as the bottom border */}
      <View className="w-full h-[1px] bg-white/10 relative">
        <View
          className="absolute left-0 top-0 bottom-0 bg-white"
          style={{ width: `${progress * 100}%` }}
        />
      </View>
    </View>
  );
};
