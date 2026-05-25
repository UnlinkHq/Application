import React, { forwardRef } from 'react';
import { TextInput, TextInputProps, View, Text, StyleSheet } from 'react-native';

interface UInputProps extends TextInputProps {
    label?: string;
    error?: string;
}

export const UInput = forwardRef<TextInput, UInputProps>(({ label, error, style, ...props }, ref) => (
    <View style={styles.wrapper}>
        {label && (
            <Text style={styles.label}>{label}</Text>
        )}
        <TextInput
            ref={ref}
            placeholderTextColor="rgba(255,255,255,0.2)"
            autoCorrect={false}
            {...props}
            style={[styles.input, error && styles.inputError, style]}
        />
        {error && <Text style={styles.error}>{error}</Text>}
    </View>
));

UInput.displayName = 'UInput';

const styles = StyleSheet.create({
    wrapper: {
        marginBottom: 0,
    },
    label: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 9,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 2,
        marginBottom: 6,
    },
    input: {
        height: 56,
        backgroundColor: '#000000',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 16,
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '900',
        borderRadius: 0,
    },
    inputError: {
        borderColor: 'rgba(239,68,68,0.6)',
    },
    error: {
        color: '#ef4444',
        fontSize: 9,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginTop: 4,
    },
});
