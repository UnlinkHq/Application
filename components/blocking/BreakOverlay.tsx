import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, Dimensions, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
  useDerivedValue,
} from 'react-native-reanimated';
import { useBlocking } from '../../context/BlockingContext';

const { width, height } = Dimensions.get('window');
const CIRCLE_LENGTH = 1000; // 2 * PI * R
const R = CIRCLE_LENGTH / (2 * Math.PI);

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const BreakOverlay = () => {
  const { isBlocked, timeLeft, breakLimit, skipBreak, isStrict } = useBlocking();

  // Animation value (0 to 1)
  const progress = useSharedValue(0);

  useEffect(() => {
    if (isBlocked) {
      progress.value = withTiming(1, {
        duration: breakLimit * 1000,
        easing: Easing.linear,
      });
    } else {
      progress.value = 0;
    }
  }, [isBlocked, breakLimit]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCLE_LENGTH * (1 - progress.value),
  }));

  if (!isBlocked) return null;

  return (
    <View style={[StyleSheet.absoluteFill, styles.container]}>
      {/* Background Blur Effect (Simulated with semi-transparent view) */}
      <View style={styles.background} />

      <View style={styles.content}>
        <Text style={styles.title}>Take a Break</Text>
        <Text style={styles.subtitle}>Breathe active.</Text>

        <View style={styles.circleContainer}>
          <Svg
            width={width * 0.8}
            height={width * 0.8}
            style={{ transform: [{ rotate: '-90deg' }] }}
          >
            <Circle
              cx={width * 0.4}
              cy={width * 0.4}
              r={R}
              stroke="#E2E2E2"
              strokeWidth="15"
              fill="transparent"
            />

            <AnimatedCircle
              cx={width * 0.4}
              cy={width * 0.4}
              r={R}
              stroke="#000"
              strokeWidth="15"
              fill="transparent"
              strokeDasharray={`${CIRCLE_LENGTH} ${CIRCLE_LENGTH}`}
              animatedProps={animatedProps}
              strokeLinecap="round"
            />
          </Svg>
          <View style={styles.timerContainer}>
            <Text style={styles.timerText}>{Math.max(0, timeLeft)}s</Text>
          </View>
        </View>

        {!isStrict && (
          <TouchableOpacity onPress={skipBreak} style={styles.unlockButton}>
            <Text style={styles.unlockText}>Emergency Unlock</Text>
          </TouchableOpacity>
        )}

        {isStrict && (
          <View style={styles.strictContainer}>
            <Text style={styles.strictText}>Strict Mode Active</Text>
            <Text style={styles.strictSubText}>No escape until timer ends.</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    zIndex: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 5, 5, 0.96)', // Deep black, slightly transparent
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#a1a1aa', // zinc-400
    marginBottom: 40,
    textAlign: 'center',
  },
  circleContainer: {
    width: width * 0.8,
    height: width * 0.8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 50,
  },
  timerContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerText: {
    fontSize: 64,
    fontWeight: '200',
    color: '#fff',
    fontVariant: ['tabular-nums'],
  },
  unlockButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  unlockText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  strictContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(220, 38, 38, 0.1)', // Red tint
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.3)',
  },
  strictText: {
    color: '#ef4444', // Red-500
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 4,
  },
  strictSubText: {
    color: '#fca5a5', // Red-300
    fontSize: 14,
  },
});
