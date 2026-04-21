import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BlockSession } from '../../services/FocusStorageService';

interface MomTestUnlockModalProps {
    visible: boolean;
    onClose: () => void;
    session: BlockSession;
    onSuccess: () => void;
}

export const MomTestUnlockModal = ({
    visible,
    onClose,
    session,
    onSuccess
}: MomTestUnlockModalProps) => {
    const [otp, setOtp] = useState('');
    const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
    const [showOtpInput, setShowOtpInput] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [cooldown, setCooldown] = useState(0);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (cooldown > 0) {
            timer = setInterval(() => {
                setCooldown(prev => prev - 1);
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [cooldown]);

    const handleSendCode = async () => {
        if (isSending || cooldown > 0) return;

        const email = session.strictnessConfig.emailAddress;
        if (!email) {
            alert("CONFIG_ERROR: NO_TRUSTED_EMAIL_FOUND");
            return;
        }

        const newOtp = Math.floor(1000 + Math.random() * 9000).toString();
        setIsSending(true);

        try {
            // Hardcoded for now as per developer instructions, will migrate to ENV in production
            const apiKey = 're_N6uTZ7U8_5xDH88K6JuekUqNDGTwrL4pZ';
            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    from: 'Unlink <auth@getunlink.com>',
                    to: [email],
                    subject: 'MOM TEST: UNLOCK VERIFICATION CODE',
                    html: `
                        <div style="font-family: sans-serif; padding: 20px; color: #000; border: 1px solid #eee;">
                            <h2 style="letter-spacing: 2px; text-transform: uppercase;">Unlink_Protocol</h2>
                            <p>A request has been made to terminate an active focus session.</p>
                            <p>Please provide this code to the user <b>only</b> if they have completed their original intent:</p>
                            <div style="background: #f9f9f9; padding: 20px; text-align: center; margin: 20px 0;">
                                <h1 style="font-size: 48px; letter-spacing: 15px; margin: 0; color: #000;">${newOtp}</h1>
                            </div>
                            <p style="color: #666; font-size: 11px; text-transform: uppercase;">Mode: AirTight Lockdown (Mom Test)</p>
                        </div>
                    `
                })
            });

            if (response.ok) {
                setGeneratedOtp(newOtp);
                setShowOtpInput(true);
                setCooldown(60);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else {
                const err = await response.json();
                alert(`API_ERROR: ${err.message || 'FAILED_TO_SEND'}`);
            }
        } catch (error) {
            alert("NETWORK_ERROR: CHECK_COMMUNICATION_CHANNELS");
        } finally {
            setIsSending(false);
        }
    };

    const handleVerify = () => {
        if (otp === generatedOtp) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onSuccess();
        } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            alert("PROTOCOL_ERROR: INVALID_VERIFICATION_CODE");
        }
    };

    const handleReset = () => {
        setOtp('');
        setShowOtpInput(false);
        setGeneratedOtp(null);
    };

    return (
        <Modal 
            visible={visible} 
            transparent 
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.content}>
                    {/* Header */}
                    <View className="flex-row justify-between items-center mb-8">
                        <View className="flex-row items-center gap-2">
                            <MaterialCommunityIcons name="account-lock" size={24} color="white" />
                            <Text className="text-white font-headline font-black text-lg uppercase tracking-widest">Mom Test</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} className="p-2">
                            <Ionicons name="close" size={24} color="#555" />
                        </TouchableOpacity>
                    </View>

                    <Text className="text-white/40 font-label text-[10px] uppercase leading-5 mb-8">
                        To terminate this session, we have sent a verification code to the trusted contact:
                        <Text className="text-white font-bold"> {session.strictnessConfig.emailAddress}</Text>
                    </Text>

                    {!showOtpInput ? (
                        <TouchableOpacity
                            onPress={handleSendCode}
                            disabled={isSending || cooldown > 0}
                            className={`h-16 items-center justify-center border ${isSending || cooldown > 0 ? 'border-white/10 bg-white/2' : 'border-white bg-white'}`}
                        >
                            {isSending ? (
                                <ActivityIndicator color="black" />
                            ) : (
                                <Text className={`font-headline font-black text-sm uppercase tracking-widest ${cooldown > 0 ? 'text-white/20' : 'text-black'}`}>
                                    {cooldown > 0 ? `Retry in ${cooldown}s` : 'Request Code'}
                                </Text>
                            )}
                        </TouchableOpacity>
                    ) : (
                        <View className="gap-4">
                            <View className="flex-row gap-2">
                                <TextInput
                                    value={otp}
                                    onChangeText={setOtp}
                                    placeholder="----"
                                    placeholderTextColor="rgba(255,255,255,0.1)"
                                    keyboardType="number-pad"
                                    maxLength={4}
                                    autoFocus
                                    className="flex-1 h-16 bg-white/5 border border-white/20 text-white font-headline font-black text-3xl text-center"
                                />
                                <TouchableOpacity 
                                    onPress={handleVerify}
                                    className="w-20 bg-white items-center justify-center"
                                >
                                    <MaterialIcons name="arrow-forward" size={24} color="black" />
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity onPress={handleReset}>
                                <Text className="text-white/20 font-label text-[10px] text-center uppercase tracking-widest">Resend Code</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    <Text className="text-white/10 font-label text-[8px] text-center uppercase tracking-[0.2em] mt-10">
                        AIRTIGHT_LOCKDOWN_ENFORCED
                    </Text>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.95)',
        justifyContent: 'center',
        paddingHorizontal: 24
    },
    content: {
        backgroundColor: '#0a0a0a',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        padding: 32,
        borderRadius: 2
    }
});
