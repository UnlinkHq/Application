import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet, ActivityIndicator } from 'react-native';
import * as Haptics from 'expo-haptics';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface UButtonProps {
    label: string;
    onPress: () => void;
    variant?: Variant;
    size?: Size;
    disabled?: boolean;
    loading?: boolean;
    leftIcon?: React.ReactNode;
    fullWidth?: boolean;
}

const HEIGHT: Record<Size, number> = { sm: 40, md: 48, lg: 64 };
const FONT_SIZE: Record<Size, number> = { sm: 9, md: 10, lg: 10 };
const LETTER_SPACING: Record<Size, number> = { sm: 1.5, md: 2, lg: 2.5 };

export const UButton = ({
    label,
    onPress,
    variant = 'primary',
    size = 'lg',
    disabled = false,
    loading = false,
    leftIcon,
    fullWidth = true,
}: UButtonProps) => {
    const isDisabled = disabled || loading;

    const containerStyle = [
        styles.base,
        { height: HEIGHT[size] },
        fullWidth && styles.fullWidth,
        variantContainer[variant],
        isDisabled && disabledContainer[variant],
    ];

    const textStyle = [
        styles.label,
        { fontSize: FONT_SIZE[size], letterSpacing: LETTER_SPACING[size] },
        variantText[variant],
        isDisabled && disabledText[variant],
    ];

    const handlePress = () => {
        if (isDisabled) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
    };

    return (
        <TouchableOpacity
            onPress={handlePress}
            disabled={isDisabled}
            activeOpacity={0.85}
            style={containerStyle}
        >
            {loading ? (
                <ActivityIndicator size="small" color={variant === 'primary' ? '#000' : '#fff'} />
            ) : (
                <View style={styles.inner}>
                    {leftIcon && <View style={styles.iconWrap}>{leftIcon}</View>}
                    <Text style={textStyle}>{label}</Text>
                </View>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    base: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    fullWidth: {
        width: '100%',
    },
    inner: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconWrap: {
        marginRight: 8,
    },
    label: {
        fontFamily: 'System',
        fontWeight: '900',
        textTransform: 'uppercase',
    },
});

const variantContainer = StyleSheet.create({
    primary: { backgroundColor: '#FFFFFF' },
    secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
    ghost: { backgroundColor: 'transparent' },
    danger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(239,68,68,0.5)' },
});

const disabledContainer = StyleSheet.create({
    primary: { backgroundColor: 'rgba(255,255,255,0.1)' },
    secondary: { borderColor: 'rgba(255,255,255,0.08)' },
    ghost: {},
    danger: { borderColor: 'rgba(239,68,68,0.2)' },
});

const variantText = StyleSheet.create({
    primary: { color: '#000000' },
    secondary: { color: '#FFFFFF' },
    ghost: { color: 'rgba(255,255,255,0.5)' },
    danger: { color: '#ef4444' },
});

const disabledText = StyleSheet.create({
    primary: { color: 'rgba(255,255,255,0.2)' },
    secondary: { color: 'rgba(255,255,255,0.2)' },
    ghost: { color: 'rgba(255,255,255,0.2)' },
    danger: { color: 'rgba(239,68,68,0.3)' },
});
