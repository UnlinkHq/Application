import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { getUsageStats } from '../../../modules/screen-time';
import { formatDuration } from '../../../utils/screenTimeData';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

interface ScreenTimeReportStepProps {
  onNext: () => void;
  screenTimeGoal: number; // in hours
  preFetchedData?: { day: string, duration: number }[];
}

export const ScreenTimeReportStep: React.FC<ScreenTimeReportStepProps> = ({ 
  onNext, 
  screenTimeGoal,
  preFetchedData 
}) => {
  const [loading, setLoading] = useState(!preFetchedData);
  const [weekData, setWeekData] = useState<{ day: string, duration: number }[]>(preFetchedData || []);
  const [viewMode, setViewMode] = useState<'Day' | 'Week'>('Week');
  const { width } = Dimensions.get('window');

  // Day labels for the last 7 days (including today)
  const getDays = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      result.push({
        label: days[date.getDay()],
        startOfDay: new Date(date.setHours(0, 0, 0, 0)).getTime(),
        endOfDay: new Date(date.setHours(23, 59, 59, 999)).getTime()
      });
    }
    return result;
  }, []);

  useEffect(() => {
    if (preFetchedData && preFetchedData.length > 0) {
      setWeekData(preFetchedData);
      setLoading(false);
      return;
    }
    fetchData();
  }, [preFetchedData]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const dailyPromises = getDays.map(async (day) => {
        const stats = await getUsageStats(day.startOfDay, day.endOfDay);
        const totalDuration = Object.values(stats.daily || {}).reduce((sum, val) => (sum as number) + (val as number), 0);
        return {
          day: day.label,
          duration: (totalDuration as number) / 1000
        };
      });

      const results = await Promise.all(dailyPromises);
      setWeekData(results);
    } catch (e) {
      console.error("Failed to fetch screen time data", e);
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

  const todayData = weekData[weekData.length - 1];
  const todaySeconds = todayData ? todayData.duration : 0;
  
  const totalSeconds = weekData.reduce((sum, d) => sum + d.duration, 0);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const headerValue = viewMode === 'Week' ? `${hours}h ${minutes}m` : formatDuration(todaySeconds);
  const headerSubLabel = viewMode === 'Week' ? 'Total for the last 7 days' : 'Today\'s screen time';

  const maxDuration = weekData.length > 0 ? Math.max(...weekData.map(d => d.duration)) : 10;
  const recommendedLimit = screenTimeGoal * 3600;

  // Calculate highest chart point for grid lines
  const chartMaxSeconds = Math.max(maxDuration, recommendedLimit, 36000); // at least 10h

  return (
    <View className="flex-1 bg-black pt-16 px-6 relative">
      <View className="flex-1 mb-32">
        {/* Header Section */}
        <View className="mb-8">
            <View className="flex-row items-baseline space-x-2 mb-2">
                <Text className="text-[10px] font-headline font-black uppercase tracking-[0.3em] text-white/40">ANALYTICS // STAGE 04</Text>
            </View>
            <Text className="text-3xl font-headline font-black tracking-widest uppercase mb-2 text-white">YOUR ACTUAL{'\n'}SCREEN TIME</Text>
            <Text className="text-white/20 font-label text-[10px] uppercase tracking-widest">{headerSubLabel}</Text>
        </View>

        {/* Main Display Data */}
        <View className="mb-10 flex-col items-start z-10">
            <View className="flex-row items-baseline">
                <Text className="text-7xl font-headline font-black tracking-widest text-white uppercase">{headerValue}</Text>
            </View>
            
            {/* Warning Badge - Sophisticated Warning */}
            {todaySeconds > recommendedLimit && (
              <View className="mt-6 flex-row items-center border border-[#ffb4aa]/20 bg-[#ffb4aa]/5 px-4 py-2">
                  <MaterialIcons name="warning" size={14} color="#ffb4aa" />
                  <Text className="font-headline font-black text-[10px] uppercase tracking-[0.2em] text-[#ffb4aa] ml-3">LATENCY DETECTED</Text>
              </View>
            )}
        </View>

        {/* View Toggle - Modular Segmented Control */}
        <View className="mb-10 w-full z-20">
            <View className="flex-row border border-white/10 p-1 bg-white/5">
                <TouchableOpacity
                  onPress={() => setViewMode('Day')}
                  className={`flex-1 py-4 items-center justify-center ${viewMode === 'Day' ? 'bg-white' : ''}`}
                >
                  <Text className={`text-[10px] font-headline font-black uppercase tracking-widest ${viewMode === 'Day' ? 'text-black' : 'text-white/40'}`}>DAY_VIEW</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setViewMode('Week')}
                  className={`flex-1 py-4 items-center justify-center ${viewMode === 'Week' ? 'bg-white' : ''}`}
                >
                  <Text className={`text-[10px] font-headline font-black uppercase tracking-widest ${viewMode === 'Week' ? 'text-black' : 'text-white/40'}`}>WEEK_VIEW</Text>
                </TouchableOpacity>
            </View>
        </View>

        {/* Minimalism Instrument Chart */}
        <View className="flex-1 flex-col mt-4 w-full">
            <View className="flex-1 w-full flex-row items-end justify-between relative pb-[30px]">
                {/* Chart Background Indicators */}
                <View className="absolute inset-0 flex-col justify-between pointer-events-none pb-[30px]">
                    <View className="border-t border-white/5 w-full absolute top-0" />
                    <Text className="absolute top-0 right-0 text-[8px] font-label text-white/20 -translate-y-[12px] bg-black px-1 uppercase">{Math.ceil(chartMaxSeconds/3600)}H</Text>

                    <View className="border-t border-[#ffb4aa]/40 w-full absolute border-dashed" style={{ top: `${(1 - (recommendedLimit / chartMaxSeconds)) * 100}%` }} />
                    <Text className="absolute right-0 bg-black px-1 text-[9px] font-headline font-black text-[#ffb4aa] tracking-widest -translate-y-[12px] uppercase" style={{ top: `${(1 - (recommendedLimit / chartMaxSeconds)) * 100}%` }}>GOAL {screenTimeGoal}H</Text>

                    <View className="border-t border-white/5 w-full absolute bottom-[30px]" />
                </View>

                {/* Chart Bars */}
                <View className="flex-1 h-full flex-row items-end justify-between z-10 w-full px-2">
                    {weekData.map((d, index) => {
                      const isExcessive = d.duration > recommendedLimit;
                      const heightPercent = Math.max(2, (d.duration / chartMaxSeconds) * 100);
                      const isToday = index === weekData.length - 1;
                      const isActiveBar = viewMode === 'Week' || isToday;
                      const barColor = !isActiveBar ? 'bg-white/5' : (isExcessive ? 'bg-[#ffb4aa]' : 'bg-white');
                      const textColor = !isActiveBar ? 'text-white/10' : (isExcessive ? 'text-[#ffb4aa]' : 'text-white/60');

                      return (
                        <View key={index} className="flex-col items-center w-8 h-full justify-end">
                            <View className={`w-1.5 rounded-full ${barColor}`} style={{ height: `${heightPercent}%` }} />
                            <Text className={`mt-4 text-[10px] font-headline font-black ${textColor}`}>
                                {d.day[0]}
                            </Text>
                        </View>
                      );
                    })}
                </View>
            </View>
        </View>
      </View>

      {/* Fixed Action Button - Premium Footer */}
      <View className="absolute bottom-8 left-6 right-6 z-50 pt-4">
          <TouchableOpacity 
              onPress={onNext}
              activeOpacity={0.9}
              className="w-full bg-white flex-row items-center justify-center py-6 active:scale-[0.98]"
          >
              <Text className="text-black font-headline font-black tracking-[0.2em] uppercase text-lg">
                  CONTINUE
              </Text>
              <MaterialIcons name="arrow-forward" size={20} color="black" style={{ marginLeft: 8 }} />
          </TouchableOpacity>
      </View>
    </View>
  );
};
