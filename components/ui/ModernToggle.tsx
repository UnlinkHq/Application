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
  const translateX = useSharedValue(value ? 20 : 2);

  useEffect(() => {
    translateX.value = withSpring(value ? 20 : 2, {
      damping: 18,
      stiffness: 180,
    });
  }, [value]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const containerStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      translateX.value,
      [2, 20],
      ['#000000', '#FFFFFF'],
      'RGB'
    );
    return { 
      backgroundColor,
      borderColor: 'rgba(255,255,255,0.1)'
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
            thumbStyle,
            { backgroundColor: value ? '#000000' : '#FFFFFF' }
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
    borderWidth: 1,
  },
  thumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
});
