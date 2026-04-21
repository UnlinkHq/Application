import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BottomSheetWrapper } from '../ui/BottomSheetWrapper';
import Animated, { FadeIn, FadeInDown, Layout } from 'react-native-reanimated';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { ModernToggle } from '../ui/ModernToggle';

export type StrictModeLevel = 'normal' | 'qr_code' | 'mom_test' | 'money';

interface StrictModeOption {
    id: StrictModeLevel;
    title: string;
    description: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    color: string;
}

const STRICT_MODES: StrictModeOption[] = [
    {
        id: 'normal',
        title: 'Normal (Easy)',
        description: 'Stop blocking whenever you want.',
        icon: 'pause-circle-outline',
        color: '#ffffff'
    },
    {
        id: 'qr_code',
        title: 'QR Code (Medium)',
        description: 'Scan your unique QR code to stop blocking.',
        icon: 'qrcode-scan',
        color: '#ffffff'
    },
    {
        id: 'mom_test',
        title: 'Mom Test (Hard)',
        description: 'Verification code sent to a trusted email.',
        icon: 'account-lock-outline',
        color: '#ffffff'
    },
    {
        id: 'money',
        title: 'Money Challenge (Extreme)',
        description: 'Lose money if you stop the session early.',
        icon: 'cash-lock',
        color: '#ffffff'
    }
];

interface StrictModeModalProps {
    visible: boolean;
    onClose: () => void;
    currentMode: StrictModeLevel;
    onConfirm: (mode: StrictModeLevel, config?: any) => void;
}

