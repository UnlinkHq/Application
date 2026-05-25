import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface USectionHeaderProps {
    title: string;
}

export const USectionHeader = ({ title }: USectionHeaderProps) => (
    <View style={styles.row}>
        <Text style={styles.label}>{title}</Text>
        <View style={styles.line} />
    </View>
);

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
        gap: 10,
    },
    label: {
        color: 'rgba(255,255,255,0.3)',
        fontSize: 9,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 2.5,
    },
    line: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
});
