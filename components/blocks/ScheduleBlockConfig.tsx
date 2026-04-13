import React, { useState } from 'react';
import { View, Text, Switch, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';

interface ScheduleBlockConfigProps {
    onBack: () => void;
}

export const ScheduleBlockConfig = ({ onBack }: ScheduleBlockConfigProps) => {
  const [isEnabled, setIsEnabled] = useState(true);
  const [days, setDays] = useState(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  
  const allDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const toggleDay = (day: string) => {
      if (days.includes(day)) {
          setDays(days.filter(d => d !== day));
      } else {
          setDays([...days, day]);
      }
  };

  return (
    <View className="flex-1 bg-transparent">
      <BottomSheetScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        
        <View className="items-center mb-8 px-6">
             <Text className="text-white/40 font-label text-[10px] uppercase tracking-[0.2em] text-center mb-2">
                PROTOCOL_01: FOCUS_WINDOW
            </Text>
            <Text className="text-white font-headline font-black text-2xl uppercase tracking-tighter text-center">
                Configure Schedule
            </Text>
        </View>

        {/* Enable Toggle - Surgical Style */}
        <View className="border-2 border-white p-5 flex-row justify-between items-center mb-6">
            <View className="flex-row items-center">
                <Ionicons name="flash-outline" size={20} color="white" style={{ marginRight: 12}} />
                <Text className="text-white font-headline font-black text-lg uppercase tracking-tight">ENABLE_PROTOCOL</Text>
            </View>
            <Switch 
                value={isEnabled}
                onValueChange={setIsEnabled}
                trackColor={{ false: '#333', true: '#FFF' }}
                thumbColor={isEnabled ? '#000' : '#888'}
            />
        </View>

        {/* Inputs - Surgical Style */}
        <View className="border-2 border-white mb-6">
             <View className="flex-row items-center p-5 border-b border-white/20">
                <Text className="text-white font-headline font-black text-lg uppercase tracking-tight flex-1">NAME</Text>
                <View className="flex-row items-center">
                    <Text className="text-white/60 font-label text-xs uppercase tracking-widest mr-2">SCHEDULE_BLOCK</Text>
                    <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
                </View>
             </View>
             <TouchableOpacity className="flex-row items-center p-5">
                <Text className="text-white font-headline font-black text-lg uppercase tracking-tight flex-1">APPS_RESTRICTED</Text>
                <View className="flex-row items-center">
                    <Text className="text-white/60 font-label text-xs uppercase tracking-widest mr-2">0_SELECTED</Text>
                    <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
                </View>
             </TouchableOpacity>
        </View>

        {/* Block Activation Timing */}
        <Text className="text-white font-headline font-black text-xs uppercase tracking-[0.3em] mb-4">ACTIVE_WINDOW</Text>

        <View className="border-2 border-white p-5 mb-6">
            <Text className="text-white/60 font-label text-[10px] uppercase tracking-widest mb-4">RECURRENCE_PATTERN</Text>
            <View className="flex-row justify-between">
                {allDays.map(day => (
                    <TouchableOpacity 
                        key={day}
                        onPress={() => toggleDay(day)}
                        className={`w-10 h-10 border no-corners items-center justify-center ${days.includes(day) ? 'bg-white border-white' : 'bg-black border-white/20'}`}
                    >
                        <Text className={`font-headline font-black text-[10px] uppercase ${days.includes(day) ? 'text-black' : 'text-white'}`}>{day[0]}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>

        <View className="border-2 border-white p-6 mb-12">
             <Text className="text-white/60 font-label text-[10px] uppercase tracking-widest mb-6">TIME_BOUNDARIES</Text>
             <View className="flex-row justify-between items-center py-4 border-b border-white/10">
                 <Text className="text-white font-headline font-black text-sm uppercase">START_PHASE</Text>
                 <View className="border border-white/20 px-4 py-2 no-corners">
                     <Text className="text-white font-headline font-black text-xs">12:00 AM</Text>
                 </View>
             </View>
             <View className="flex-row justify-between items-center py-4 pt-6">
                 <Text className="text-white font-headline font-black text-sm uppercase">END_PHASE</Text>
                 <View className="border border-white/20 px-4 py-2 no-corners">
                     <Text className="text-white font-headline font-black text-xs">11:59 PM</Text>
                 </View>
             </View>
        </View>

        <View className="h-12" />
      </BottomSheetScrollView>

      {/* Action Button - Surgical Style */}
      <TouchableOpacity 
        className="bg-white h-16 items-center justify-center mb-6 no-corners"
        activeOpacity={0.9}
        onPress={onBack}
      >
        <Text className="text-black font-headline font-black text-lg uppercase tracking-[0.3em]">CONFIRM_PROTOCOL</Text>
      </TouchableOpacity>
    </View>
  );
};
