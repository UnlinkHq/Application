import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useBlocking } from '../../context/BlockingContext';
import { LaunchLimitConfig } from '../blocks/LaunchLimitConfig';
import { UsageBudgetConfig } from '../blocks/UsageBudgetConfig';
import { ScheduleBlockConfig } from '../blocks/ScheduleBlockConfig';
import { RuleCreationModal } from '../blocks/RuleCreationModal';

export const BlocksScreen = () => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [activeConfig, setActiveConfig] = useState<string | null>(null);

  const handleSelectRule = (ruleId: string) => {
    setActiveConfig(ruleId);
  };

  if (activeConfig === 'schedule') {
      return <ScheduleBlockConfig onBack={() => setActiveConfig(null)} />;
  }

  if (activeConfig === 'launch') {
      return <LaunchLimitConfig onBack={() => setActiveConfig(null)} />;
  }

  if (activeConfig === 'usage') {
      return <UsageBudgetConfig onBack={() => setActiveConfig(null)} />;
  }

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['top']}>
      <View className="flex-1">
        
        {/* Header - Optical Instrument Branding */}
        <View className="h-16 flex-row items-center justify-between px-6 border-b border-white/10 bg-black">
            <View className="flex-row items-center gap-2">
                <MaterialIcons name="link-off" size={24} color="white" />
                <Text className="font-headline font-black text-2xl tracking-[0.2em] text-white">UNLINK</Text>
            </View>
            <View className="flex-row items-center gap-4">
                <TouchableOpacity>
                    <MaterialIcons name="notifications-none" size={24} color="#5d5f5f" />
                </TouchableOpacity>
                <View className="w-8 h-8 rounded-full border border-white/20 overflow-hidden">
                    <Image 
                        source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBUeGsbHEB8rtvHLaZZi0isp6NjjJYjjkG9WZgStcPLCpV4x7f6VkiU0LvcS7mkFKDkmJCC_dPdOdSpXat487hhko57AJqN0OW9PA9W8kHSLmj_AQ0WMApqSJ1kofXMfaBKFs_hzCf0YmqYXwaVzSMzAfvSINvlRYfXm3-f-ubC0i_tVkcyrhuD0HiBYF7pBeXl1uQ2uBsaE4ggCfi2pb8YhFnJyQBE7r9GZTh6alGDQLTaEwp5pP1pzP_nie35iYk-EQ3HTlA7gD8' }} 
                        className="w-full h-full"
                    />
                </View>
            </View>
        </View>

        <ScrollView className="flex-1 px-6" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingBottom: 240 }}>
            {/* Minimalist Empty State */}
            <View className="items-center text-center space-y-12">
                {/* Abstract Icon with Surgical Aesthetic */}
                <View className="w-32 h-32 items-center justify-center">
                    <View className="absolute inset-0 border border-white/5 rounded-full" />
                    <View className="absolute inset-4 border border-white/10 rounded-full" />
                    <MaterialIcons name="block" size={64} color="rgba(255,255,255,0.2)" />
                    {/* Diagonal Slash */}
                    <View 
                        className="absolute h-[1px] bg-white/40 w-24" 
                        style={{ transform: [{ rotate: '45deg' }] }} 
                    />
                </View>

                {/* Typography Hierarchy */}
                <View className="space-y-4 items-center mt-8">
                    <Text className="font-headline  text-4xl tracking-tighter uppercase text-white text-center">
                        No active block rules
                    </Text>
                    <Text className="font-label text-sm text-white/40 uppercase tracking-[0.2em] text-center mt-4 px-4 max-w-[280px]">
                        Block and gain freedom from the endless scroll.
                    </Text>
                </View>

              
            </View>
        </ScrollView>

        {/* Massive High-Contrast Action Button */}
        <View className="absolute bottom-36 left-0 w-full px-6 flex items-center">
            <TouchableOpacity 
                onPress={() => setIsModalVisible(true)}
                activeOpacity={0.9}
                className="w-full bg-white h-16 flex-row items-center justify-center shadow-2xl"
            >
                <MaterialIcons name="add" size={24} color="black" />
                <Text className="font-headline font-black text-lg tracking-[0.3em] uppercase text-black ml-2">
                    Add Block Rule
                </Text>
            </TouchableOpacity>
        </View>

        <RuleCreationModal 
            visible={isModalVisible}
            onClose={() => setIsModalVisible(false)}
            onSelectRule={handleSelectRule}
        />
      </View>
    </SafeAreaView>
  );
};
