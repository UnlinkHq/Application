import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  interpolate, 
  Extrapolation 
} from 'react-native-reanimated';
import { RuleCreationModal } from '../blocks/RuleCreationModal';
import { UsageBudgetConfig } from '../blocks/UsageBudgetConfig';
import { ScheduleBlockConfig } from '../blocks/ScheduleBlockConfig';
import { LaunchLimitConfig } from '../blocks/LaunchLimitConfig';
import { BottomSheetWrapper } from '../ui/BottomSheetWrapper';

export const BlocksScreen = () => {
  const [isSelectionVisible, setIsSelectionVisible] = useState(false);
  const [activeConfigId, setActiveConfigId] = useState<string | null>(null);

  const selectionIndex = useSharedValue(-1);
  const configIndex = useSharedValue(-1);

  const handleSelectRule = useCallback((ruleId: string) => {
    setActiveConfigId(ruleId);
  }, []);

  const animatedContainerStyle = useAnimatedStyle(() => {
    const activeIndex = Math.max(selectionIndex.value, configIndex.value);
    
    const scale = interpolate(activeIndex, [-1, 0], [1, 0.94], Extrapolation.CLAMP);
    const borderRadius = interpolate(activeIndex, [-1, 0], [0, 16], Extrapolation.CLAMP);
    const opacity = interpolate(activeIndex, [-1, 0], [1, 0.6], Extrapolation.CLAMP);

    return {
      transform: [{ scale }],
      borderRadius,
      opacity,
      overflow: 'hidden' as const,
      backgroundColor: '#000',
    };
  });

  const renderActiveConfig = () => {
    switch (activeConfigId) {
      case 'usage':
        return <UsageBudgetConfig onBack={() => setActiveConfigId(null)} />;
      case 'schedule':
        return <ScheduleBlockConfig onBack={() => setActiveConfigId(null)} />;
      case 'launch':
        return <LaunchLimitConfig onBack={() => setActiveConfigId(null)} />;
      case 'block_now':
        return (
          <View className="items-center justify-center py-10 px-6">
            <View className="border-4 border-white p-6 mb-8">
              <MaterialIcons name="bolt" size={48} color="white" />
            </View>
            <Text className="text-white font-headline font-black text-2xl uppercase tracking-tighter text-center mb-4">
              CONFIRM_PROTOCOL_00
            </Text>
            <Text className="text-white/40 font-label text-xs uppercase tracking-[0.2em] text-center mb-10">
              Immediate system-wide focus activation
            </Text>
            <TouchableOpacity 
              className="bg-white px-12 py-5 no-corners w-full"
              onPress={() => setActiveConfigId(null)}
            >
              <Text className="text-black font-headline font-black text-lg uppercase text-center tracking-widest">ACTIVATE_NOW</Text>
            </TouchableOpacity>
          </View>
        );
      case 'stop':
        return (
          <View className="items-center justify-center py-10 px-6">
             <View className="border-4 border-white p-6 mb-8">
              <MaterialIcons name="stop" size={48} color="white" />
            </View>
            <Text className="text-white font-headline font-black text-2xl uppercase tracking-tighter text-center mb-4">
              EMERGENCY_OVERRIDE
            </Text>
             <Text className="text-white/40 font-label text-xs uppercase tracking-[0.2em] text-center mb-10 ">
              PROTOCOL_03: TERMINATE_ALL_BLOCKS
            </Text>
            <TouchableOpacity 
              className="bg-red-600 px-12 py-5 no-corners w-full"
              onPress={() => setActiveConfigId(null)}
            >
              <Text className="text-white font-headline font-black text-lg uppercase text-center tracking-widest">TERMINATE_ALL</Text>
            </TouchableOpacity>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.container, animatedContainerStyle]}>
        <SafeAreaView className="flex-1 bg-black" edges={['top']}>
          <View className="flex-1">
            {/* Header - Optical Instrument Branding */}
            <View className="h-16 flex-row items-center justify-between px-6 border-b border-white/20 bg-black">
                <View className="flex-row items-center gap-2">
                    <MaterialIcons name="link-off" size={24} color="white" />
                    <Text className="font-headline font-black text-2xl tracking-[0.1em] text-white uppercase italic">UNLINK</Text>
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
                <View className="items-center text-center">
                    <View className="w-32 h-32 items-center justify-center">
                        <View className="absolute inset-0 border border-white/5 rounded-full" />
                        <View className="absolute inset-4 border border-white/10 rounded-full" />
                        <MaterialIcons name="block" size={64} color="rgba(255,255,255,0.2)" />
                        <View 
                            className="absolute h-[1px] bg-white/40 w-24" 
                            style={{ transform: [{ rotate: '45deg' }] }} 
                        />
                    </View>

                    <View className="space-y-4 items-center mt-12">
                        <Text className="font-headline font-black text-4xl tracking-tighter uppercase text-white text-center">
                            No active block rules
                        </Text>
                        <Text className="font-label text-sm text-white/40 uppercase tracking-[0.2em] text-center mt-2 px-4 max-w-[280px]">
                            Block and gain freedom from the endless scroll.
                        </Text>
                    </View>
                </View>
            </ScrollView>

            {/* Massive Action Button */}
            <View className="absolute bottom-36 left-0 w-full px-6 flex items-center">
                <TouchableOpacity 
                    onPress={() => setIsSelectionVisible(true)}
                    activeOpacity={0.9}
                    className="w-full bg-white h-16 flex-row items-center justify-center shadow-2xl no-corners"
                >
                    <MaterialIcons name="add" size={24} color="black" />
                    <Text className="font-headline font-black text-lg tracking-[0.3em] uppercase text-black ml-2">
                        Add Block Rule
                    </Text>
                </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Animated.View>

      <RuleCreationModal 
          visible={isSelectionVisible}
          onClose={() => setIsSelectionVisible(false)}
          onSelectRule={handleSelectRule}
          animatedIndex={selectionIndex}
      />

      <BottomSheetWrapper
          visible={activeConfigId !== null}
          onClose={() => setActiveConfigId(null)}
          onBack={() => setActiveConfigId(null)}
          snapPoints={['90%']}
          animatedIndex={configIndex}
          title={
              activeConfigId === 'usage' ? 'SET TIME LIMITS' :
              activeConfigId === 'schedule' ? 'SCHEDULE BLOCKING' :
              activeConfigId === 'launch' ? 'APP LAUNCH LIMIT' :
              activeConfigId === 'block_now' ? 'BLOCK NOW' :
              activeConfigId === 'stop' ? 'STOP BLOCKING' :
              undefined
          }
      >
          {renderActiveConfig()}
      </BottomSheetWrapper>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  container: {
    flex: 1,
  },
});
