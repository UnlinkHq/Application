import React from 'react';
import { View, TouchableOpacity, Text, useWindowDimensions } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const FluidTabBar: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Unified Navigation Width (320px)
  const NAV_WIDTH = Math.min(SCREEN_WIDTH - 48, 320);

  return (
    <View 
        style={{ 
            bottom: insets.bottom + 16, 
            width: NAV_WIDTH,
            left: (SCREEN_WIDTH - NAV_WIDTH) / 2
        }} 
        className="absolute flex-row items-center bg-[#131313] border border-white/20 p-1 shadow-[0_0_40px_rgba(0,0,0,0.8)] overflow-hidden"
>
    <View className="flex-row items-center h-full w-full divide-x divide-white/10">
        {state.routes.map((route, index) => {
            const isFocused = state.index === index;

            const onPress = () => {
                const event = navigation.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                });

                if (!isFocused && !event.defaultPrevented) {
                    navigation.navigate(route.name);
                }
            };

            let iconName: keyof typeof MaterialIcons.glyphMap = 'help-outline';
            if (route.name === 'Today') iconName = 'query-stats';
            else if (route.name === 'Blocks') iconName = 'security';
            else if (route.name === 'Socials') iconName = 'people';
            else if (route.name === 'Settings') iconName = 'settings';

            // Custom Display Labels
            const label = route.name.toUpperCase();

            return (
                <TouchableOpacity
                    key={index}
                    onPress={onPress}
                    activeOpacity={1}
                    className={`flex-1 h-14 flex items-center justify-center ${
                        isFocused ? 'bg-white' : 'bg-transparent'
                    }`}
                >
                    <MaterialIcons 
                        name={iconName} 
                        size={20} 
                        color={isFocused ? "#000000" : "rgba(255,255,255,0.4)"} 
                    />
                    <Text 
                        className="text-[9px] font-bold tracking-[0.1em] mt-1"
                        style={{ 
                            color: isFocused ? "#000000" : "rgba(255,255,255,0.4)" 
                        }}
                    >
                        {label}
                    </Text>
                </TouchableOpacity>
            );
        })}
    </View>
</View>
  );
};
