import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { getUsageStats } from '../../../modules/screen-time';
import { MaterialIcons } from '@expo/vector-icons';

interface ReclaimTimeStepProps {
  onNext: () => void;
  preFetchedData?: any;
  screenTimeGoal: number;
}

export const ReclaimTimeStep: React.FC<ReclaimTimeStepProps> = ({ 
  onNext,
  preFetchedData,
  screenTimeGoal
}) => {
  const [loading, setLoading] = useState(!preFetchedData);
  const [todaySeconds, setTodaySeconds] = useState(0);

  useEffect(() => {
    if (preFetchedData && preFetchedData.weekHistory) {
      const todayData = preFetchedData.weekHistory[preFetchedData.weekHistory.length - 1];
      setTodaySeconds(todayData ? todayData.duration : 0);
      setLoading(false);
      return;
    }
    fetchData();
  }, [preFetchedData]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const now = new Date();
      const startOfDay = new Date(now.setHours(0, 0, 0, 0)).getTime();
      const endOfDay = new Date(now.setHours(23, 59, 59, 999)).getTime();

      const stats = await getUsageStats(startOfDay, endOfDay);
      const dailyStats: Record<string, number> = stats.daily || {};
      const totalDuration = Object.values(dailyStats).reduce((sum: number, val: number) => sum + val, 0);
      setTodaySeconds(totalDuration / 1000);
    } catch (e) {
      console.error("Failed to fetch today's usage for reclaim step", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator color="#ffffff" size="large" />
      </View>
    );
  }

  const beforeHours = todaySeconds / 3600;
  // Target is the goal set, but we ensure it's at least a 15% reduction if they are already below the goal
  const targetGoalHours = screenTimeGoal;
  const afterHours = beforeHours > targetGoalHours ? targetGoalHours : beforeHours * 0.85;
  const reclaimedHours = beforeHours - afterHours;
  
  const reductionPercentage = beforeHours > 0 ? ((reclaimedHours / beforeHours) * 100).toFixed(1) : "0.0";

  const formatHours = (hours: number) => {
      const h = Math.floor(hours);
      const m = Math.round((hours - h) * 60);
      return `${h}h ${m}m`;
  };

  // Scaling bars: The taller one is always 100% of container height (h-64/h-72)
  // or at least impactful. Let's use 85% for the tallest.
  const beforeHeight = 85; 
  const afterHeight = (afterHours / beforeHours) * beforeHeight;

  return (
    <View className="flex-1 bg-black pt-16 pb-6 px-8 relative overflow-hidden">
      
      {/* Structural Guides Background */}
      <View className="absolute top-24 right-0 w-[px] h-32 bg-white opacity-10" />
      <View className="absolute bottom-32 left-0 w-[px] h-32 bg-white opacity-10" />

      {/* Header Section */}
      <View className="mb-10">
        <Text className="font-label text-[10px] tracking-widest uppercase text-white/40 mb-2">
            PHASE 04: PROJECTION
        </Text>
        <Text className="text-5xl md:text-5xl font-headline font-black tracking-widest leading-none text-white uppercase">
            RECLAIM{'\n'}YOUR TIME
        </Text>
        <View className="w-12 h-[2px] bg-white mt-4" />
      </View>

      {/* Instrument Comparison Display */}
      <View className="flex-col gap-10 py-2 mb-auto">
        {/* Comparison Grid */}
        <View className="flex-row items-end space-x-8 w-full h-80">
            
            {/* Before Column */}
            <View className="flex-1 flex-col justify-end h-full">
                <View className="flex-col mb-4">
                    <Text className="font-label text-[10px] text-[#ffb4aa] uppercase tracking-widest mb-1">STATUS: CURRENT</Text>
                    <Text className="text-3xl font-headline font-black text-white leading-none uppercase">{formatHours(beforeHours)}</Text>
                </View>
                
                <View className="h-64 bg-[#1b1b1b] relative overflow-hidden flex-col justify-end">
                    <View 
                        className="w-full bg-[#ffb4aa] border-t border-[#ff8a7b] opacity-80" 
                        style={{ height: `${beforeHeight}%` }}
                    />
                    {/* High density technical lines */}
                    <View className="absolute inset-0 flex-col justify-between py-6 opacity-10 pointer-events-none px-2">
                        <View className="border-b border-white w-full" />
                        <View className="border-b border-white w-full" />
                        <View className="border-b border-white w-full" />
                        <View className="border-b border-white w-full" />
                        <View className="border-b border-white w-full" />
                    </View>
                </View>
                <Text className="font-label text-[10px] text-[#919191] uppercase text-center mt-3 tracking-widest">Screen Latency</Text>
            </View>

            {/* After Column */}
            <View className="flex-1 flex-col justify-end h-full">
                <View className="flex-col mb-4">
                    <Text className="font-label text-[10px] text-[#72fe88] uppercase tracking-widest mb-1">TARGET: OPTIMIZED</Text>
                    <Text className="text-3xl font-headline font-black text-white leading-none uppercase">{formatHours(afterHours)}</Text>
                </View>
                
                <View className="h-64 bg-[#1b1b1b] relative overflow-hidden flex-col justify-end">
                    <View 
                        className="w-full bg-[#72fe88] border-t border-[#00a741] opacity-80" 
                        style={{ height: `${afterHeight}%` }}
                    />
                    {/* High density technical lines */}
                    <View className="absolute inset-0 flex-col justify-between py-6 opacity-10 pointer-events-none px-2">
                        <View className="border-b border-white w-full" />
                        <View className="border-b border-white w-full" />
                        <View className="border-b border-white w-full" />
                        <View className="border-b border-white w-full" />
                        <View className="border-b border-white w-full" />
                    </View>
                </View>
                <Text className="font-label text-[10px] text-[#919191] uppercase text-center mt-3 tracking-widest">Unlinked Pulse</Text>
            </View>
        </View>

        {/* Precision Metric */}
        <View className="bg-[#0e0e0e] p-6 border-l-2 border-[#72fe88] mt-4">
            <View className="flex-row justify-between items-baseline mb-2">
                <Text className="font-label text-[10px] text-white/40 uppercase tracking-widest">PROJECTED RECAPTURE</Text>
                <Text className="font-headline font-black text-2xl text-[#72fe88]">+{formatHours(reclaimedHours)}</Text>
            </View>
            <Text className="font-label text-[10px] text-white/40 leading-relaxed">
                System analysis indicates a {reductionPercentage}% recovery of cognitive bandwidth within first cycle.
            </Text>
        </View>
      </View>

      {/* Action Section */}
      <View className="w-full mb-4 flex-col pt-8">
          <TouchableOpacity 
              onPress={onNext}
              activeOpacity={0.8}
              className="w-full py-6 bg-white flex-row items-center justify-center rounded-none active:scale-[0.98] transition-transform"
          >
              <Text className="text-black font-headline font-black text-xl tracking-widest uppercase mr-3">
                  CONTINUE
              </Text>
              <MaterialIcons name="arrow-forward" size={24} color="black" />
          </TouchableOpacity>
      </View>
    </View>
  );
};
