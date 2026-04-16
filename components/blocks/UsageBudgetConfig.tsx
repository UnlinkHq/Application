import React, { useState } from 'react';
import { View, Text, Switch, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';

interface UsageBudgetConfigProps {
    onBack: () => void;
}

export const UsageBudgetConfig = ({ onBack }: UsageBudgetConfigProps) => {
  const [isEnabled, setIsEnabled] = useState(true);
  const [mode, setMode] = useState<'Separate' | 'Combined'>('Combined');
  const [limitHours, setLimitHours] = useState(1);
  const [limitMinutes, setLimitMinutes] = useState(30);

  return (
    <View className="flex-1 bg-transparent">
      <BottomSheetScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        
        <View className="items-center mb-8 px-6">
            <Text className="text-white/40 font-label text-[10px] uppercase tracking-[0.3em] text-center mb-2">
                PROTOCOL_02: TEMPORAL_THRESHOLD
            </Text>
            <Text className="text-white font-headline font-black text-2xl uppercase tracking-widest text-center">
                CONFIGURE USAGE BUDGET
            </Text>
        </View>

        {/* Enable Toggle - Surgical Style */}
        <View className="border-2 border-white p-5 flex-row justify-between items-center mb-6">
            <View className="flex-row items-center">
                <Ionicons name="flash-outline" size={20} color="white" style={{ marginRight: 12}} />
                <Text className="text-white font-headline font-black text-lg uppercase tracking-widest">ENABLE PROTOCOL</Text>
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
                <Text className="text-white font-headline font-black text-lg uppercase tracking-widest flex-1">NAME</Text>
                <View className="flex-row items-center">
                    <Text className="text-white/40 font-label text-[10px] mr-2">Usage budget</Text>
                    <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
                </View>
             </View>
             <TouchableOpacity className="flex-row items-center p-5">
                <Text className="text-white font-headline font-black text-lg uppercase tracking-widest flex-1">APPS BLOCKING</Text>
                <View className="flex-row items-center">
                    <Text className="text-white/40 font-label text-[10px] mr-2">0 selected</Text>
                    <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
                </View>
             </TouchableOpacity>
        </View>

        {/* Usage Counting Logic */}
        <Text className="text-white font-headline font-black text-xs uppercase tracking-widest mb-4">LOGIC MODE</Text>
        <View className="border-2 border-white p-5 mb-8 flex-row justify-between items-center">
             <Text className="text-white/40 font-label text-[10px] uppercase tracking-widest">CALCULATION</Text>
             <View className="flex-row border border-white/20 p-1">
                 <TouchableOpacity 
                    onPress={() => setMode('Separate')}
                    className={`px-4 py-2 no-corners ${mode === 'Separate' ? 'bg-white' : 'bg-transparent'}`}
                 >
                     <Text className={`font-headline font-black text-[10px] uppercase ${mode === 'Separate' ? 'text-black' : 'text-white'}`}>SEPARATE</Text>
                 </TouchableOpacity>
                 <TouchableOpacity 
                    onPress={() => setMode('Combined')}
                    className={`px-4 py-2 no-corners ${mode === 'Combined' ? 'bg-white' : 'bg-transparent'}`}
                 >
                     <Text className={`font-headline font-black text-[10px] uppercase ${mode === 'Combined' ? 'text-black' : 'text-white'}`}>COMBINED</Text>
                 </TouchableOpacity>
             </View>
        </View>

        {/* Budget Configuration */}
        <Text className="text-white font-headline font-black text-xs uppercase tracking-[0.3em] mb-4">SET_TIME_LIMIT</Text>
        <View className="border-2 border-white p-6 mb-12">
             <View className="flex-row justify-center items-center">
                 <View className="items-center">
                    <View className="border-2 border-white p-4 w-20 items-center">
                        <Text className="text-white text-3xl font-headline font-black">{limitHours}</Text>
                    </View>
                    <Text className="text-white/40 font-label text-[10px] tracking-widest mt-2">HOURS</Text>
                 </View>
                 <Text className="text-white text-3xl font-headline font-black mx-4">:</Text>
                 <View className="items-center">
                    <View className="border-2 border-white p-4 w-20 items-center">
                         <Text className="text-white text-3xl font-headline font-black">{limitMinutes.toString().padStart(2, '0')}</Text>
                    </View>
                    <Text className="text-white/40 font-label text-[10px] tracking-widest mt-2">MINUTES</Text>
                 </View>
             </View>
        </View>

        <View className="h-12" />
      </BottomSheetScrollView>

      {/* Action Button - Surgical Style */}
      <TouchableOpacity
        className="bg-white h-16 items-center justify-center mb-6"
        activeOpacity={0.9}
        onPress={onBack}
      >
        <Text className="text-black font-headline font-black text-lg uppercase tracking-widest">CONFIRM PROTOCOL</Text>
      </TouchableOpacity>
    </View>
  );
};
