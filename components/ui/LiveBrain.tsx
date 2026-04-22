import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Platform, Image } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withRepeat, 
  withSequence,
  Easing,
  interpolate,
  useDerivedValue,
  withSpring
} from 'react-native-reanimated';

// 7 Progressive Decay Stages
const STAGES = [
  require('../../assets/mascots/stage_1.png'), // Cool/Sigma
  require('../../assets/mascots/stage_2.png'), // Happy
  require('../../assets/mascots/stage_3.png'), // Numb
  require('../../assets/mascots/stage_4.png'), // Tired
  require('../../assets/mascots/stage_5.png'), // Sick
  require('../../assets/mascots/stage_6.png'), // Rotting
  require('../../assets/mascots/stage_7.png'), // Dead
];

interface LiveBrainProps {
  score: number;
  size?: number;
  subtle?: boolean;
}

const STAGE_RANGE = 100 / (STAGES.length - 1); // ~16.6 per stage

export const LiveBrain: React.FC<LiveBrainProps> = ({ score, size = 60, subtle = false }) => {
  // PHYSICS_VALUES
  const breathing = useSharedValue(0);
  const floating = useSharedValue(0);
  const jitter = useSharedValue(0);
  const reaction = useSharedValue(1);

  // Derived Values for Stages
  // We use the score to determine which images are visible
  const scoreValue = useDerivedValue(() => {
    return withTiming(score, { duration: 500 });
  });

  // PHYSICS_ENGINE: BREATHING & FLOATING
  useEffect(() => {
    // 1. Breathing (Speeds up as rot increases, range reduced if subtle)
    const breathDuration = score > 80 ? 1200 : (score > 50 ? 1800 : 2500);
    const targetBreathe = subtle ? 1.02 : 1.05;
    breathing.value = withRepeat(
      withTiming(1, { duration: breathDuration, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );

    // 2. Floating
    floating.value = withRepeat(
      withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );

    // 3. Jitter (Only for high rot)
    if (score > 80) {
      jitter.value = withRepeat(
        withSequence(
            withTiming(2, { duration: 50 }),
            withTiming(-2, { duration: 50 })
        ),
        -1,
        true
      );
    } else {
      jitter.value = withTiming(0);
    }
  }, [score]);

  // 4. Reaction Pulse (Only if NOT subtle)
  useEffect(() => {
    if (subtle) return;
    
    reaction.value = withSequence(
      withSpring(1.2, { damping: 10, stiffness: 100 }),
      withSpring(1, { damping: 10, stiffness: 100 })
    );
  }, [score, subtle]);

  const mascotContainerStyle = useAnimatedStyle(() => {
    const scale = interpolate(breathing.value, [0, 1], [1, subtle ? 1.02 : 1.05]) * reaction.value;
    const translateY = interpolate(floating.value, [0, 1], [subtle ? -1 : -4, subtle ? 1 : 4]);
    const translateX = jitter.value;

    return {
      transform: [{ scale }, { translateY }, { translateX }],
    };
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {STAGES.map((source, index) => {
        const opacityStyle = useAnimatedStyle(() => {
            // CROSS-FADE LOGIC
            // Each stage has a peak at (index * STAGE_RANGE)
            const peak = index * STAGE_RANGE;
            const opacity = interpolate(
                scoreValue.value,
                [peak - STAGE_RANGE, peak, peak + STAGE_RANGE],
                [0, 1, 0],
                'clamp'
            );
            return { opacity };
        });

        return (
          <Animated.Image
            key={index}
            source={source}
            style={[styles.image, mascotContainerStyle, opacityStyle, StyleSheet.absoluteFill]}
            resizeMode="contain"
          />
        );
      })}
      
      {/* Dynamic Glow */}
      <View 
        style={[
          styles.glow, 
          { 
            backgroundColor: score < 30 ? '#72fe88' : (score < 70 ? '#fbbf24' : '#ef4444'),
            opacity: 0.1 + (score / 300)
          }
        ]} 
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  glow: {
    position: 'absolute',
    width: '90%',
    height: '90%',
    borderRadius: 100,
    zIndex: -1,
  }
});
