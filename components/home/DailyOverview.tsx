import React, { memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { DailyUsage, formatDuration } from '../../utils/screenTimeData';

interface Props {
  dailyData?: DailyUsage;
  selectedAppId: string | null;
  selectedAppDuration: number;
  onClearAppSelection: () => void;
}

export const DailyOverview = memo(({
  dailyData,
  selectedAppId,
  selectedAppDuration,
  onClearAppSelection
}: Props) => {
  const displayDuration = selectedAppId 
    ? formatDuration(selectedAppDuration) 
    : (dailyData ? formatDuration(dailyData.totalDuration) : "0h 00m");

  const totalSeconds = dailyData?.totalDuration || 0;
  // Use 12 hours as default max for the bar if no explicit goal, 
  // though HTML mentions 6H goal.
  const progressPercent = Math.min(100, (totalSeconds / (12 * 3600)) * 100);

  return (
    <View className="px-6 mb-12 space-y-4">
      {/* Label and Large Counter */}
      <View className="flex-col gap-1">
        <Text className="font-label text-xs uppercase tracking-widest text-[#919191]">
          Total Digital Footprint
        </Text>
        <Text className="font-headline text-6xl font-black tracking-tighter leading-none text-white">
          {displayDuration}
        </Text>
      </View>

      {/* Pickups and Goal Meta Row */}
      <View className="flex-row items-end justify-between border-b border-white/10 pb-4">
        <View className="flex-row items-center gap-2">
            <MaterialIcons name="pan-tool" size={16} color="#ffb4aa" />
            <Text className="font-label text-sm uppercase tracking-tighter text-white">
                Pickups: {dailyData?.pickups || 0}
            </Text>
        </View>
        <Text className="font-label text-[10px] text-[#72fe88]">
            DAILY GOAL: 6H 00M
        </Text>
      </View>

      {/* Thin Monochrome Progress Bar */}
      <View className="w-full h-1 bg-[#2a2a2a] overflow-hidden">
        <View 
          className="h-full bg-white" 
          style={{ width: `${progressPercent}%` }} 
        />
      </View>

      {selectedAppId && (
        <TouchableOpacity 
            onPress={onClearAppSelection} 
            className="flex-row items-center mt-2 px-3 py-1 bg-white/10 self-start"
        >
            <Text className="text-white font-label text-[10px] uppercase mr-2">Clear Filter</Text>
            <MaterialIcons name="close" size={12} color="white" />
        </TouchableOpacity>
      )}
    </View>
  );
});

DailyOverview.displayName = 'DailyOverview';
