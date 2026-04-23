import React, { useEffect } from 'react';
import { View, Image, StyleSheet, Dimensions } from 'react-native';
import Animated, { 
    useSharedValue, 
    useAnimatedStyle, 
    withRepeat, 
    withTiming, 
    withSequence,
    Easing,
    FadeIn
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');
const LOGO_SIZE = width * 0.4;

export const PremiumSplash = () => {
    const scale = useSharedValue(1);
    const opacity = useSharedValue(0.8);
    const ringScale = useSharedValue(1);
    const ringOpacity = useSharedValue(0);

    useEffect(() => {
        // Main logo breathing
        scale.value = withRepeat(
            withTiming(1.08, { 
                duration: 2000, 
                easing: Easing.bezier(0.4, 0, 0.2, 1) 
            }),
            -1,
            true
        );

        opacity.value = withRepeat(
            withTiming(1, { 
                duration: 2000, 
                easing: Easing.inOut(Easing.ease) 
            }),
            -1,
            true
        );

        // Circular ripple/glow effect
        ringScale.value = withRepeat(
            withTiming(1.6, { 
                duration: 3000, 
                easing: Easing.out(Easing.ease) 
            }),
            -1,
            false
        );

        ringOpacity.value = withRepeat(
            withSequence(
                withTiming(0.4, { duration: 1500 }),
                withTiming(0, { duration: 1500 })
            ),
            -1,
            false
        );
    }, []);

    const animatedLogoStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    const animatedRingStyle = useAnimatedStyle(() => ({
        transform: [{ scale: ringScale.value }],
        opacity: ringOpacity.value,
    }));

    return (
        <View style={styles.container}>
            <Animated.View entering={FadeIn.duration(800)} style={styles.content}>
                {/* Subtle Ripple/Glow Ring */}
                <Animated.View style={[styles.ring, animatedRingStyle]} />
                
                {/* Main Logo Icon */}
                <Animated.View style={animatedLogoStyle}>
                    <Image 
                        source={require('../../assets/logo_icon.png')} 
                        style={styles.logo}
                        resizeMode="contain"
                    />
                </Animated.View>
            </Animated.View>

            {/* Bottom branding detail */}
            <View style={styles.footer}>
                <View style={styles.line} />
                <View style={styles.dot} />
                <View style={styles.line} />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000', 
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    logo: {
        width: LOGO_SIZE,
        height: LOGO_SIZE,
    },
    ring: {
        position: 'absolute',
        width: LOGO_SIZE,
        height: LOGO_SIZE,
        borderRadius: LOGO_SIZE / 2,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    footer: {
        position: 'absolute',
        bottom: 80,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        opacity: 0.2,
    },
    line: {
        width: 40,
        height: 1,
        backgroundColor: 'white',
    },
    dot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'white',
    }
});
