import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UToggle } from '../ui/UToggle';
import * as Haptics from 'expo-haptics';

interface SecurityConfigProps {
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
}

// Focus session protection is optional and off by default. It uses the already
// granted Accessibility service only during a user-started focus session.
export const SecurityConfig = ({ enabled, onEnabledChange }: SecurityConfigProps) => {
  const handleToggle = (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onEnabledChange(value);
  };

  return (
    <View className="mt-4">
      <Text className="mb-3 font-headline text-[10px] font-black uppercase tracking-[0.3em] text-white/20">
        OPTIONAL PROTECTION
      </Text>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => handleToggle(!enabled)}
        className="flex-row items-center border border-white/10 bg-black/40 p-4">
        <View className="mr-4 h-9 w-9 items-center justify-center border border-white/10 bg-white/5">
          <Ionicons name="shield-checkmark-outline" size={18} color="white" />
        </View>
        <View className="flex-1">
          <Text className="font-headline text-[11px] font-black uppercase tracking-tight text-white">
            FOCUS SESSION PROTECTION
          </Text>
          <Text className="mt-1 font-label text-[10px] leading-tight text-white/40">
            Optional and off by default. When you manually enable it, Unlink helps keep a
            user-started focus session active until its timer ends.
          </Text>
        </View>
        <View pointerEvents="none">
          <UToggle value={enabled} onValueChange={() => {}} />
        </View>
      </TouchableOpacity>
    </View>
  );
};
