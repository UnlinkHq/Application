import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withDelay, 
  withSequence,
  Easing,
  runOnJS
} from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const CONFETTI_COUNT = 50;
const COLORS = ['#72fe88', '#ffffff', '#919191', '#4ade80', '#22c55e'];

interface ParticleProps {
  index: number;
  onFinish: () => void;
}

const ConfettiParticle = ({ index, onFinish }: ParticleProps) => {
  const x = useSharedValue(SCREEN_WIDTH / 2);
  const y = useSharedValue(SCREEN_HEIGHT / 2);
  const rotation = useSharedValue(0);
  const scale = useSharedValue(0);
  const opacity = useSharedValue(1);

  const color = COLORS[index % COLORS.length];
  const size = Math.random() * 8 + 4;

  useEffect(() => {
    const angle = (Math.PI * 2 * index) / CONFETTI_COUNT + (Math.random() * 0.5 - 0.25);
    const distance = Math.random() * SCREEN_WIDTH * 0.8;
    const targetX = SCREEN_WIDTH / 2 + Math.cos(angle) * distance;
    const targetY = SCREEN_HEIGHT / 2 + Math.sin(angle) * distance + (SCREEN_HEIGHT * 0.3);
    const duration = 1500 + Math.random() * 1000;

    scale.value = withTiming(1, { duration: 200 });
    
    x.value = withTiming(targetX, { 
      duration, 
      easing: Easing.bezier(0.25, 0.1, 0.25, 1) 
    });
    
    y.value = withTiming(targetY, { 
      duration, 
      easing: Easing.bezier(0.25, 0.1, 0.25, 1) 
    });

    rotation.value = withTiming(Math.random() * 720, { duration });
    
    opacity.value = withDelay(duration * 0.7, withTiming(0, { duration: duration * 0.3 }, (finished) => {
      if (finished && index === CONFETTI_COUNT - 1) {
        runOnJS(onFinish)();
      }
    }));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { rotate: `${rotation.value}deg` },
      { scale: scale.value }
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Svg width={size} height={size}>
        <Rect width={size} height={size} fill={color} />
      </Svg>
    </Animated.View>
  );
};

export const ConfettiCelebration = ({ onFinish }: { onFinish: () => void }) => {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {[...Array(CONFETTI_COUNT)].map((_, i) => (
        <ConfettiParticle key={i} index={i} onFinish={onFinish} />
      ))}
    </View>
  );
};
