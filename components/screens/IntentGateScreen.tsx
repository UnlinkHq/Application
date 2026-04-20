import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export const IntentGateScreen = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { appName = 'this app' } = route.params || {};

    const [countdown, setCountdown] = useState(3);
    const [showActions, setShowActions] = useState(false);

    const fadeAnim = useState(new Animated.Value(0))[0];
    const scaleAnim = useState(new Animated.Value(0.95))[0];

    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        } else {
            setShowActions(true);
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 500,
                    useNativeDriver: true,
                }),
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    friction: 8,
                    useNativeDriver: true,
                })
            ]).start();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
    }, [countdown]);

    const handleAction = (type: 'DM' | 'COMMUNITY' | 'CANCEL') => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (type === 'CANCEL') {
            // Ideally should close app, but for now just go back or home
            navigation.navigate('Home');
        } else {
            // Logic to authorize app and navigate back to it
            // On iOS this would involve updating the Shield state
            navigation.goBack();
        }
    };

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.protocolText}>INTENT_GATE_V2</Text>
                </View>

                {/* Main Question */}
                <View style={styles.questionContainer}>
                    <Text style={styles.greeting}>Hey there, quick breath.</Text>
                    <Text style={styles.question}>
                        Why are you opening{'\n'}
                        <Text style={styles.appName}>{appName}</Text> today?
                    </Text>
                </View>

                {/* Calm / Countdown Section */}
                {!showActions ? (
                    <View style={styles.calmSection}>
                        <Text style={styles.timer}>{countdown}</Text>
                        <Text style={styles.statusText}>FOCUSING_SYSTEM...</Text>
                    </View>
                ) : (
                    <Animated.View
                        style={[
                            styles.actionSection,
                            { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
                        ]}
                    >
                        <TouchableOpacity
                            style={styles.primaryButton}
                            onPress={() => handleAction('DM')}
                            activeOpacity={0.8}
                        >
                            <MaterialCommunityIcons name="message-text" size={20} color="black" />
                            <Text style={styles.primaryButtonText}>DM CONNECT ONLY</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.secondaryButton}
                            onPress={() => handleAction('COMMUNITY')}
                            activeOpacity={0.8}
                        >
                            <MaterialCommunityIcons name="account-group" size={20} color="white" />
                            <Text style={styles.secondaryButtonText}>COMMUNITY STATUS</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={() => handleAction('CANCEL')}
                        >
                            <Text style={styles.cancelButtonText}>Actually, nevermind.</Text>
                        </TouchableOpacity>
                    </Animated.View>
                )}
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    content: {
        flex: 1,
        padding: 32,
    },
    header: {
        marginTop: 40,
        alignItems: 'center',
    },
    protocolText: {
        color: 'rgba(255, 255, 255, 0.2)',
        fontFamily: 'Inter_900Black',
        fontSize: 10,
        letterSpacing: 4,
    },
    questionContainer: {
        marginTop: 40,
        alignItems: 'center',
    },
    greeting: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 16,
        fontFamily: 'SpaceGrotesk_300Light',
        marginBottom: 8,
    },
    question: {
        color: '#FFF',
        fontSize: 28,
        textAlign: 'center',
        fontFamily: 'Inter_900Black',
        lineHeight: 34,
    },
    appName: {
        color: '#FFF',
    },
    calmSection: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    timer: {
        color: '#FFF',
        fontSize: 80,
        fontFamily: 'Inter_900Black',
    },
    statusText: {
        color: 'rgba(255, 255, 255, 0.3)',
        fontSize: 10,
        letterSpacing: 2,
        marginTop: -10,
    },
    actionSection: {
        flex: 1,
        justifyContent: 'flex-end',
        marginBottom: 40,
    },
    primaryButton: {
        backgroundColor: '#FFF',
        height: 64,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        marginBottom: 12,
    },
    primaryButtonText: {
        color: '#000',
        fontSize: 14,
        fontFamily: 'Inter_900Black',
        letterSpacing: 1,
    },
    secondaryButton: {
        backgroundColor: '#131313',
        height: 64,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        marginBottom: 24,
    },
    secondaryButtonText: {
        color: '#FFF',
        fontSize: 14,
        fontFamily: 'Inter_900Black',
        letterSpacing: 1,
    },
    cancelButton: {
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButtonText: {
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: 14,
        fontFamily: 'SpaceGrotesk_500Medium',
    },
});
