import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, Dimensions, StyleSheet, Platform, AppState, AppStateStatus, Modal, Switch, Alert, Linking, DeviceEventEmitter } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import QRCode from 'react-native-qrcode-svg';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    runOnJS,
    useAnimatedProps,
    withRepeat,
    withTiming,
    FadeIn,
    FadeInDown,
    Layout
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Svg, { Circle, Path, G } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { FocusCoachConfig, ScrollingProtocolConfig } from './FocusCoachConfig';
import { SecurityConfig } from './SecurityConfig';
import { AIBetaTeaser } from './AIBetaTeaser';
import { StrictModeModal, StrictModeLevel } from './StrictModeModal';
import {
    isAdminActive,
    requestAdmin,
    deactivateAdmin,
    getSelectionCount,
    activateShield,
    deactivateShield,
    FamilyPickerView,
    getEngineHealth,
    requestAccessibilityPermission,
    openAppInfoSettings
} from '../../modules/screen-time';
import { PermissionBanner } from '../ui/PermissionBanner';
import { ModernToggle } from '../ui/ModernToggle';
import { ConfigRow } from '../ui/ConfigRow';
import { SignatureDeploymentModal } from './SignatureDeploymentModal';
import SignatureService from '../../services/SignatureService';
import { FocusStorageService } from '../../services/FocusStorageService';
import { TimedBreaksConfig } from './TimedBreaksConfig';
import { AppSelectionModal } from './AppSelectionModal';

const { width } = Dimensions.get('window');
const DIAL_SIZE = width * 0.5;
const STROKE_WIDTH = 20;
const RADIUS = (DIAL_SIZE - STROKE_WIDTH) / 2;
const CENTER = DIAL_SIZE / 2;

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface BlockNowConfigProps {
    onBack: () => void;
}

const getModeIcon = (mode: StrictModeLevel) => {
    switch (mode) {
        case 'normal': return 'pause-circle-outline';
        case 'qr_code': return 'qrcode-scan';
        case 'mom_test': return 'account-lock-outline';
        case 'money': return 'cash-lock';
    }
};

const getModeTitle = (mode: StrictModeLevel) => {
    switch (mode) {
        case 'normal': return 'NORMAL (EASY)';
        case 'qr_code': return 'QR CODE (MED)';
        case 'mom_test': return 'MOM TEST (HARD)';
        case 'money': return 'MONEY CHALLENGE (EXTREME)';
    }
};

