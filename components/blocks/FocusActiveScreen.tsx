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
    const [isEmailSending, setIsEmailSending] = useState(false);
    const [emailCooldown, setEmailCooldown] = useState(0);

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

    const [isOnBreak, setIsOnBreak] = useState(session.isOnBreak || false);
    const [breakTimeLeft, setBreakTimeLeft] = useState<number>(0);

    const refreshSession = useCallback(async () => {
        const active = await FocusStorageService.getActiveSession();
        if (!active) {
            onEnd();
            return;
        }

        // Sync main countdown
        const totalEffectivePause = active.accumulatedBreakMs || 0;
        const activeElapsedMs = Date.now() - active.startTime - totalEffectivePause;
        const activeElapsedMins = activeElapsedMs / (1000 * 60);
        setTimeLeft(Math.max(0, active.durationMins - activeElapsedMins));

        // Sync break status
        setIsOnBreak(active.isOnBreak || false);
        if (active.isOnBreak && active.breakStartTime) {
            const breakElapsedMs = Date.now() - active.breakStartTime;
            const breakDurationMs = (active.timedBreaks?.durationMins || 0) * 60 * 1000;
            setBreakTimeLeft(Math.max(0, (breakDurationMs - breakElapsedMs) / 1000));
        }

        setBreaksLeft(
            active.timedBreaks?.enabled 
                ? (active.timedBreaks.allowedCount - (active.timedBreaks.usedCount || 0)) 
                : 0
        );
    }, [onEnd]);

    useEffect(() => {
        const timer = setInterval(refreshSession, 1000);
        refreshSession();
        return () => clearInterval(timer);
    }, [refreshSession]);

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
        if (breaksLeft <= 0 || isOnBreak) return;
        
        const updated = await FocusStorageService.toggleBreak();
        if (updated) {
            refreshSession();
            await ScreenTime.setBlockedApps([], "BREAK_PROTOCOL_ACTIVE", "REST_PERIOD");
        }
    };

    const handleEndBreak = async () => {
        if (!isOnBreak) return;
        const updated = await FocusStorageService.toggleBreak();
        if (updated) {
            refreshSession();
        }
    };

    const handleEmailRequest = async () => {
        if (emailCooldown > 0 || isEmailSending) return;

        const email = session.strictnessConfig.emailAddress;
        const newOtp = Math.floor(1000 + Math.random() * 9000).toString();
        
        setIsEmailSending(true);
        
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
                    to: [email],
                    subject: 'MOM TEST: UNLINK VERIFICATION CODE',
                    html: `
                        <div style="font-family: sans-serif; padding: 20px; color: #000;">
                            <h2 style="letter-spacing: 2px;">UNLINK_PROTOCOL</h2>
                            <p>Your verification code to terminate the focus session is:</p>
                            <h1 style="font-size: 48px; letter-spacing: 15px; margin: 30px 0;">${newOtp}</h1>
                            <p style="color: #666; font-size: 12px;">This code was requested via the Mom Test protocol.</p>
                        </div>
                    `
                })
            });

            if (response.ok) {
                setGeneratedOtp(newOtp);
                setShowOtpInput(true);
                setEmailCooldown(60); // 60s cooldown
            } else {
                const err = await response.json();
                alert(`API_ERROR: ${err.message || 'FAILED_TO_SEND_EMAIL'}`);
            }
        } catch (error) {
            alert("NETWORK_ERROR: CHECK_CONNECTION");
        } finally {
            setIsEmailSending(false);
        }
    };

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (emailCooldown > 0) {
            timer = setInterval(() => {
                setEmailCooldown(prev => prev - 1);
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [emailCooldown]);

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
        return `${h > 0 ? h + ':' : ''}${h > 0 && m < 10 ? '0' + m : m}:${s < 10 ? '0' : ''}${s}`;
    };

    const formatSeconds = (totalSecs: number) => {
        const m = Math.floor(totalSecs / 60);
        const s = Math.floor(totalSecs % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
        <SafeAreaView className="flex-1 bg-black">
            <Animated.View 
                entering={FadeIn.duration(800)}
                className="flex-1 items-center justify-center px-8"
            >
                <View className="items-center mb-12">
                    <Ionicons name={isOnBreak ? "cafe" : "shield-checkmark"} size={60} color={isOnBreak ? "#3b82f6" : "white"} />
                    <Text className={`font-headline font-black text-xs uppercase tracking-[0.4em] mt-4 ${isOnBreak ? 'text-blue-500' : 'text-white/40'}`}>
                        {isOnBreak ? 'BREAK_PROTOCOL_ACTIVE' : 'FOCUS_PROTOCOL_ENGAGED'}
                    </Text>
                </View>

                <View className="items-center mb-16">
                    <Text className={`font-headline font-black tracking-tighter ${isOnBreak ? 'text-blue-500 text-5xl' : 'text-white text-7xl'}`}>
                        {isOnBreak ? formatSeconds(breakTimeLeft) : formatTime(timeLeft)}
                    </Text>
                    <Text className="text-white/20 font-label text-[10px] uppercase tracking-widest mt-2">
                        {isOnBreak ? 'TIME_UNTIL_RE_ENFORCEMENT' : 'REMAINING_RESTRICTION_PERIOD'}
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
                {session.timedBreaks?.enabled && (
                    <TouchableOpacity
                        onPress={isOnBreak ? handleEndBreak : handleTimedBreak}
                        disabled={!isOnBreak && breaksLeft <= 0}
                        className={`h-16 border items-center justify-center ${isOnBreak ? 'border-white/20 bg-white/5' : 'border-blue-500/30 bg-blue-500/10'} ${!isOnBreak && breaksLeft <= 0 ? 'opacity-20' : 'opacity-100'}`}
                    >
                        <Text className={`font-headline font-black text-sm uppercase tracking-widest ${isOnBreak ? 'text-white' : 'text-blue-500'}`}>
                            {isOnBreak 
                                ? 'END_BREAK_NOW' 
                                : `TAKE_BREAK (${breaksLeft}_REMAINING)`}
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
                                disabled={isEmailSending || emailCooldown > 0}
                                className={`h-16 border ${isEmailSending || emailCooldown > 0 ? 'border-white/10 bg-white/2' : 'border-white/20 bg-white/5'} items-center justify-center`}
                            >
                                <Text className={`font-headline font-black text-sm uppercase tracking-widest ${isEmailSending || emailCooldown > 0 ? 'text-white/20' : 'text-white'}`}>
                                    {isEmailSending 
                                        ? 'SENDING_PROTOCOL...' 
                                        : emailCooldown > 0 
                                            ? `COOLDOWN (${emailCooldown}S)` 
                                            : 'REQUEST_UNBLOCK_VIA_EMAIL'}
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
