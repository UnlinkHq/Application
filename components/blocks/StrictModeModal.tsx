import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BottomSheetWrapper } from '../ui/BottomSheetWrapper';
import Animated, { FadeIn, FadeInDown, Layout } from 'react-native-reanimated';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { ModernToggle } from '../ui/ModernToggle';
import { sendSetupVerificationCode } from '../../services/ResendService';

export type StrictModeLevel = 'normal' | 'qr_code' | 'mom_test' | 'money';

interface StrictModeOption {
    id: StrictModeLevel;
    title: string;
    description: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    color: string;
    isDisabled?: boolean;
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
        color: '#ffffff',
        isDisabled: true
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

    const handleSelectMode = (mode: StrictModeOption) => {
        if (mode.isDisabled) return;
        setSelectedMode(mode.id);
    };

    const handleSendVerificationCode = async () => {
        if (!emailAddress || isSendingCode) {
            alert("INVALID INPUT: PLEASE ENTER VALID EMAIL");
            return;
        }

        setIsSendingCode(true);
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        
        try {
            await sendSetupVerificationCode(emailAddress, code);
            setSetupCode(code);
            setVerificationStep('verify');
        } catch (error: any) {
            alert(`API ERROR: ${error.message || 'FAILED TO SEND'}`);
        } finally {
            setIsSendingCode(false);
        }
    };

    const handleVerifyCode = () => {
        if (enteredSetupCode === setupCode) {
            setIsVerified(true);
        } else {
            alert("INVALID VERIFICATION CODE");
        }
    };

    const handleConfirm = () => {
        if (selectedMode === 'mom_test' && !isVerified) {
            alert("VERIFICATION REQUIRED: PLEASE VERIFY TRUSTED CONTACT");
            return;
        }

        if (selectedMode === 'money') {
            alert("PROTOCOL UNDER DEVELOPMENT: This mode will be available in V2.0.");
            return;
        }

        onConfirm(selectedMode, {
            emailAddress,
            isVerified
        });
        onClose();
    };

    const isConfirmDisabled = (selectedMode === 'mom_test' && !isVerified) || selectedMode === 'money';

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
                            onPress={() => handleSelectMode(mode)}
                            activeOpacity={mode.isDisabled ? 1 : 0.7}
                            className={`flex-row items-center p-5 border-2 ${mode.isDisabled ? 'opacity-30 border-white/5 bg-[#050505]' : (selectedMode === mode.id ? 'border-white bg-[#121212]' : 'border-white/5 bg-[#121212]')}`}
                        >
                            <View className="w-12 h-12 bg-white/5 items-center justify-center mr-4">
                                <MaterialCommunityIcons name={mode.icon} size={24} color={mode.isDisabled ? "#333" : mode.color} />
                            </View>
                            <View className="flex-1 mr-4">
                                <View className="flex-row items-center gap-2">
                                    <Text className={`font-headline font-black text-sm uppercase tracking-widest ${mode.isDisabled ? 'text-white/20' : 'text-white'}`}>
                                        {mode.title}
                                    </Text>
                                    {mode.isDisabled && (
                                        <View className="bg-white/5 px-1.5 py-0.5 border border-white/10">
                                            <Text className="text-white/20 font-label text-[7px] uppercase tracking-widest">SOON</Text>
                                        </View>
                                    )}
                                </View>
                                <Text className={`font-label text-[10px] mt-1 leading-tight ${mode.isDisabled ? 'text-white/10' : 'text-white/40'}`}>
                                    {mode.description}
                                </Text>
                            </View>
                            <View className={`w-6 h-6 border-2 items-center justify-center ${mode.isDisabled ? 'border-white/0' : (selectedMode === mode.id ? 'bg-white border-white' : 'bg-transparent border-white/20')}`}>
                                {selectedMode === mode.id && !mode.isDisabled && (
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
                                                {isSendingCode ? 'SENDING...' : 'SEND VERIFICATION CODE'}
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
                                                placeholder="------"
                                                placeholderTextColor="rgba(255,255,255,0.2)"
                                                keyboardType="number-pad"
                                                maxLength={6}
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
                        <Animated.View entering={FadeInDown} className="mb-8">
                            <Text className="text-white/20 font-headline font-black text-[10px] uppercase tracking-[0.3em] mb-4">CASH STAKES CONFIGURATION</Text>
                            <View className="bg-white/5 border border-white/10 p-10 items-center border-dashed">
                                <View className="w-16 h-16 bg-white/5 items-center justify-center rounded-full mb-6">
                                    <MaterialCommunityIcons name="clock-fast" size={32} color="rgba(255,255,255,0.2)" />
                                </View>
                                <Text className="text-white font-headline font-black text-xs uppercase mb-2">Protocol Under Development</Text>
                                <Text className="text-white/40 font-label text-[10px] text-center leading-4 max-w-[240px]">
                                    Direct financial stakes for focus protocol violations will be available in V2.0. 
                                    <Text className="text-white"> Stake. Loss. Focus.</Text>
                                </Text>
                                <View className="mt-8 px-4 py-2 bg-white/5 border border-white/20">
                                    <Text className="text-[#72fe88] font-headline font-black text-[10px] uppercase tracking-widest">EXPECTED LAUNCH: Q3 2026</Text>
                                </View>
                            </View>
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
                        {selectedMode === 'mom_test' && !isVerified ? 'VERIFICATION REQUIRED' : 
                         selectedMode === 'money' ? 'UNDER DEVELOPMENT' : 'Select Protocol'}
                    </Text>
                </TouchableOpacity>
            </View>
        </BottomSheetWrapper>
    );
};
