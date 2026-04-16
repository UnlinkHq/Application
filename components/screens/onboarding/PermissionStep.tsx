import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, AppState, AppStateStatus } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { hasPermission, requestPermission } from '../../../modules/screen-time';

interface PermissionStepProps {
  onPermissionGranted: () => void;
  onBack?: () => void;
}

export const PermissionStep: React.FC<PermissionStepProps> = ({ onPermissionGranted, onBack }) => {
  const [checking, setChecking] = useState(false);

  const checkPermissionAndProceed = async () => {
    const granted = await hasPermission();
    if (granted) {
      onPermissionGranted();
    }
  };

  const handleGivePermission = async () => {
    const granted = await hasPermission();
    if (granted) {
      onPermissionGranted();
    } else {
      requestPermission();
      setChecking(true);
    }
  };

  useEffect(() => {
    checkPermissionAndProceed();

    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && checking) {
        checkPermissionAndProceed();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [checking]);

  return (
    <View className="flex-1 bg-black">
      <View className="flex-1 items-center justify-center px-4 pb-28">
        {/* Custom Unlink Icon (Surgical Precision) */}
        <View className="relative w-32 h-32 mb-16 items-center justify-center">
          {/* Boxy Link 1 */}
          <View className="absolute top-0 left-0 w-20 h-20 border-4 border-white" />
          {/* Boxy Link 2 (Interlocking / Fractured) */}
          <View className="absolute bottom-0 right-0 w-20 h-20 border-4 border-white bg-black p-1">
            <View className="w-full h-full border-2 border-white/20" />
          </View>
          {/* Fracture Point */}
          <View 
            className="absolute w-8 h-8 bg-black" 
            style={{ transform: [{ rotate: '45deg' }, { translateX: -4 }, { translateY: 4 }] }} 
          />
        </View>

        {/* Headline */}
        <Text className="font-headline font-black text-4xl text-center leading-[1.1] tracking-widest text-white mb-8 uppercase">
          Ready to see your{"\n"}real screen time?
        </Text>

        {/* Body Text */}
        <Text className="font-body text-white/40 text-center text-[10px] leading-relaxed max-w-md">
          Enable ScreenBreak to access Screen Time to generate your personal report. Your data stays private and never leaves your device.
        </Text>
      </View>

      {/* CALL TO ACTION - Fixed Bottom */}
      <View className="absolute bottom-0 w-full p-8 bg-black">
        <View className="max-w-md mx-auto w-full">
          {/* Primary Action */}
          <TouchableOpacity 
            onPress={handleGivePermission}
            activeOpacity={0.9}
            className="w-full bg-white h-20 flex-row items-center justify-center gap-3 px-4"
          >
            <Text className="font-headline font-black text-sm tracking-widest uppercase text-black">
              GIVE PERMISSION
            </Text>
            <MaterialIcons name="arrow-forward" size={18} color="black" />
          </TouchableOpacity>

          {/* Security Note */}
          <View className="mt-6 flex-row items-center justify-center gap-2">
            <MaterialIcons name="verified-user" size={14} color="#72fe88" />
            <Text className="font-label text-[10px] uppercase tracking-widest text-[#72fe88]">
              Encrypted Local Processing Only
            </Text>
          </View>
        </View>
      </View>

    </View>
  );
};
