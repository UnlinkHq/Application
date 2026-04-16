import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Dimensions, ScrollView } from 'react-native';
import { getUsageStats, getInstalledApps } from '../../../modules/screen-time';
import { formatDuration } from '../../../utils/screenTimeData';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface AppUsageStepProps {
  onNext: () => void;
  preFetchedData?: any; 
  preFetchedApps?: any[]; 
}

interface AppStats {
  packageName: string;
  label: string;
  icon: string | null;
  duration: number; // in seconds
}

export const AppUsageStep: React.FC<AppUsageStepProps> = ({ 
  onNext,
  preFetchedData,
  preFetchedApps
}) => {
  const [loading, setLoading] = useState(!(preFetchedData && preFetchedApps));
  const [topApps, setTopApps] = useState<AppStats[]>([]);
  const [totalDailySeconds, setTotalDailySeconds] = useState(0);
  const { width } = Dimensions.get('window');

  useEffect(() => {
    if (preFetchedData && preFetchedApps) {
      processData(preFetchedData.daily || preFetchedData, preFetchedApps);
      setLoading(false);
      return;
    }
    fetchData();
  }, [preFetchedData, preFetchedApps]);

  const processData = (dailyStats: any, allApps: any[]) => {
    const appMap = new Map<string, { label: string, icon: string }>();
    allApps.forEach(app => {
      appMap.set(app.packageName, { label: app.label, icon: app.icon });
    });

    let totalDuration = 0;
    const processedApps: AppStats[] = Object.entries(dailyStats)
      .map(([pkg, duration]) => {
        const appInfo = appMap.get(pkg);
        const durSecs = (duration as number) / 1000;
        totalDuration += durSecs;
        return {
          packageName: pkg,
          label: appInfo?.label || pkg.split('.').pop() || 'Unknown',
          icon: appInfo?.icon || null,
          duration: durSecs
        };
      })
      .filter(app => app.duration > 60)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5);

    setTotalDailySeconds(totalDuration);
    setTopApps(processedApps);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const now = new Date();
      const end = now.getTime();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime(); // just last 24h

      const [usageData, installedApps] = await Promise.all([
        getUsageStats(start, end),
        getInstalledApps()
      ]);

      processData(usageData.daily || {}, installedApps);
    } catch (e) {
      console.error("Failed to fetch app usage data", e);
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

  const maxDuration = topApps.length > 0 ? topApps[0].duration : 1;
  const totalHours = Math.round(totalDailySeconds / 3600);
  const reclaimedHours = Math.max(0, (totalHours - 2)).toFixed(1);

  return (
    <View className="flex-1 bg-black relative">
      <LinearGradient 
        colors={['#250505', '#000000']} 
        locations={[0, 0.4]}
        className="absolute inset-0"
      />

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 pt-8 pb-12 px-8 flex-col max-w-2xl mx-auto w-full">
        {/* Headline Section */}
        <View className="mb-12">
            <Text className="font-label text-[10px] tracking-widest text-white/40 mb-2 uppercase">ANALYSIS COMPLETE</Text>
            <Text className="text-5xl font-black leading-none tracking-widest text-white mb-6 font-headline uppercase">
                WHERE YOUR{'\n'}TIME GOES
            </Text>
            <View className="h-[1px] w-full bg-[#474747] opacity-40 relative">
                {/* Fracture detail mock */}
                <View className="absolute right-0 top-[-4px] w-2 h-2 border-l border-[#474747] transform rotate-45" />
            </View>
        </View>

        {/* Usage List (Surgical Precision) */}
        <View className="space-y-10 flex-col mb-12 flex-grow">
          {topApps.map((app, index) => {
            const progress = app.duration / maxDuration;
            
            let severityText = "Optimal Range";
            let severityColor = "text-[#474747]";
            let barColor = "bg-[#2a2a2a]";
            let categoryText = "Utility";

            if (index === 0) {
              severityText = "EXTREME_USAGE";
              severityColor = "text-[#ffb4aa]";
              barColor = "bg-[#ffb4aa]";
              categoryText = "PRIMARY_DRAIN";
            } else if (index === 1) {
              severityText = "HIGH_USAGE";
              severityColor = "text-white";
              barColor = "bg-white";
              categoryText = "SECONDARY_DRAIN";
            } else {
              categoryText = "APPLICATION";
            }

            return (
              <View key={app.packageName} className="w-full flex-col group mb-8">
                <View className="flex-row justify-between items-end mb-3">
                  <View className="flex-col">
                      <Text className="font-label text-[10px] text-white/40 uppercase tracking-widest mb-1">{categoryText}</Text>
                      <Text className="text-xl font-headline font-black tracking-widest text-white uppercase">{app.label}</Text>
                  </View>
                  
                  <View className="items-end">
                      <Text className="text-3xl font-black font-headline text-white" style={{ fontVariant: ['tabular-nums'] }}>
                          {formatDuration(app.duration)}
                      </Text>
                      <Text className={`font-label text-[10px] uppercase tracking-widest ${severityColor}`}>
                          {severityText}
                      </Text>
                  </View>
                </View>

                {/* Progress Bar: Liquid Level Aesthetic */}
                <View className="h-4 w-full bg-[#0e0e0e] border border-white/10 relative overflow-hidden">
                    <View
                       className={`absolute top-0 left-0 h-full ${barColor}`}
                       style={{
                         width: `${progress * 100}%`,
                         shadowColor: index === 0 ? '#ffb4aa' : 'transparent',
                         shadowOffset: { width: 0, height: 0 },
                         shadowOpacity: index === 0 ? 0.3 : 0,
                         shadowRadius: 15
                       }} 
                    />
                </View>
              </View>
            );
          })}
        </View>

        {/* Summary Tonal Layer */}
        <View className="mb-[150px] bg-[#0e0e0e] border border-white/10 p-6 flex-row items-center space-x-6">
            <View className="w-16 mr-3 h-16 border border-white flex justify-center items-center">
                <MaterialIcons name="broken-image" size={32} color="white" />
            </View>
            <View className="flex-1">
                <Text className="text-white/40 font-body text-[10px] leading-relaxed">
                    You are currently spending <Text className="font-headline font-black text-white">{totalHours} hours</Text> daily behind the glass.
                    Unlink will reclaim <Text className="font-headline font-black text-[#72fe88]">{reclaimedHours} hours</Text> for your physical reality.
                </Text>
            </View>
        </View>
      </ScrollView>

      {/* Footer / Action Area */}
      <View className="absolute bottom-6 left-6 right-6 z-50 pt-4">
          <TouchableOpacity 
              onPress={onNext}
              activeOpacity={0.8}
              className="w-full bg-white flex-row items-center justify-center py-6 border border-white active:scale-[0.98] transition-transform shadow-2xl rounded-none relative"
          >
              <Text className="text-black font-headline font-black text-2xl tracking-widest relative mr-2">
                  CONTINUE
              </Text>
              <MaterialIcons name="arrow-forward" size={24} color="black" />
          </TouchableOpacity>
      </View>
    </View>
  );
};
