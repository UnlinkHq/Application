import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, Dimensions, ScrollView, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { getUsageStats } from '../../../modules/screen-time';
import { MaterialIcons } from '@expo/vector-icons';

interface ScreenTimeComparisonStepProps {
  onNext: () => void;
  preFetchedData?: any;
}

export const ScreenTimeComparisonStep: React.FC<ScreenTimeComparisonStepProps> = ({ 
  onNext,
  preFetchedData 
}) => {
  const [loading, setLoading] = useState(!preFetchedData);
  const [totalHours, setTotalHours] = useState(0);
  const [projectionYears, setProjectionYears] = useState(1);
  const [activeIndex, setActiveIndex] = useState(0);
  const { width } = Dimensions.get('window');

  useEffect(() => {
    if (preFetchedData) {
      calculateMetrics(preFetchedData.daily || preFetchedData);
      setLoading(false);
      return;
    }
    fetchData();
  }, [preFetchedData]);

  const calculateMetrics = (dailyStats: Record<string, number>) => {
    const weeklyTotalSeconds = Object.values(dailyStats).reduce((sum: number, val: number) => sum + val, 0) / 1000;
    
    // Daily average
    const dailyHours = (weeklyTotalSeconds / 7) / 3600;
    
    // Fixed at 1 year projection
    const yearsToProject = 1;
    setProjectionYears(yearsToProject);
    
    // Project to the dynamic years
    const projectedHours = Math.round(dailyHours * 365 * yearsToProject);
    setTotalHours(projectedHours);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const now = new Date();
      const end = now.getTime();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).getTime();

      const usageData = await getUsageStats(start, end);
      calculateMetrics(usageData.daily || {});
    } catch (e) {
      console.error("Failed to fetch usage data for comparison", e);
    } finally {
      setLoading(false);
    }
  };

  const comparisons = useMemo(() => [
    {
      title: "READING",
      value: Math.floor(totalHours / 15),
      unit: "BOOKS",
      description: `Estimated at 15 hours per book. A broad exploration of literature and applied psychology.`
    },
    {
      title: "LEARN A LANGUAGE",
      value: Math.floor(totalHours / 480),
      unit: "FLUENCY LEVELS",
      description: `Enough time to reach B1 level proficiency in a new language. You could communicate fluently with millions.`
    },
    {
      title: "SKILL ACQUISITION",
      value: Math.floor(totalHours / 100),
      unit: "MASTERIES",
      description: `Sufficient runway to master high-value competencies like software engineering or design.`
    },
    {
      title: "PHYSICAL TRAINING",
      value: Math.floor(totalHours / 3),
      unit: "SESSIONS",
      description: `Volume equates to nearly daily conditioning, capable of complete physiological transformation.`
    }
  ], [totalHours]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollOffset / width);
    setActiveIndex(index);
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <Text className="text-white/40 text-[10px] font-label uppercase tracking-widest">CALCULATING_DATA_STREAM...</Text>
      </View>
    );
  }

  const projectionTitle = projectionYears === 1 
      ? "One Year of Screen Time" 
      : `${projectionYears} Years of Screen Time`;

  return (
    <View className="flex-1 bg-black justify-center relative overflow-hidden">

      {/* Asymmetric Visual Element (Surgical precision detail) */}
      <View className="absolute left-6 top-1/2 -translate-y-1/2 opacity-20 hidden md:block z-0 pointer-events-none">
          <View className="h-64 w-[1px] bg-white ml-2" />
          <Text className="font-label text-[10px] text-white/40 tracking-widest mt-6 -ml-[40px] w-32 uppercase" style={{ transform: [{ rotate: '90deg' }] }}>
              AXIS TIME METRIC
          </Text>
      </View>

      <View className="items-center w-full z-10 pt-16">
        <Text className="font-label text-[10px] tracking-widest text-white/40 uppercase text-center mb-8">
          {projectionTitle}
        </Text>
        
        <View className="flex-row items-baseline justify-center max-w-lg mb-4">
            <Text className="text-[120px] font-headline font-black leading-none tracking-widest text-white uppercase">
              {totalHours}
            </Text>
            <Text className="text-2xl font-headline font-black tracking-widest text-white ml-2 uppercase">
              HOURS
            </Text>
        </View>

        {/* Fracture/Separator */}
        <View className="w-3/4 max-w-sm h-[1px] bg-[#474747] my-10 opacity-40 mx-auto" />
      </View>

      <View className="w-full h-40 z-10">
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          className="w-full"
        >
          {comparisons.map((item, index) => (
            <View key={index} style={{ width }} className="px-6 items-center justify-start">
              <Text className="font-label text-base md:text-lg tracking-widest text-white font-bold uppercase text-center mb-4">
                {item.title} // <Text className="text-[#ffb4aa]">{item.value} {item.unit}</Text>
              </Text>
              
              <Text className="text-white/40 font-body text-[10px] leading-relaxed text-center max-w-sm px-4">
                {item.description}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Grid Indicators */}
      <View className="flex-row justify-center space-x-4 mb-[140px] w-full z-10">
        {comparisons.map((_, index) => (
          <View
            key={index}
            className={`h-[1px] transition-all duration-300 ${activeIndex === index ? 'bg-white w-8' : 'bg-white/10 w-4'}`}
          />
        ))}
      </View>

      {/* Decorative Corner Detail */}
      <View className="absolute top-24 left-6 pointer-events-none opacity-30 z-0 hidden md:block">
          <View className="font-label text-[10px] space-y-1">
              <Text className="text-white">LAT: 37.7749</Text>
              <Text className="text-white">LONG: -122.4194</Text>
              <Text className="text-[#ffb4aa]">CRITICAL_OVERUSE_DETECTION</Text>
          </View>
      </View>
      
      <View className="absolute top-24 right-6 pointer-events-none opacity-30 z-0 hidden md:block items-end">
          <View className="font-label text-[10px] space-y-1 items-end">
              <Text className="text-white">SYSTEM_ID: OP-094</Text>
              <Text className="text-white">MODE: SURGICAL_INTERVENTION</Text>
              <Text className="text-white">BUFFER: 0.00ms</Text>
          </View>
      </View>

      {/* Continue Button Block */}
      <View className="absolute bottom-0 left-0 w-full p-6 md:p-12 z-50 flex items-center justify-center pt-8">
          <TouchableOpacity 
              onPress={onNext}
              activeOpacity={0.8}
              className="w-full max-w-lg bg-white flex-row items-center justify-center gap-2 px-10 py-6 rounded-none active:scale-[0.98] transition-transform"
          >
              <Text className="text-black font-headline font-black uppercase tracking-widest text-lg">
                  CONTINUE
              </Text>
              <MaterialIcons name="arrow-forward" size={24} color="black" />
          </TouchableOpacity>
      </View>
    </View>
  );
};
