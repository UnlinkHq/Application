import React, { useState } from 'react';
import { View, Text, Switch, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface LaunchLimitConfigProps {
    onBack: () => void;
}

export const LaunchLimitConfig = ({ onBack }: LaunchLimitConfigProps) => {
  const [isEnabled, setIsEnabled] = useState(true);
  const [limit, setLimit] = useState(5);

  return (
    <View className="flex-1 bg-transparent">
      <View className="flex-1">
        
        <View className="items-center mb-8 px-6">
            <Text className="text-white/40 font-label text-[10px] uppercase tracking-[0.3em] text-center mb-2">
                PROTOCOL_03: FREQUENCY_THRESHOLD
            </Text>
            <Text className="text-white font-headline font-black text-2xl uppercase tracking-widest text-center">
                CONFIGURE LAUNCH LIMIT
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
                    <Text className="text-white/40 font-label text-[10px] mr-2">Launch threshold</Text>
                    <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
                </View>
             </View>
             <TouchableOpacity className="flex-row items-center p-5">
                <Text className="text-white font-headline font-black text-lg uppercase tracking-widest flex-1">APPS TRACKED</Text>
                <View className="flex-row items-center">
                    <Text className="text-white/40 font-label text-[10px] mr-2">0 selected</Text>
                    <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
                </View>
             </TouchableOpacity>
        </View>

        {/* Frequency Logic */}
        <Text className="text-white font-headline font-black text-xs uppercase tracking-widest mb-4">THRESHOLD SETTING</Text>

        <View className="border-2 border-white p-6 mb-12">
             <Text className="text-white/40 font-label text-[10px] uppercase tracking-widest mb-6 text-center">MAXIMUM DAILY LAUNCHES</Text>
             <View className="flex-row justify-center items-center py-4">
                 <TouchableOpacity
                    className="w-12 h-12 border border-white/20 items-center justify-center"
                    onPress={() => setLimit(Math.max(1, limit - 1))}
                 >
                     <Ionicons name="remove" size={24} color="white" />
                 </TouchableOpacity>

                 <View className="mx-12 items-center">
                     <Text className="text-white text-5xl font-headline font-black">{limit}</Text>
                     <Text className="text-white/40 font-label text-[10px] tracking-widest mt-2 uppercase">Launches</Text>
                 </View>

                 <TouchableOpacity
                    className="w-12 h-12 border border-white/20 items-center justify-center"
                    onPress={() => setLimit(limit + 1)}
                 >
                     <Ionicons name="add" size={24} color="white" />
                 </TouchableOpacity>
             </View>
        </View>

        <View className="h-24" />
      </View>

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
