import React, { memo } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { AppUsage, formatDuration } from '../../utils/screenTimeData';

interface AppListItemProps {
  app: AppUsage;
  isSelected: boolean;
  onPress: (appId: string) => void;
  overrideColor?: string;
}

const AppListItem = memo(({ app, isSelected, onPress, overrideColor }: AppListItemProps) => {
  const isHighUsage = app.duration > 1800; // > 30 mins
  const accentColor = isHighUsage ? "#ffb4aa" : (overrideColor || "#ffffff");
  const progressPercent = Math.min(100, (app.duration / 3600) * 100);

  return (
    <TouchableOpacity 
      onPress={() => onPress(app.id)}
      activeOpacity={0.7}
      className={`mb-10 group ${isSelected ? 'opacity-100' : 'opacity-90'}`}
    >
      <View className="flex-row justify-between items-end mb-3">
        <View className="flex-row items-center gap-4">
          <View className="w-10 h-10 bg-[#252525] flex items-center justify-center border border-white/10">
             {app.icon && app.icon.startsWith('data:') ? (
                <Image 
                    source={{ uri: app.icon }} 
                    style={{ width: '100%', height: '100%' }} 
                    resizeMode="cover"
                />
            ) : (
                <MaterialIcons name="apps" size={20} color={accentColor} />
            )}
          </View>
          
          <View>
            <Text className={`font-headline font-bold text-base tracking-tight ${isHighUsage ? 'text-[#ffb4aa]' : 'text-white'}`}>
                {app.name}
            </Text>
            <View className="flex-row items-center gap-2">
                <Text className={`font-label text-[10px] uppercase tracking-widest ${isHighUsage ? 'text-[#ffb4aa]/60' : 'text-zinc-500'}`}>
                    {app.category}
                </Text>
                <Text className="font-label text-[10px] text-zinc-600">•</Text>
                <Text className="font-label text-[10px] uppercase text-zinc-500">
                    {app.pickups} Pickups
                </Text>
            </View>
          </View>
        </View>

        <Text className={`font-label font-bold text-base ${isHighUsage ? 'text-[#ffb4aa]' : 'text-white'}`}>
            {formatDuration(app.duration)}
        </Text>
      </View>

      {/* Thicker 4px Progress Track */}
      <View className="w-full h-1 bg-white/5 relative">
        <View 
            className="absolute top-0 left-0 h-full"
            style={{ 
                width: `${progressPercent}%`,
                backgroundColor: accentColor
            }} 
        />
      </View>
    </TouchableOpacity>
  );
});

AppListItem.displayName = 'AppListItem';

interface AppUsageListProps {
  apps: AppUsage[];
  selectedAppId: string | null;
  onAppPress: (appId: string) => void;
  overrideColor?: string;
  isHourlyView?: boolean;
}

export const AppUsageList = memo(({ apps, selectedAppId, onAppPress, overrideColor, isHourlyView }: AppUsageListProps) => {
  const activeApps = apps.filter(app => app.duration >= 60);

  return (
    <View className="mt-8">
      <Text className="font-label text-xs uppercase tracking-[0.2em] text-[#919191] mb-8">
        {isHourlyView ? 'Hourly Intensity' : 'Most Used Apps'}
      </Text>
      
      <View className="space-y-4">
        {activeApps.map((app, index) => (
            <AppListItem 
                key={`${app.id}-${index}`}
                app={app}
                isSelected={selectedAppId === app.id}
                onPress={onAppPress}
                overrideColor={overrideColor}
            />
        ))}
      </View>

      {activeApps.length === 0 && (
        <Text className="text-[#919191] font-label text-center py-10 uppercase text-[10px] tracking-widest border border-white/5">
            No active usage detected
        </Text>
      )}
    </View>
  );
});

AppUsageList.displayName = 'AppUsageList';
