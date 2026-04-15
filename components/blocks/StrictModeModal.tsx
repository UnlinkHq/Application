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
        description: 'Ask a trusted person to verify through WhatsApp.',
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

    useEffect(() => {
        if (visible) {
            setSelectedMode(currentMode);
        }
    }, [visible, currentMode]);

    const handleSendVerificationCode = () => {
        if (!emailAddress) {
            alert("INVALID_INPUT: PLEASE_ENTER_VALID_EMAIL");
            return;
        }

        const code = Math.floor(1000 + Math.random() * 9000).toString();
        setSetupCode(code);

        // Mocking a serverless API call to Cloudflare/Resend
        console.log(`\n\n[UNLINK MOCK API] Sending Verification Email to: ${emailAddress}\n[UNLINK MOCK API] CODE: ${code}\n\n`);

        // Fake network delay for a realistic premium loading feel
        setTimeout(() => {
            setVerificationStep('verify');
        }, 800);
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
                            className={`flex-row items-center p-5 rounded-2xl border-2 ${selectedMode === mode.id ? 'border-blue-500 bg-white/5' : 'border-white/5 bg-[#121212]'}`}
                        >
                            <View className="w-12 h-12 rounded-full bg-white/10 items-center justify-center mr-4">
                                <MaterialCommunityIcons name={mode.icon} size={24} color={mode.color} />
                            </View>
                            <View className="flex-1 mr-4">
                                <Text className="text-white font-headline font-black text-sm tracking-tight">
                                    {mode.title}
                                </Text>
                                <Text className="text-white/40 font-label text-[10px] mt-1 leading-tight">
                                    {mode.description}
                                </Text>
                            </View>
                            <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${selectedMode === mode.id ? 'bg-blue-500 border-blue-500' : 'bg-transparent border-white/20'}`}>
                                {selectedMode === mode.id && (
                                    <MaterialIcons name="check" size={14} color="white" />
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
                            <View className="bg-white/5 border border-white/10 p-5 rounded-sm">
                                <Text className="text-white font-headline font-black text-xs uppercase mb-2">QR GENERATION</Text>
                                <Text className="text-white/40 font-label text-[10px] uppercase leading-4 mb-6 italic">
                                    A unique QR code will be generated for this session. It will be stored in your gallery. To stop the block, you must scan it.
                                </Text>
                                <View className="h-14 bg-white/10 border border-white/10 items-center justify-center">
                                    <Text className="text-white/60 font-headline font-black text-[10px] uppercase tracking-widest">AUTO_GENERATE_ON_START</Text>
                                </View>
                            </View>
                        </Animated.View>
                    )}

                    {selectedMode === 'mom_test' && (
                        <Animated.View entering={FadeInDown} className="mb-8 space-y-4">
                            <Text className="text-white/20 font-headline font-black text-[10px] uppercase tracking-[0.3em] mb-2">MOM TEST CONFIGURATION</Text>

                            <View className="bg-white/5 border border-white/10 p-6 rounded-sm">
                                <View className="flex-row items-center justify-between mb-4">
                                    <View className="flex-row items-center">
                                        <MaterialCommunityIcons name="email-outline" size={16} color="white" style={{ marginRight: 8 }} />
                                        <Text className="text-white font-headline font-black text-xs uppercase">TRUSTED EMAIL</Text>
                                    </View>
                                    {isVerified && (
                                        <View className="flex-row items-center">
                                            <MaterialIcons name="verified" size={12} color="#3b82f6" />
                                            <Text className="text-blue-500 font-label text-[8px] uppercase ml-1">VERIFIED</Text>
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
                                            className="h-12 bg-white items-center justify-center flex-row"
                                        >
                                            <MaterialCommunityIcons name="send" size={14} color="black" style={{ marginRight: 8 }} />
                                            <Text className="text-black font-headline font-black text-[10px] uppercase tracking-widest">SEND_VERIFICATION_CODE</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : !isVerified ? (
                                    <View>
                                        <Text className="text-white/40 font-label text-[9px] uppercase mb-3 italic">ENTER THE CODE EMAILED TO YOUR CONTACT</Text>
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
                                                className="w-20 bg-blue-500 items-center justify-center"
                                            >
                                                <MaterialIcons name="check" size={24} color="white" />
                                            </TouchableOpacity>
                                        </View>
                                        <TouchableOpacity onPress={() => setVerificationStep('input')} className="mt-4">
                                            <Text className="text-white/20 font-label text-[8px] uppercase tracking-widest text-center underline">CHANGE_EMAIL</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <View className="h-14 bg-blue-500/10 border border-blue-500/20 items-center justify-center px-4">
                                        <Text className="text-blue-500 font-headline font-black text-xs uppercase tracking-widest" numberOfLines={1}>{emailAddress}</Text>
                                    </View>
                                )}
                            </View>

                            {/* WhatsApp Locked Premium Card */}
                            <View className="bg-[#121212] border border-white/5 p-5 rounded-sm opacity-60">
                                <View className="flex-row items-center justify-between mb-2">
                                    <View className="flex-row items-center">
                                        <MaterialCommunityIcons name="whatsapp" size={16} color="#22c55e" style={{ marginRight: 8 }} />
                                        <Text className="text-white/60 font-headline font-black text-xs uppercase">WHATSAPP SYNC</Text>
                                    </View>
                                    <View className="bg-blue-500/20 px-2 py-1 rounded-sm">
                                        <Text className="text-blue-500 font-label text-[8px] uppercase font-black tracking-widest">PREMIUM</Text>
                                    </View>
                                </View>
                                <Text className="text-white/30 font-label text-[9px] uppercase leading-4 italic mt-1 pb-2">
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

            <View className="px-6 py-6 bg-[#000]">
                <TouchableOpacity
                    className={`h-16 items-center justify-center rounded-2xl ${isConfirmDisabled ? 'bg-white/10' : 'bg-blue-500'}`}
                    activeOpacity={0.9}
                    onPress={handleConfirm}
                    disabled={isConfirmDisabled}
                >
                    <Text className={`font-headline font-black text-lg uppercase tracking-[0.2em] ${isConfirmDisabled ? 'text-white/20' : 'text-white'}`}>
                        {selectedMode === 'mom_test' && !isVerified ? 'VERIFICATION_REQUIRED' : 'Select Protocol'}
                    </Text>
                </TouchableOpacity>
            </View>
        </BottomSheetWrapper>
    );
};
