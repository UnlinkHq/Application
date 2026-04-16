import React, { useEffect } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  interpolateColor 
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

interface ModernToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
}

export const ModernToggle = ({ 
  value, 
  onValueChange
}: ModernToggleProps) => {
  const translateX = useSharedValue(value ? 20 : 0);

  useEffect(() => {
    translateX.value = withSpring(value ? 20 : 0, {
      damping: 18,
      stiffness: 180,
    });
  }, [value]);

  const thumbStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
      backgroundColor: interpolateColor(
        translateX.value,
        [0, 20],
        ['#8E8E93', '#FFFFFF']
      )
    };
  });

  const containerStyle = useAnimatedStyle(() => {
    return { 
      backgroundColor: '#2A2A2D',
      borderColor: interpolateColor(
        translateX.value,
        [0, 20],
        ['#4A4A4D', '#FFFFFF']
      )
    };
  });

  const handlePress = () => {
    const newValue = !value;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onValueChange(newValue);
  };

  return (
    <TouchableOpacity 
      activeOpacity={1} 
      onPress={handlePress}
    >
      <Animated.View style={[styles.container, containerStyle]}>
        <Animated.View 
          style={[
            styles.thumb, 
            thumbStyle
          ]} 
        />
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: 'center',
    borderWidth: 2,
  },
  thumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
});
