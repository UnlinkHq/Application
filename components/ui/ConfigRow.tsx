import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

interface ConfigRowProps {
    onPress: () => void;
    icon: string;
    iconLibrary?: 'Ionicons' | 'MaterialCommunityIcons';
    title: string;
    subtitle?: string;
    selectedApps?: { id: string, icon: string }[];
    nativeCount?: number;
    showChevron?: boolean;
}

export const ConfigRow = React.memo(({
    onPress,
    icon,
    iconLibrary = 'MaterialCommunityIcons',
    title,
    subtitle,
    selectedApps = [],
    nativeCount = 0,
    showChevron = true
}: ConfigRowProps) => {
    const IconComponent = iconLibrary === 'Ionicons' ? Ionicons : MaterialCommunityIcons;

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            className="flex-row items-center p-5 border-b border-white/5"
        >
            {/* Visual Anchor */}
            <View className="w-10 h-10 bg-white/5 items-center justify-center border border-white/10 mr-4">
                <IconComponent name={icon as any} size={18} color="white" />
            </View>

            {/* Content Core */}
            <View className="flex-1">
                <Text className="text-white font-headline font-black text-[10px] uppercase tracking-widest">{title}</Text>
                
                <View className="flex-row items-center mt-1">
                    {selectedApps.length > 0 ? (
                        <View className="flex-row items-center">
                            <View className="flex-row mr-2">
                                {selectedApps.slice(0, 3).map((app, i) => (
                                    <Image 
                                        key={app.id} 
                                        source={{ uri: app.icon }} 
                                        className="w-4 h-4 rounded-full border border-black -ml-1.5" 
                                        style={{ zIndex: 10 - i }}
                                    />
                                ))}
                            </View>
                            {selectedApps.length > 3 && (
                                <Text className="text-white/40 font-label text-[8px] font-bold">+{selectedApps.length - 3}</Text>
                            )}
                        </View>
                    ) : (
                        <Text className="text-white/40 font-label text-[9px] uppercase tracking-widest">
                            {subtitle || (nativeCount > 0 ? `${nativeCount} COMMITTED` : 'NONE_DEFINED')}
                        </Text>
                    )}
                </View>
            </View>

            {/* Navigation Indicator */}
            {showChevron && (
                <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.2)" />
            )}
        </TouchableOpacity>
    );
});
