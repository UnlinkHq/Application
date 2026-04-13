import React from 'react';
import { View, TouchableOpacity, Text, useWindowDimensions } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelection } from '../../context/SelectionContext';

export const FluidTabBar: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { openSelection } = useSelection();

  // Optimized Layout Widths
  const CONTAINER_PADDING = 24;
  const FAB_SIZE = 56;
  const GAP = 12;
  const BAR_WIDTH = SCREEN_WIDTH - (CONTAINER_PADDING * 2) - FAB_SIZE - GAP;

  return (
    <View 
        style={{ 
            bottom: insets.bottom + 16, 
            width: SCREEN_WIDTH - (CONTAINER_PADDING * 2),
            left: CONTAINER_PADDING,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between'
        }} 
        className="absolute"
    >
        {/* Navigation Pill */}
        <View 
            style={{ width: BAR_WIDTH }}
            className="flex-row items-center bg-[#131313] border border-white/20 p-1 shadow-[0_0_40px_rgba(0,0,0,0.8)] overflow-hidden"
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

                    const label = route.name.toUpperCase();

                    return (
                        <TouchableOpacity
                            key={index}
                            onPress={onPress}
                            activeOpacity={1}
                            className={`flex-1 h-12 flex items-center justify-center ${
                                isFocused ? 'bg-white' : 'bg-transparent'
                            }`}
                        >
                            <MaterialIcons 
                                name={iconName} 
                                size={18} 
                                color={isFocused ? "#000000" : "rgba(255,255,255,0.4)"} 
                            />
                            <Text 
                                className="text-[8px] font-bold tracking-[0.1em] mt-0.5"
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

        {/* Floating Action Button (FAB) - Surgical Style */}
        <TouchableOpacity
            onPress={openSelection}
            activeOpacity={0.9}
            style={{ width: FAB_SIZE, height: FAB_SIZE }}
            className="items-center justify-center bg-[#131313] border border-white/20 rounded-full shadow-2xl"
        >
            <View className="w-8 h-8 rounded-full bg-white items-center justify-center">
                <MaterialIcons name="add" size={24} color="black" />
            </View>
        </TouchableOpacity>
    </View>
  );
};