export const StrictModeModal = ({
    visible,
    onClose,
    currentMode,
    onConfirm
}: StrictModeModalProps) => {
    const [selectedMode, setSelectedMode] = useState<StrictModeLevel>(currentMode);

    // Sub-options state
    const [emailAddress, setEmailAddress] = useState('');
    // Mom Test Verification States
    const [isVerified, setIsVerified] = useState(false);
    const [verificationStep, setVerificationStep] = useState<'input' | 'verify'>('input');
    const [setupCode, setSetupCode] = useState('');
    const [enteredSetupCode, setEnteredSetupCode] = useState('');
    const [isSendingCode, setIsSendingCode] = useState(false);

    useEffect(() => {
        if (visible) {
            setSelectedMode(currentMode);
        }
    }, [visible, currentMode]);

    const handleSendVerificationCode = async () => {
        if (!emailAddress || isSendingCode) {
            alert("INVALID_INPUT: PLEASE_ENTER_VALID_EMAIL");
            return;
        }

        setIsSendingCode(true);
        const code = Math.floor(1000 + Math.random() * 9000).toString();
        
        try {
            const apiKey = 're_N6uTZ7U8_5xDH88K6JuekUqNDGTwrL4pZ';
            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    from: 'Unlink <auth@getunlink.com>',
                    to: [emailAddress],
                    subject: 'MOM TEST: SETUP VERIFICATION CODE',
                    html: `
                        <div style="font-family: sans-serif; padding: 20px; color: #000;">
                            <h2 style="letter-spacing: 2px;">UNLINK_SETUP</h2>
                            <p>You have been chosen as a Trusted Contact for an Unlink Focus Session.</p>
                            <p>Use this code to verify your identity:</p>
                            <h1 style="font-size: 32px; letter-spacing: 10px; margin: 20px 0;">${code}</h1>
                            <p style="color: #666; font-size: 11px;">If you didn't expect this, please ignore this email.</p>
                        </div>
                    `
                })
            });

            if (response.ok) {
                setSetupCode(code);
                setVerificationStep('verify');
            } else {
                const err = await response.json();
                alert(`API_ERROR: ${err.message || 'FAILED_TO_SEND'}`);
            }
        } catch (error) {
            alert("NETWORK_ERROR: CHECK_CONNECTION");
        } finally {
            setIsSendingCode(false);
        }
    };

    const handleVerifyCode = () => {
        if (enteredSetupCode === setupCode) {
            setIsVerified(true);
        } else {
            alert("INVALID_VERIFICATION_CODE");
        }
    };

    const handleConfirm = () => {
        if (selectedMode === 'mom_test' && !isVerified) {
            alert("VERIFICATION_REQUIRED: PLEASE_VERIFY_TRUSTED_CONTACT");
            return;
        }

        onConfirm(selectedMode, {
            emailAddress,
            isVerified
        });
        onClose();
    };

    const isConfirmDisabled = selectedMode === 'mom_test' && !isVerified;

    return (
        <BottomSheetWrapper
            visible={visible}
            onClose={onClose}
            title="SELECT STRICT MODE"
            snapPoints={['95%']}
        >
            <BottomSheetScrollView
                showsVerticalScrollIndicator={false}
                className="mt-4 flex-1"
                contentContainerStyle={{ paddingHorizontal: 6 }}
            >
                <Text className="text-white/40 font-headline font-black text-[10px] uppercase tracking-[0.3em] mb-6">
                    STRICT MODES MAKE IT DIFFICULT TO STOP BLOCKING.
                </Text>

                <View className="space-y-3">
                    {STRICT_MODES.map((mode) => (
                        <TouchableOpacity
                            key={mode.id}
                            onPress={() => setSelectedMode(mode.id)}
                            activeOpacity={0.7}
                            className={`flex-row items-center p-5 border-2 ${selectedMode === mode.id ? 'border-white bg-[#121212]' : 'border-white/5 bg-[#121212]'}`}
                        >
                            <View className="w-12 h-12 bg-white/10 items-center justify-center mr-4">
                                <MaterialCommunityIcons name={mode.icon} size={24} color={mode.color} />
                            </View>
                            <View className="flex-1 mr-4">
                                <Text className="text-white font-headline font-black text-sm uppercase tracking-widest">
                                    {mode.title}
                                </Text>
                                <Text className="text-white/40 font-label text-[10px] mt-1 leading-tight">
                                    {mode.description}
                                </Text>
                            </View>
                            <View className={`w-6 h-6 border-2 items-center justify-center ${selectedMode === mode.id ? 'bg-white border-white' : 'bg-transparent border-white/20'}`}>
                                {selectedMode === mode.id && (
                                    <MaterialIcons name="check" size={14} color="black" />
                                )}
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Sub-options revealed below the 4 main options */}
                <Animated.View layout={Layout.springify()} className="mt-8 pb-32">
                    {selectedMode === 'qr_code' && (
                        <Animated.View entering={FadeInDown} className="mb-8">
                            <Text className="text-white/20 font-headline font-black text-[10px] uppercase tracking-[0.3em] mb-4">QR CODE CONFIGURATION</Text>
                            <View className="bg-white/5 border border-white/10 p-5">
                                <Text className="text-white font-headline font-black text-xs uppercase mb-2">QR GENERATION</Text>
                                <Text className="text-white/40 font-label text-[10px] leading-4 mb-6 italic">
                                    A unique QR code will be generated for this session. It will be stored in your gallery. To stop the block, you must scan it.
                                </Text>
                                <View className="h-14 bg-white/10 border border-white/10 items-center justify-center">
                                    <Text className="text-white/60 font-headline font-black text-[10px] uppercase tracking-widest">Auto generate on start</Text>
                                </View>
                            </View>
                        </Animated.View>
                    )}

                    {selectedMode === 'mom_test' && (
                        <Animated.View entering={FadeInDown} className="mb-8 space-y-4">
                            <Text className="text-white/20 font-headline font-black text-[10px] uppercase tracking-[0.3em] mb-2">MOM TEST CONFIGURATION</Text>

                            <View className="bg-white/5 border border-white/10 p-6">
                                <View className="flex-row items-center justify-between mb-4">
                                    <View className="flex-row items-center">
                                        <MaterialCommunityIcons name="email-outline" size={16} color="white" style={{ marginRight: 8 }} />
                                        <Text className="text-white font-headline font-black text-xs uppercase">TRUSTED EMAIL</Text>
                                    </View>
                                    {isVerified && (
                                        <View className="flex-row items-center">
                                            <MaterialIcons name="verified" size={12} color="white" />
                                            <Text className="text-white font-label text-[10px] uppercase ml-1">VERIFIED</Text>
                                        </View>
                                    )}
                                </View>

                                {verificationStep === 'input' && !isVerified ? (
                                    <View>
                                        <TextInput
                                            value={emailAddress}
                                            onChangeText={setEmailAddress}
                                            placeholder="mom@example.com"
                                            placeholderTextColor="rgba(255,255,255,0.2)"
                                            keyboardType="email-address"
                                            autoCapitalize="none"
                                            className="h-14 bg-black border border-white/20 px-4 text-white font-headline font-black text-sm mb-4"
                                        />
                                        <TouchableOpacity
                                            onPress={handleSendVerificationCode}
                                            disabled={isSendingCode}
                                            className={`h-12 ${isSendingCode ? 'bg-white/20' : 'bg-white'} items-center justify-center flex-row`}
                                        >
                                            <MaterialCommunityIcons name="send" size={14} color="black" style={{ marginRight: 8 }} />
                                            <Text className="text-black font-headline font-black text-[10px] uppercase tracking-widest">
                                                {isSendingCode ? 'SENDING...' : 'SEND_VERIFICATION_CODE'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : !isVerified ? (
                                    <View>
                                        <Text className="text-white/40 font-label text-[10px] mb-3 italic">Enter the code emailed to your contact</Text>
                                        <View className="flex-row gap-2">
                                            <TextInput
                                                value={enteredSetupCode}
                                                onChangeText={setEnteredSetupCode}
                                                placeholder="----"
                                                placeholderTextColor="rgba(255,255,255,0.2)"
                                                keyboardType="number-pad"
                                                maxLength={4}
                                                className="flex-1 h-14 bg-black border border-white/20 px-4 text-white font-headline font-black text-xl text-center"
                                            />
                                            <TouchableOpacity
                                                onPress={handleVerifyCode}
                                                className="w-20 bg-white items-center justify-center"
                                            >
                                                <MaterialIcons name="check" size={24} color="black" />
                                            </TouchableOpacity>
                                        </View>
                                        <TouchableOpacity onPress={() => setVerificationStep('input')} className="mt-4">
                                            <Text className="text-white/20 font-label text-[10px] uppercase tracking-widest text-center underline">Change email</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <View className="h-14 bg-white/5 border border-white/20 items-center justify-center px-4">
                                        <Text className="text-white font-headline font-black text-xs uppercase tracking-widest" numberOfLines={1}>{emailAddress}</Text>
                                    </View>
                                )}
                            </View>

                            {/* WhatsApp Locked Premium Card */}
                            <View className="bg-[#0a0a0a] border border-white/5 p-5 opacity-60">
                                <View className="flex-row items-center justify-between mb-2">
                                    <View className="flex-row items-center">
                                        <MaterialCommunityIcons name="whatsapp" size={16} color="#22c55e" style={{ marginRight: 8 }} />
                                        <Text className="text-white/60 font-headline font-black text-xs uppercase">WHATSAPP SYNC</Text>
                                    </View>
                                    <View className="bg-white/10 px-2 py-1 border border-white/10">
                                        <Text className="text-white border-white/0 font-label text-[10px] uppercase font-black tracking-widest">PREMIUM</Text>
                                    </View>
                                </View>
                                <Text className="text-white/30 font-label text-[10px] mt-1 pb-2 font-italic">
                                    Link directly to WhatsApp for automated messaging without server emails. Available in upcoming iterations.
                                </Text>
                            </View>

                        </Animated.View>
                    )}

                    {selectedMode === 'money' && (
                        <Animated.View entering={FadeInDown} className="mb-8 items-center py-10 border border-white/10 bg-white/[0.02] border-dashed">
                            <MaterialCommunityIcons name="lock-clock" size={32} color="rgba(255,255,255,0.2)" />
                            <Text className="text-white/20 font-headline font-black text-[10px] uppercase tracking-widest mt-4">PROTOCOLS_COMING_SOON</Text>
                        </Animated.View>
                    )}


                </Animated.View>
            </BottomSheetScrollView>

            <View className="px-6 py-6 bg-[#0a0a0a]">
                <TouchableOpacity
                    className={`h-16 items-center justify-center ${isConfirmDisabled ? 'bg-white/10' : 'bg-white'}`}
                    activeOpacity={0.9}
                    onPress={handleConfirm}
                    disabled={isConfirmDisabled}
                >
                    <Text className={`font-headline font-black text-lg uppercase tracking-[0.2em] ${isConfirmDisabled ? 'text-white/20' : 'text-black'}`}>
                        {selectedMode === 'mom_test' && !isVerified ? 'VERIFICATION_REQUIRED' : 'Select Protocol'}
                    </Text>
                </TouchableOpacity>
            </View>
        </BottomSheetWrapper>
    );
};