const formatDuration = (mins: number) => {
    if (mins < 60) return `${mins}M`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}H ${m}M` : `${h}H`;
};

const CircularDurationPicker = React.memo(({ duration, onSelectDuration }: { duration: number, onSelectDuration: (d: number) => void }) => {
    const initialAngle = (duration / 480) * 2 * Math.PI;
    const rotation = useSharedValue(initialAngle);
    const lastValidDuration = useSharedValue(duration);

    useEffect(() => {
        const newAngle = (duration / 480) * 2 * Math.PI;
        if (Math.abs(rotation.value - newAngle) > 0.01) {
            rotation.value = withSpring(newAngle, { damping: 20, stiffness: 100 });
        }
    }, [duration]);

    const animatedProps = useAnimatedProps(() => {
        const angle = rotation.value;
        const x = CENTER + RADIUS * Math.sin(angle);
        const y = CENTER - RADIUS * Math.cos(angle);
        const largeArcFlag = angle > Math.PI ? 1 : 0;
        const d = `M ${CENTER} ${CENTER - RADIUS} A ${RADIUS} ${RADIUS} 0 ${largeArcFlag} 1 ${x} ${y}`;
        return { d };
    });

    const thumbStyle = useAnimatedStyle(() => {
        const angle = rotation.value;
        return {
            transform: [
                { translateX: RADIUS * Math.sin(angle) },
                { translateY: -RADIUS * Math.cos(angle) }
            ]
        };
    });

    const gesture = Gesture.Pan()
        .onUpdate((event) => {
            const x = event.x - CENTER;
            const y = event.y - CENTER;
            let angle = Math.atan2(x, -y);
            if (angle < 0) angle += 2 * Math.PI;
            rotation.value = angle;
            const newMins = Math.round((angle / (2 * Math.PI)) * 480);
            const snappedMins = Math.max(5, Math.round(newMins / 5) * 5);
            if (snappedMins !== lastValidDuration.value) {
                lastValidDuration.value = snappedMins;
                runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
                runOnJS(onSelectDuration)(snappedMins);
            }
        });

    return (
        <View className="items-center justify-center my-2">
            <GestureDetector gesture={gesture}>
                <View style={{ width: DIAL_SIZE, height: DIAL_SIZE }}>
                    <Svg width={DIAL_SIZE} height={DIAL_SIZE}>
                        <G rotation="0" origin={`${CENTER}, ${CENTER}`}>
                            <Circle
                                cx={CENTER}
                                cy={CENTER}
                                r={RADIUS}
                                stroke="rgba(255,255,255,0.05)"
                                strokeWidth={STROKE_WIDTH}
                                fill="none"
                            />
                            <AnimatedPath
                                animatedProps={animatedProps}
                                stroke="white"
                                strokeWidth={STROKE_WIDTH}
                                fill="none"
                                strokeLinecap="round"
                            />
                        </G>
                    </Svg>
                    <View
                        pointerEvents="none"
                        style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}
                    >
                        <Text className="text-white font-headline font-black text-3xl tracking-tighter">
                            {formatDuration(duration)}
                        </Text>
                    </View>
                    <Animated.View
                        style={[
                            thumbStyle,
                            {
                                position: 'absolute',
                                left: CENTER - 12,
                                top: CENTER - 12,
                                width: 24,
                                height: 24,
                                borderRadius: 12,
                                backgroundColor: 'white',
                                borderWidth: 5,
                                borderColor: 'black',
                                ...Platform.select({
                                    ios: { shadowColor: '#fff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 5 },
                                    android: { elevation: 8 }
                                })
                            }
                        ]}
                    />
                </View>
            </GestureDetector>
        </View>
    );
});

export const BlockNowConfig = ({ onBack }: BlockNowConfigProps) => {
    const [selectedApps, setSelectedApps] = useState<{ id: string, icon: string }[]>([]);
    const [duration, setDuration] = useState<number>(60);
    const [strictMode, setStrictMode] = useState<StrictModeLevel>('normal');
    const [strictConfig, setStrictConfig] = useState<any>(null);
    const [title, setTitle] = useState('');
    const [blockUninstall, setBlockUninstall] = useState(false);
    const [allowTimedBreaks, setAllowTimedBreaks] = useState(false);
    const [breakTimes, setBreakTimes] = useState(1);
    const [breakDuration, setBreakDuration] = useState(5);
    const [isAppSelectionVisible, setIsAppSelectionVisible] = useState(false);
    const [scrollingConfig, setScrollingConfig] = useState<ScrollingProtocolConfig>({
        enabled: false,
        youtube: { enabled: false, intentGate: true, hideShorts: true, finiteFeed: true },
        instagram: { enabled: false, intentGate: true, dmSafeZone: true, finiteFeed: true }
    });
    const [isStrictModeVisible, setIsStrictModeVisible] = useState(false);
    const [isFamilyPickerVisible, setIsFamilyPickerVisible] = useState(false);
    const [isQrModalVisible, setIsQrModalVisible] = useState(false);
    const [generatedQrData, setGeneratedQrData] = useState<string | null>(null);
    const [pendingSession, setPendingSession] = useState<any>(null);
    const [nativeIosCount, setNativeIosCount] = useState(0);
    const [hasAccessibility, setHasAccessibility] = useState(true);



    const syncNativeStatus = useCallback(async () => {
        // iOS: Always sync selection count
        if (Platform.OS === 'ios') {
            setNativeIosCount(getSelectionCount());
        }
        // Android: Sync Admin status & Accessibility
        if (Platform.OS === 'android') {
            setBlockUninstall(isAdminActive());
            const health = await getEngineHealth();
            setHasAccessibility(health.accessibility);
        }
    }, []);

    useEffect(() => {
        // Initial sync only on mount for Android
        if (Platform.OS === 'android') {
            setBlockUninstall(isAdminActive());
        }
        syncNativeStatus();

        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active') {
                syncNativeStatus();
            }
        });
        return () => subscription.remove();
    }, [syncNativeStatus]);

    const toggleAppSelection = useCallback((appId: string, appIcon: string) => {
        setSelectedApps(prev => {
            const exists = prev.find(a => a.id === appId);
            if (exists) {
                return prev.filter(a => a.id !== appId);
            } else {
                return [...prev, { id: appId, icon: appIcon }];
            }
        });
    }, []);



    const handleInitiate = async () => {
        const hasApps = Platform.OS === 'ios' ? nativeIosCount > 0 : selectedApps.length > 0;
        const hasSurgical = scrollingConfig.youtube.enabled || scrollingConfig.instagram.enabled;


        if (!hasApps && !hasSurgical) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert("REQUIRED SELECTION", "PLEASE SELECT TARGET APPS OR ENABLE SURGICAL BLOCKING TO PROCEED.");
            return;
        }

        // 1. Check for Android Admin if Protect Uninstall is requested
        if (Platform.OS === 'android' && blockUninstall && !isAdminActive()) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Alert.alert(
                "PERMISSION REQUIRED",
                "PROTECT UNINSTALL REQUIRES DEVICE ADMIN PERMISSION. PLEASE ENABLE IT IN THE SECURITY SECTION.",
                [{ text: "OK" }]
            );
            return;
        }

        const sessionPayload = {
            id: Math.random().toString(36).substring(7),
            title: title || "ALLOW_FOCUS_SESSION",
            type: 'block_now' as const,
            durationMins: duration,
            apps: selectedApps.map(a => a.id),
            appIcons: selectedApps.map(a => a.icon),
            scrollingProtocol: scrollingConfig,
            strictnessConfig: {
                mode: strictMode,
                isUninstallProtected: blockUninstall,
                ...strictConfig
            },
            timedBreaks: {
                enabled: allowTimedBreaks,
                allowedCount: breakTimes,
                durationMins: breakDuration,
                usedCount: 0
            },
            startTime: Date.now()
        };

        if (strictMode === 'qr_code') {
            const qrData = `UNLINK_SESSION_${Date.now()}`;
            setGeneratedQrData(qrData);
            setPendingSession(sessionPayload);
            setIsQrModalVisible(true);
            return;
        }

        await finalizeSession(sessionPayload);
    };

    const finalizeSession = async (sessionPayload: any) => {        // --- STORE_TEMPLATE_LAYER ---
        try {
            await FocusStorageService.saveBlock(sessionPayload);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            // Return to dashboard
            DeviceEventEmitter.emit('UNLINK REFRESH DATA');
            onBack();
        } catch (e) {
            console.error('Template Storage Failure:', e);
        }
    };


    const hasAppsSelected = Platform.OS === 'ios' ? nativeIosCount > 0 : selectedApps.length > 0;

    const glowValue = useSharedValue(0);
    useEffect(() => {
        glowValue.value = withRepeat(
            withTiming(1, { duration: 2500 }),
            -1,
            true
        );
    }, []);

    const glowStyle = useAnimatedStyle(() => ({
        opacity: 0.1 + glowValue.value * 0.2,
        transform: [{ scale: 1 + glowValue.value * 0.03 }]
    }));

    return (
        <View className="flex-1 bg-transparent">
            <BottomSheetScrollView
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 60 }}
            >
                <View className="px-1">
                    <View className="mb-4">
                        <Text className="text-white font-headline font-black text-[10px] capitalize tracking-[0.3em] mb-1">SESSION NAME </Text>
                        <TextInput
                            value={title}
                            onChangeText={setTitle}
                            placeholder="Deep Focus Session"
                            placeholderTextColor="rgba(255,255,255,0.1)"
                            className="text-white font-headline font-black text-xl border-b border-white/20 pb-2 mt-1"
                            selectionColor="white"
                        />
                    </View>

                    <CircularDurationPicker duration={duration} onSelectDuration={setDuration} />

                    <View className="gap-2.5 mt-2">
                        {/* Box 1: Target Apps */}
                        <View className="border border-white/10 bg-white/5">
                            <ConfigRow
                                title="TARGETS"
                                icon="apps-outline"
                                iconLibrary="Ionicons"
                                onPress={() => Platform.OS === 'ios' ? setIsFamilyPickerVisible(true) : setIsAppSelectionVisible(true)}
                                selectedApps={selectedApps}
                                nativeCount={nativeIosCount}
                            />

                            <ConfigRow
                                title="STRICTNESS"
                                icon={getModeIcon(strictMode) as any}
                                subtitle={getModeTitle(strictMode)}
                                onPress={() => setIsStrictModeVisible(true)}
                            />
                        </View>

                        <TimedBreaksConfig
                            enabled={allowTimedBreaks}
                            onEnabledChange={setAllowTimedBreaks}
                            breakCount={breakTimes}
                            onBreakCountChange={setBreakTimes}
                            breakDuration={breakDuration}
                            onBreakDurationChange={setBreakDuration}
                        />

                        <FocusCoachConfig
                            config={scrollingConfig}
                            onConfigChange={setScrollingConfig}
                            hasAccessibility={hasAccessibility}
                        />

                        <SecurityConfig
                            enabled={blockUninstall}
                            onEnabledChange={setBlockUninstall}
                        />

                        <AIBetaTeaser />
                    </View>
                </View>
            </BottomSheetScrollView>

            <View className="px-6 py-6 bg-[#0a0a0a]">
                <TouchableOpacity
                    className={`h-16 items-center justify-center ${hasAppsSelected ? 'bg-white' : 'bg-white/10'} border border-white`}
                    activeOpacity={0.9}
                    onPress={hasAppsSelected ? handleInitiate : () => Platform.OS === 'ios' ? setIsFamilyPickerVisible(true) : setIsAppSelectionVisible(true)}
                >
                    <View className="items-center">
                        <Text className={`font-headline font-black text-xs uppercase tracking-[0.3em] ${hasAppsSelected ? 'text-black' : 'text-white'}`}>
                            {hasAppsSelected ? 'SAVE TO LIBRARY' : 'SELECT TARGETS'}
                        </Text>
                    </View>
                </TouchableOpacity>
            </View>

            {/* Android Picker */}
            <AppSelectionModal

                visible={isAppSelectionVisible}
                onClose={() => setIsAppSelectionVisible(false)}
                selectedApps={selectedApps.map(a => a.id)}
                onToggleApp={toggleAppSelection}
            />



            {/* iOS Native Picker Modal */}
            {Platform.OS === 'ios' && (
                <Modal
                    visible={isFamilyPickerVisible}
                    animationType="slide"
                    presentationStyle="pageSheet"
                    onRequestClose={() => {
                        setIsFamilyPickerVisible(false);
                        syncNativeStatus();
                    }}
                >
                    <FamilyPickerView style={{ flex: 1 }} />
                    <TouchableOpacity
                        style={{ position: 'absolute', top: 20, right: 20, zIndex: 100 }}
                        onPress={() => {
                            setIsFamilyPickerVisible(false);
                            syncNativeStatus();
                        }}
                    >
                        <Text className="text-blue-500 font-bold">Done</Text>
                    </TouchableOpacity>
                </Modal>
            )}

            <StrictModeModal
                visible={isStrictModeVisible}
                onClose={() => setIsStrictModeVisible(false)}
                currentMode={strictMode}
                onConfirm={(mode, config) => {
                    setStrictMode(mode);
                    setStrictConfig(config);
                }}
            />

            {/* Signature Protocol Deployment */}
            <SignatureDeploymentModal
                visible={isQrModalVisible}
                qrData={generatedQrData}
                title="FOCUS_SIGNATURE"
                onCancel={() => setIsQrModalVisible(false)}
                onSuccess={async (assetId) => {
                    const finalSession = {
                        ...pendingSession,
                        strictnessConfig: {
                            ...pendingSession.strictnessConfig,
                            assetId
                        }
                    };
                    await finalizeSession(finalSession);
                }}
            />


        </View>
    );
};
