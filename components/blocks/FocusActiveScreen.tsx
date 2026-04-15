import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, TextInput, StyleSheet } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { MetricsEngine, UserMetrics } from '../../services/MetricsEngine';
import { FocusStorageService, BlockSession } from '../../services/FocusStorageService';
import * as ScreenTime from '../../modules/screen-time';
import { Camera, CameraView } from 'expo-camera';

interface FocusActiveScreenProps {
    session: BlockSession;
    onEnd: () => void;
}

export const FocusActiveScreen = ({ session, onEnd }: FocusActiveScreenProps) => {
    const [metrics, setMetrics] = useState<UserMetrics | null>(null);
    const [timeLeft, setTimeLeft] = useState<number>(0);
    const [hasOverlay, setHasOverlay] = useState(true);
    const [isScanning, setIsScanning] = useState(false);
    const [otp, setOtp] = useState('');
    const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
    const [showOtpInput, setShowOtpInput] = useState(false);
    const [breaksLeft, setBreaksLeft] = useState(
        session.timedBreaks?.enabled 
            ? (session.timedBreaks.allowedCount - (session.timedBreaks.usedCount || 0)) 
            : 0
    );

    useEffect(() => {
        const check = async () => {
            const has = await ScreenTime.hasOverlayPermission();
            setHasOverlay(has);
        };
        const load = async () => {
            const m = await MetricsEngine.getMetrics();
            setMetrics(m);
        };
        check();
        load();
    }, []);

    useEffect(() => {
        const timer = setInterval(() => {
            const now = Date.now();
            const elapsed = (now - session.startTime) / (1000 * 60);
            const remaining = Math.max(0, session.durationMins - elapsed);
            setTimeLeft(remaining);
            
            if (remaining <= 0) {
                handleStop(true);
            } else {
                // ABSOLUTE ZERO: Live sync to the native black wall
                const formatted = formatTime(remaining);
                const msg = metrics ? MetricsEngine.getMessage(metrics) : 'FOCUS_PROTOCOL_ENGAGED';
                ScreenTime.setBlockedApps(session.apps, msg, formatted);
            }
        }, 1000);
        return () => clearInterval(timer);
    }, [session]);

    const handleStop = async (isAuto = false) => {
        await FocusStorageService.stopSession();
        if (!isAuto) {
            await MetricsEngine.recordBypass();
        } else {
            await MetricsEngine.recordSessionSuccess();
        }
        onEnd();
    };

    const handleTimedBreak = async () => {
        if (breaksLeft <= 0) return;
        
        // 1. Update session state locally and persist
        const updatedSession = { ...session };
        updatedSession.timedBreaks.usedCount = (updatedSession.timedBreaks.usedCount || 0) + 1;
        await FocusStorageService.startSession(updatedSession);
        
        // 2. Take a break logic: Stop blocking for X minutes
        const breakMins = session.timedBreaks?.durationMins || 5;
        setBreaksLeft(prev => prev - 1);
        
        // 3. Sync to native and show the "Break Screen"
        await ScreenTime.setBlockedApps([], "BREAK_PROTOCOL_ACTIVE", "REST_PERIOD");
        
        setTimeout(async () => {
            // Re-engage after duration
            const msg = metrics ? MetricsEngine.getMessage(metrics) : 'FOCUS_PROTOCOL_ENGAGED';
            ScreenTime.setBlockedApps(session.apps, msg, formatTime(timeLeft));
        }, breakMins * 60000);
    };

    const handleEmailRequest = () => {
        const email = session.strictnessConfig.emailAddress;
        const newOtp = Math.floor(1000 + Math.random() * 9000).toString();
        setGeneratedOtp(newOtp);
        
        // Mocking a serverless API call
        console.log(`\n\n[UNLINK MOCK API - UNBLOCK REQUEST] Sending Email to: ${email}\n[UNLINK MOCK API] UNBLOCK CODE: ${newOtp}\n\n`);
        
        // Fake network delay for premium feel
        setTimeout(() => {
            setShowOtpInput(true);
        }, 1000);
    };

    const handleVerifyOtp = () => {
        if (otp === generatedOtp) {
            handleStop(false);
        } else {
            alert("INVALID_PROTOCOL_CODE");
        }
    };

    const handleBarCodeScanned = ({ data }: { data: string }) => {
        setIsScanning(false);
        if (data === session.strictnessConfig.qrCodeData) {
            handleStop(false);
        } else {
            alert("PROTOCOL_MISMATCH: INVALID_QR_SIGNATURE");
        }
    };

    const formatTime = (mins: number) => {
        const h = Math.floor(mins / 60);
        const m = Math.floor(mins % 60);
        const s = Math.floor((mins * 60) % 60);
        return `${h > 0 ? h + ':' : ''}${m < 10 && h > 0 ? '0' + m : m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
        <SafeAreaView className="flex-1 bg-black">
            <Animated.View 
                entering={FadeIn.duration(800)}
                className="flex-1 items-center justify-center px-8"
            >
                <View className="items-center mb-12">
                    <Ionicons name="shield-checkmark" size={60} color="white" />
                    <Text className="text-white/40 font-headline font-black text-xs uppercase tracking-[0.4em] mt-4">
                        FOCUS_PROTOCOL_ENGAGED
                    </Text>
                </View>

                <View className="items-center mb-16">
                    <Text className="text-white font-headline font-black text-7xl tracking-tighter">
                        {formatTime(timeLeft)}
                    </Text>
                    <Text className="text-white/20 font-label text-[10px] uppercase tracking-widest mt-2">
                        REMAINING_RESTRICTION_PERIOD
                    </Text>
                </View>

                <Animated.View 
                    entering={FadeInDown.delay(400).duration(800)}
                    className="w-full bg-white/5 p-6 border border-white/10 rounded-2xl items-center"
                >
                    <Text className="text-white font-headline font-black text-lg text-center leading-6">
                        {metrics ? MetricsEngine.getMessage(metrics) : '...'}
                    </Text>
                    <View className="h-[1px] w-12 bg-white/20 my-4" />
                    <Text className="text-white/40 font-label text-[10px] text-center uppercase leading-4 italic">
                        "Your future self is thanking you for this hour of deep focus."
                    </Text>
                </Animated.View>

                <View className="flex-row items-center mt-12 gap-2">
                    <View className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    <Text className="text-white/40 font-label text-[10px] uppercase tracking-widest">
                        AIRTIGHT_LOCKDOWN_ACTIVE
                    </Text>
                </View>

                {/* Permission Warning if Enforcement might fail */}
                {!hasOverlay && (
                    <Animated.View 
                        entering={FadeIn.delay(800)}
                        className="mt-8 bg-red-900/20 border border-red-500/30 p-4 rounded-xl items-center w-full"
                    >
                        <Text className="text-red-500 font-headline font-black text-[10px] uppercase tracking-widest mb-2">
                            ENFORCEMENT_WARNING: OVERLAY_PERMISSION_MISSING
                        </Text>
                        <Text className="text-white/60 font-body text-[10px] text-center mb-4">
                            Unlink cannot physically block other apps without 'Display over other apps' permission.
                        </Text>
                        <TouchableOpacity 
                            onPress={() => ScreenTime.requestOverlayPermission()}
                            className="bg-red-500 px-4 py-2 rounded-sm"
                        >
                            <Text className="text-white font-headline font-black text-[10px] uppercase">GRANT_CONTROL_NOW</Text>
                        </TouchableOpacity>
                    </Animated.View>
                )}
            </Animated.View>

            <View className="px-6 pb-8 gap-4">
                {session.timedBreaks?.enabled && breaksLeft > 0 && (
                    <TouchableOpacity
                        onPress={handleTimedBreak}
                        className="h-16 border border-blue-500/30 items-center justify-center bg-blue-500/10"
                    >
                        <Text className="text-blue-500 font-headline font-black text-sm uppercase tracking-widest">
                            {`TAKE_BREAK (${breaksLeft}_REMAINING)`}
                        </Text>
                    </TouchableOpacity>
                )}

                {session.strictnessConfig.mode === 'qr_code' ? (
                    <TouchableOpacity
                        onPress={() => setIsScanning(true)}
                        className="h-16 border border-white/20 items-center justify-center bg-white/5"
                    >
                        <Text className="text-white font-headline font-black text-sm uppercase tracking-widest">
                            SCAN_QR_SIGNATURE
                        </Text>
                    </TouchableOpacity>
                ) : session.strictnessConfig.mode === 'mom_test' ? (
                    <View className="gap-4">
                        {showOtpInput ? (
                            <View className="flex-row gap-2">
                                <TextInput
                                    value={otp}
                                    onChangeText={setOtp}
                                    placeholder="----"
                                    placeholderTextColor="rgba(255,255,255,0.2)"
                                    keyboardType="number-pad"
                                    maxLength={4}
                                    className="flex-1 h-16 bg-white/10 border border-white/20 px-6 text-white font-headline font-black text-2xl text-center"
                                />
                                <TouchableOpacity 
                                    onPress={handleVerifyOtp}
                                    className="w-20 bg-white items-center justify-center"
                                >
                                    <MaterialIcons name="arrow-forward" size={24} color="black" />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity
                                onPress={handleEmailRequest}
                                className="h-16 border border-white/20 items-center justify-center bg-white/5"
                            >
                                <Text className="text-white font-headline font-black text-sm uppercase tracking-widest">
                                    REQUEST_UNBLOCK_VIA_EMAIL
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ) : (
                    <TouchableOpacity
                        onPress={() => handleStop(false)}
                        className="h-16 border border-white/10 items-center justify-center bg-transparent"
                        activeOpacity={0.7}
                    >
                        <Text className="text-white/40 font-headline font-black text-sm uppercase tracking-[0.3em]">
                            STOP_FOCUS_MODE
                        </Text>
                    </TouchableOpacity>
                )}
                
                <Text className="text-white/20 font-label text-[8px] text-center uppercase tracking-widest">
                    BYPASSING_WILL_IMPACT_YOUR_WEEKLY_CONSISTENCY_METRICS
                </Text>
            </View>

            {/* QR Scanner Modal Overlay */}
            {isScanning && (
                <View className="absolute inset-0 bg-black z-[100]">
                    <CameraView
                        onBarcodeScanned={handleBarCodeScanned}
                        style={StyleSheet.absoluteFillObject}
                        barcodeScannerSettings={{
                            barcodeTypes: ["qr"],
                        }}
                    >
                        <View className="flex-1 items-center justify-center">
                            <View className="w-64 h-64 border-2 border-white/50 border-dashed" />
                            <TouchableOpacity 
                                onPress={() => setIsScanning(false)}
                                className="mt-20 bg-white px-8 py-4"
                            >
                                <Text className="text-black font-headline font-black text-xs uppercase">ABORT_SCAN</Text>
                            </TouchableOpacity>
                        </View>
                    </CameraView>
                </View>
            )}
        </SafeAreaView>
    );
};
