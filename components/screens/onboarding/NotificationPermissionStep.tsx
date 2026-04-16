import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import * as Notifications from 'expo-notifications';
import { MaterialIcons } from '@expo/vector-icons';

interface NotificationPermissionStepProps {
  onNext: () => void;
}

export const NotificationPermissionStep: React.FC<NotificationPermissionStepProps> = ({ onNext }) => {
  const requestNotificationPermission = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    // Move forward regardless of the outcome for onboarding flow
    onNext();
  };

  return (
    <View className="flex-1 bg-black relative">
      <View className="flex-1 pt-10 pb-32 px-8 max-w-2xl w-full self-center">
        {/* Section Header */}
        <View >
            <View className="flex-row items-center mb-2">
                <View className="h-[1px] w-8 bg-white/10 mr-2" />
                <Text className="font-label text-[10px] tracking-widest text-white/40 uppercase">
                    CRITICAL PERMISSION
                </Text>
            </View>

            <Text className="text-4xl md:text-5xl font-headline font-black tracking-widest leading-none mb-6 text-white text-left uppercase">
                SYSTEM AUTHORIZATION
            </Text>
            
            <Text className="font-body text-white/40 text-[10px] leading-relaxed max-w-md">
                Unlink requires system-level notifications to interrupt the dopamine loop. Without this, the intervention cannot be executed.
            </Text>
        </View>

        {/* Notification Visual */}
        <View className="flex-1 items-center justify-center py-2">
            <View className="w-full aspect-square border border-white/10 relative flex items-center justify-center overflow-hidden">
                
                {/* Visual Grid/Diagonal Placeholder */}
                <View className="absolute inset-0 opacity-[0.03] bg-white" />

                {/* Minimal Notification Card */}
                <View className="relative z-10 w-full max-w-[280px] bg-[#111111] border border-white/10 p-5 flex-row items-center shadow-2xl">
                    {/* Icon Box */}
                    <View className="w-10 h-10 bg-white flex items-center justify-center shrink-0 mr-4">
                        <MaterialIcons name="notifications" size={24} color="black" />
                    </View>
                    
                    {/* Content Box */}
                    <View className="flex-col justify-center h-10">
                        <Text className="font-headline font-black text-xs text-white leading-tight uppercase tracking-widest">
                            NOTIFICATION REQUIRED
                        </Text>
                        <Text className="font-label text-[10px] uppercase tracking-widest text-white/40 mt-1">
                            SYSTEM OVERRIDE
                        </Text>
                    </View>

                    {/* Corner Accents */}
                    <View className="absolute -top-[1px] -left-[1px] w-2 h-2 border-t border-l border-white" />
                    <View className="absolute -bottom-[1px] -right-[1px] w-2 h-2 border-b border-r border-white" />
                </View>

                {/* Structural Grid Detail */}
                <View className="absolute inset-0 border-[0.5px] border-white/5 pointer-events-none" />
            </View>
        </View>
      </View>

      {/* Fixed Action Block */}
      <View className="absolute bottom-0 left-0 right-0 p-6 md:p-8 border-t border-white/10" style={{ backgroundColor: 'rgba(0,0,0,0.95)' }}>
          <TouchableOpacity
              onPress={requestNotificationPermission}
              activeOpacity={0.8}
              className="w-full py-6 bg-white flex-row items-center justify-center rounded-none active:scale-[0.99]"
          >
              <Text className="text-black font-headline font-black text-lg tracking-widest uppercase mr-3">
                  GIVE PERMISSION
              </Text>
              <MaterialIcons name="arrow-forward" size={24} color="black" />
          </TouchableOpacity>
          
          <View className="mt-4 flex-row justify-center">
              <TouchableOpacity onPress={onNext} className="active:opacity-50 transition-opacity">
                  <Text className="font-label text-[10px] text-white/40 uppercase tracking-widest font-black py-2">
                      REMIND ME LATER
                  </Text>
              </TouchableOpacity>
          </View>
      </View>
    </View>
  );
};
