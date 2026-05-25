import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

type BadgeVariant = 'default' | 'success' | 'info' | 'premium' | 'beta' | 'soon' | 'danger';

interface UBadgeProps {
    label: string;
    variant?: BadgeVariant;
}

export const UBadge = ({ label, variant = 'default' }: UBadgeProps) => (
    <View style={[styles.base, containerStyles[variant]]}>
        <Text style={[styles.text, textStyles[variant]]}>{label}</Text>
    </View>
);

const styles = StyleSheet.create({
    base: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderWidth: 1,
        borderRadius: 0,
        alignSelf: 'flex-start',
    },
    text: {
        fontSize: 7,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 1.5,
    },
});

const containerStyles = StyleSheet.create({
    default: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' },
    success: { backgroundColor: 'rgba(114,254,136,0.08)', borderColor: 'rgba(114,254,136,0.25)' },
    info: { backgroundColor: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.2)' },
    premium: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)' },
    beta: { backgroundColor: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.2)' },
    soon: { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' },
    danger: { backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)' },
});

const textStyles = StyleSheet.create({
    default: { color: 'rgba(255,255,255,0.3)' },
    success: { color: '#72fe88' },
    info: { color: '#3b82f6' },
    premium: { color: 'rgba(255,255,255,0.8)' },
    beta: { color: '#3b82f6' },
    soon: { color: 'rgba(255,255,255,0.2)' },
    danger: { color: '#ef4444' },
});
