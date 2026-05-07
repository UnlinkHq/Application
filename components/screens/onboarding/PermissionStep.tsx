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
  const [showDoubts, setShowDoubts] = useState(false);

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
      <View className="flex-1 items-center justify-center px-6">
        {/* Headline */}
        <Text className="font-headline font-black text-3xl text-center leading-tight tracking-widest text-white mb-6 uppercase">
          READY TO START{"\n"}YOUR RECLAMATION?
        </Text>

        {/* Privacy & Trust Block (Toggleable) */}
        {showDoubts && (
          <View className="w-full bg-white/5 p-6 rounded-2xl border border-white/10 mb-6">
            <View className="flex-row items-center gap-2 mb-4">
              <MaterialIcons name="verified-user" size={16} color="#72fe88" />
              <Text className="font-headline font-black text-[12px] uppercase tracking-widest text-[#72fe88]">
                Our Privacy Promise
              </Text>
            </View>
            
            <Text className="font-body text-white/60 text-[11px] leading-relaxed mb-6">
              Unlike other apps, Unlink is 100% private. Your behavior data never leaves this phone. 
              {"\n\n"}
              • <Text className="text-white font-bold uppercase">Accessibility:</Text> Used strictly to detect and surgically block addictive app loops in real-time.
              {"\n\n"}
              • <Text className="text-white font-bold uppercase">Usage Stats:</Text> Used to calculate your Brainrot Score and generate offline reports.
              {"\n\n"}
              • <Text className="text-white font-bold uppercase">Zero Tracking:</Text> No analytics, no ads, no cloud sync. Just you and your focus.
            </Text>

            {/* Trust Buttons */}
            <View className="flex-row gap-3">
               <TouchableOpacity 
                 activeOpacity={0.7}
                 className="flex-1 bg-white/10 py-4 items-center rounded-xl border border-white/5"
               >
                  <Text className="font-headline font-black text-[9px] uppercase tracking-widest text-white">VIEW GITHUB</Text>
               </TouchableOpacity>
               <TouchableOpacity 
                 activeOpacity={0.7}
                 className="flex-1 bg-white/10 py-4 items-center rounded-xl border border-white/5"
               >
                  <Text className="font-headline font-black text-[9px] uppercase tracking-widest text-white">CONTACT DEV</Text>
                  <Text className="text-[7px] text-white/30 absolute -bottom-4 lowercase italic">will reply soon</Text>
               </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Main Icon (Only show if doubts hidden to save space) */}
        {!showDoubts && (
          <View className="relative w-24 h-24 mb-12 items-center justify-center opacity-40">
            <View className="absolute top-0 left-0 w-16 h-16 border-2 border-white" />
            <View className="absolute bottom-0 right-0 w-16 h-16 border-2 border-white" />
          </View>
        )}

        {/* Footer Subtext */}
        <Text className="font-body text-white/30 text-center text-[10px] leading-relaxed max-w-xs">
          To comply with Play Store policies and protect your focus, we require these permissions to interact with your device's system.
        </Text>
      </View>

      {/* CALL TO ACTION - Fixed Bottom */}
      <View className="w-full p-8 bg-black">
        <View className="max-w-md mx-auto w-full">
          {/* Toggle Doubts Link */}
          <TouchableOpacity 
            onPress={() => setShowDoubts(!showDoubts)}
            activeOpacity={0.7}
            className="mb-8 flex-row items-center justify-center gap-2"
          >
            <Text className="font-label text-[10px] uppercase tracking-widest text-white/40">
              {showDoubts ? "Hide Details" : "Having doubts? Read our Privacy Promise"}
            </Text>
            <MaterialIcons name={showDoubts ? "expand-less" : "expand-more"} size={14} color="white" style={{ opacity: 0.4 }} />
          </TouchableOpacity>

          {/* Primary Action */}
          <TouchableOpacity 
            onPress={handleGivePermission}
            activeOpacity={0.9}
            className="w-full bg-white h-20 flex-row items-center justify-center gap-3"
          >
            <Text className="font-headline font-black text-sm tracking-widest uppercase text-black">
              ENABLE PROTECTION
            </Text>
            <MaterialIcons name="security" size={18} color="black" />
          </TouchableOpacity>

          {/* Bottom Badge */}
          <View className="mt-6 flex-row items-center justify-center gap-2 opacity-50">
            <MaterialIcons name="lock" size={12} color="white" />
            <Text className="font-label text-[9px] uppercase tracking-widest text-white">
              End-to-End Local Processing
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};
