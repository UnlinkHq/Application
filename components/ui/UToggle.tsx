import React, { useEffect } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, interpolateColor } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

interface UToggleProps {
    value: boolean;
    onValueChange: (value: boolean) => void;
    /** Accent color for the on-state. Defaults to white (#FFFFFF). Pass '#FF0000' for YouTube, '#E1306C' for Instagram, '#72fe88' for success, etc. */
    activeColor?: string;
    disabled?: boolean;
}

export const UToggle = ({ value, onValueChange, activeColor = '#FFFFFF', disabled = false }: UToggleProps) => {
    const progress = useSharedValue(value ? 1 : 0);

    useEffect(() => {
        progress.value = withSpring(value ? 1 : 0, { damping: 18, stiffness: 180 });
    }, [value]);

    const isWhite = activeColor === '#FFFFFF';
    const thumbOnColor = isWhite ? '#000000' : '#FFFFFF';

    const containerStyle = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(progress.value, [0, 1], ['#111111', activeColor]),
        borderColor: interpolateColor(progress.value, [0, 1], ['rgba(255,255,255,0.2)', activeColor]),
    }));

    const thumbStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: progress.value * 20 }],
        backgroundColor: interpolateColor(progress.value, [0, 1], ['rgba(255,255,255,0.35)', thumbOnColor]),
    }));

    const handlePress = () => {
        if (disabled) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onValueChange(!value);
    };

    return (
        <TouchableOpacity
            activeOpacity={1}
            onPress={handlePress}
            disabled={disabled}
            style={disabled ? styles.disabled : undefined}
        >
            <Animated.View style={[styles.container, containerStyle]}>
                <Animated.View style={[styles.thumb, thumbStyle]} />
            </Animated.View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        width: 44,
        height: 24,
        borderRadius: 0,
        padding: 2,
        justifyContent: 'center',
        borderWidth: 2,
    },
    thumb: {
        width: 16,
        height: 16,
        borderRadius: 0,
    },
    disabled: {
        opacity: 0.4,
    },
});
