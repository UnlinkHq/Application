import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, Image, Dimensions, StyleSheet, Platform, AppState, AppStateStatus, Modal, ScrollView, Switch, Alert, Linking } from 'react-native';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
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
import { AppSelectionModal } from './AppSelectionModal';
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
import { FocusStorageService } from '../../services/FocusStorageService';

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
    const [blockShorts, setBlockShorts] = useState({ youtube: false, instagram: false });
    const [blockUninstall, setBlockUninstall] = useState(false);
    const [allowTimedBreaks, setAllowTimedBreaks] = useState(false);
    const [breakTimes, setBreakTimes] = useState(1); // 1, 2, 3
    const [breakDuration, setBreakDuration] = useState(5); // 5, 10, 15
    const [isAppSelectionVisible, setIsAppSelectionVisible] = useState(false);
    const [isFocusCoachEnabled, setIsFocusCoachEnabled] = useState(false);
    const [isFocusCoachInfoVisible, setIsFocusCoachInfoVisible] = useState(false);
    const [focusCoachConfig, setFocusCoachConfig] = useState({
        ytGate: true,
        ytShelf: true,
        ytFinite: true,
        igGate: true,
        igDMs: true,
        igFinite: true
    });
    const [isStrictModeVisible, setIsStrictModeVisible] = useState(false);
    const [isFamilyPickerVisible, setIsFamilyPickerVisible] = useState(false);
    const [isQrModalVisible, setIsQrModalVisible] = useState(false);
    const [generatedQrData, setGeneratedQrData] = useState<string | null>(null);
    const [pendingSession, setPendingSession] = useState<any>(null);
    const [isAdminModalVisible, setIsAdminModalVisible] = useState(false);
    const [isQrSaving, setIsQrSaving] = useState(false);
    const [isQrSaved, setIsQrSaved] = useState(false);
    const [nativeIosCount, setNativeIosCount] = useState(0);
    const [hasAccessibility, setHasAccessibility] = useState(true);
    const [showAccessibilityDisclosure, setShowAccessibilityDisclosure] = useState(false);
    const [pendingToggle, setPendingToggle] = useState<(() => void) | null>(null);

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

    const handleToggleUninstall = (value: boolean) => {
        if (value && !isAdminActive()) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setIsAdminModalVisible(true);
            return;
        }
        setBlockUninstall(value);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const handleInitiate = async () => {
        const hasApps = Platform.OS === 'ios' ? nativeIosCount > 0 : selectedApps.length > 0;
        const hasSurgical = blockShorts.youtube || blockShorts.instagram;

        if (!hasApps && !hasSurgical) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            alert("REQUIRED_FIELD: PLEASE_SELECT_TARGETS_OR_SURGICAL_BLOCKS");
            return;
        }

        // 1. Check for Android Admin if Protect Uninstall is requested
        if (Platform.OS === 'android' && blockUninstall && !isAdminActive()) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            setIsAdminModalVisible(true);
            return;
        }

        const qrData = strictMode === 'qr_code' ? `UNLINK_${Date.now()}_${Math.random().toString(36).substring(7)}` : undefined;

        const session = {
            id: Math.random().toString(36).substring(7),
            title: title || "ALLOW_FOCUS_SESSION",
            durationMins: duration,
            apps: selectedApps.map(a => a.id),
            appIcons: selectedApps.map(a => a.icon),
            scrollingProtocol: {
                enabled: isFocusCoachEnabled && (blockShorts.youtube || blockShorts.instagram),
                youtube: {
                    enabled: isFocusCoachEnabled && blockShorts.youtube,
                    intentGate: focusCoachConfig.ytGate,
                    hideShorts: focusCoachConfig.ytShelf,
                    finiteFeed: focusCoachConfig.ytFinite
                },
                instagram: {
                    enabled: isFocusCoachEnabled && blockShorts.instagram,
                    intentGate: focusCoachConfig.igGate,
                    dmSafeZone: focusCoachConfig.igDMs,
                    finiteFeed: focusCoachConfig.igFinite
                }
            },
            strictnessConfig: {
                mode: strictMode,
                emailAddress: strictConfig?.emailAddress,
                qrCodeData: qrData,
                isUninstallProtected: blockUninstall
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
            setGeneratedQrData(qrData!);
            setPendingSession(session);
            setIsQrModalVisible(true);
            return;
        }

        await finalizeSession(session);
    };

    const qrRef = React.useRef<any>();

    const finalizeSession = async (session: any) => {
        // Change: Save to library instead of starting immediately
        await FocusStorageService.saveBlock(session);
        // SIGNAL: Trigger an instant refresh in the main list
        Platform.OS !== 'web' && require('react-native').DeviceEventEmitter.emit('UNLINK_REFRESH_DATA');
        onBack();
    };

    const handleSaveQR = useCallback(async () => {
        if (!generatedQrData) return null;
        setIsQrSaving(true);
        try {
            let { status } = await MediaLibrary.requestPermissionsAsync(true);
            if (status !== 'granted') {
                setIsQrSaving(false);
                return null;
            }
            return await proceedWithLocalSave();
        } catch (error: any) {
            console.error('Failed to save QR:', error);
            setIsQrSaving(false);
            return null;
        }
    }, [generatedQrData]);

    const proceedWithLocalSave = async (): Promise<string | null> => {
        if (!qrRef.current) return null;

        return new Promise<string | null>((resolve, reject) => {
            qrRef.current.toDataURL(async (data: string) => {
                try {
                    const fileUri = `${FileSystem.cacheDirectory}unlink_qr_${Date.now()}.png`;
                    await FileSystem.writeAsStringAsync(fileUri, data, {
                        encoding: 'base64',
                    });

                    const asset = await MediaLibrary.createAssetAsync(fileUri);

                    setIsQrSaved(true);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    setIsQrSaving(false);
                    resolve(asset.id);
                } catch (err) {
                    console.error('Failed to write QR file:', err);
                    setIsQrSaving(false);
                    reject(err);
                }
            });
        });
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
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => Platform.OS === 'ios' ? setIsFamilyPickerVisible(true) : setIsAppSelectionVisible(true)}
                            className={`border p-4 ${hasAppsSelected ? 'bg-white/5 border-white' : 'bg-black border-white/10'}`}
                            style={{
                                shadowColor: '#fff',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: hasAppsSelected ? 0.05 : 0,
                                shadowRadius: 10,
                                elevation: hasAppsSelected ? 2 : 0
                            }}
                        >
                            <View className="flex-row justify-between items-center mb-3">
                                <Text className="text-white font-headline font-black text-[10px] uppercase tracking-widest">TARGETS</Text>
                                <Ionicons name="apps-outline" size={14} color="white" />
                            </View>
                            <View className="flex-row items-center">
                                {hasAppsSelected ? (
                                    <View className="flex-row flex-1 items-center">
                                        {Platform.OS === 'android' ? (
                                            <View className="flex-row">
                                                {selectedApps.slice(0, 4).map((app, index) => (
                                                    <Image
                                                        key={app.id}
                                                        source={{ uri: app.icon }}
                                                        style={{ marginLeft: index === 0 ? 0 : -14 }}
                                                        className="w-9 h-9 bg-black border-2 border-black"
                                                    />
                                                ))}
                                                {selectedApps.length > 4 && (
                                                    <View className="ml-2 bg-white/10 px-2 py-1">
                                                        <Text className="text-white font-label text-[10px] uppercase">+{selectedApps.length - 4}</Text>
                                                    </View>
                                                )}
                                            </View>
                                        ) : (
                                            <View className="flex-row items-center">
                                                <View className="w-8 h-8 rounded bg-white/10 items-center justify-center border border-white/20">
                                                    <Ionicons name="shield-outline" size={14} color="white" />
                                                </View>
                                                <Text className="text-white font-headline font-black text-xs uppercase ml-3 tracking-tight">
                                                    SYSTEM_RESTRICTION_ACTIVE
                                                </Text>
                                            </View>
                                        )}
                                        <Text className="text-white/40 font-label text-[9px] uppercase ml-auto">
                                            {Platform.OS === 'ios' ? nativeIosCount : selectedApps.length} APPS
                                        </Text>
                                    </View>
                                ) : (
                                    <View className="flex-row items-center">
                                        <Ionicons name="add-circle-outline" size={18} color="rgba(255,255,255,0.1)" />
                                        <Text className="text-white/20 font-label text-[10px] uppercase italic ml-2">NO_TARGETS_DEFINED</Text>
                                    </View>
                                )}
                            </View>
                        </TouchableOpacity>

                        {/* Box 2: Strictness */}
                        <View className="py-[5px]">
                            <Animated.View
                                style={[
                                    { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
                                    glowStyle
                                ]}
                            >
                                <LinearGradient
                                    colors={['rgba(255,255,255,0.08)', 'transparent']}
                                    style={{ flex: 1, marginHorizontal: 2 }}
                                />
                            </Animated.View>
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => setIsStrictModeVisible(true)}
                                className="border border-white/40 p-5 bg-black"
                                style={{
                                    shadowColor: '#fff',
                                    shadowOffset: { width: 0, height: 0 },
                                    shadowOpacity: 0.1,
                                    shadowRadius: 10,
                                    elevation: 6
                                }}
                            >
                                <View className="flex-row justify-between items-center mb-4">
                                    <View className="flex-row items-center gap-2">
                                        <Text className="text-white font-headline font-black text-xs uppercase tracking-widest">STRICTNESS</Text>
                                        <View className="bg-white/10 px-1.5 py-0.5 border border-white/10">
                                            <Text className="text-white/40 font-label text-[10px] font-bold">PREMIUM</Text>
                                        </View>
                                    </View>
                                    <Ionicons name="shield-checkmark-outline" size={16} color="white" />
                                </View>
                                <View className="flex-row items-center gap-3">
                                    <View className="w-10 h-10 bg-white/5 items-center justify-center border border-white/10">
                                        <MaterialCommunityIcons name={getModeIcon(strictMode)} size={20} color="white" />
                                    </View>
                                    <View>
                                        <Text className="text-white font-headline font-black text-sm uppercase tracking-tight">
                                            {getModeTitle(strictMode)}
                                        </Text>

                                        <Text className="text-white/40 font-label text-[10px] mt-1">Select the strictness level for this session</Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        </View>

                        {/* Box 3: Timed Breaks */}
                        <View className="mt-2">
                            <View className="border border-white/10 p-5 bg-black/20">
                                <View className="flex-row items-center justify-between mb-4">
                                    <View>
                                        <Text className="text-white font-headline font-black text-xs uppercase tracking-widest">Allow Timed Breaks</Text>
                                        <Text className="text-white/40 font-label text-[10px] mt-1">Temporary relief during sessions</Text>
                                    </View>
                                    <ModernToggle value={allowTimedBreaks} onValueChange={setAllowTimedBreaks} />
                                </View>

                                {allowTimedBreaks && (
                                    <Animated.View layout={Layout.springify()} entering={FadeIn} className="flex-row gap-4 mt-2">
                                        <View className="flex-1">
                                            <Text className="text-white/20 font-headline font-black text-[9px] uppercase tracking-widest mb-3">Break Count</Text>
                                            <View className="flex-row gap-2">
                                                {[1, 2, 3].map(num => (
                                                    <TouchableOpacity
                                                        key={num}
                                                        onPress={() => setBreakTimes(num)}
                                                        className={`flex-1 h-12 items-center justify-center border ${breakTimes === num ? 'bg-white border-white' : 'border-white/20 bg-transparent'}`}
                                                    >
                                                        <Text className={`font-headline font-black text-xs ${breakTimes === num ? 'text-black' : 'text-white/40'}`}>{num}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        </View>
                                        <View className="flex-1">
                                            <Text className="text-white/20 font-headline font-black text-[9px] uppercase tracking-widest mb-3">Minutes per break</Text>
                                            <View className="flex-row gap-2">
                                                {[5, 10, 15].map(min => (
                                                    <TouchableOpacity
                                                        key={min}
                                                        onPress={() => setBreakDuration(min)}
                                                        className={`flex-1 h-12 items-center justify-center border ${breakDuration === min ? 'bg-white border-white' : 'border-white/20 bg-transparent'}`}
                                                    >
                                                        <Text className={`font-headline font-black text-xs ${breakDuration === min ? 'text-black' : 'text-white/40'}`}>{min}M</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        </View>
                                    </Animated.View>
                                )}
                            </View>
                        </View>


                        <View className="mt-4 mb-2">
                            <View className="flex-row items-center justify-between mb-3">
                                <View className="flex-row items-center gap-2">
                                    <Text className="text-white/20 font-headline font-black text-[10px] uppercase tracking-[0.3em]">FOCUS COACH</Text>
                                    <TouchableOpacity onPress={() => setIsFocusCoachInfoVisible(true)}>
                                        <Ionicons name="information-circle-outline" size={14} color="rgba(255,255,255,0.2)" />
                                    </TouchableOpacity>
                                </View>

                            </View>

                            <View className="border border-white/10 bg-black/40 overflow-hidden">
                                {/* Header Toggle */}
                                <TouchableOpacity
                                    activeOpacity={0.9}
                                    onPress={() => {
                                        if (Platform.OS === 'android' && !hasAccessibility && !isFocusCoachEnabled) {
                                            setPendingToggle(() => () => setIsFocusCoachEnabled(true));
                                            setShowAccessibilityDisclosure(true);
                                            return;
                                        }
                                        setIsFocusCoachEnabled(!isFocusCoachEnabled);
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                    }}
                                    className="flex-row items-center p-5 bg-white/5 border-b border-white/5"
                                >
                                    <View className="w-10 h-10 bg-white/5 items-center justify-center mr-4 border border-white/10">
                                        <MaterialCommunityIcons name="brain" size={20} color={isFocusCoachEnabled ? "#FFF" : "rgba(255,255,255,0.2)"} />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-white font-headline font-black text-xs uppercase tracking-tight">Block Scrolling</Text>
                                        <Text className="text-white/40 font-label text-[9px] mt-1">
                                            {isFocusCoachEnabled ? "Bypassing Hard Blocks for Coach Heuristics" : "Coach inactive. Standard blocks will apply."}
                                        </Text>
                                    </View>
                                    <View pointerEvents="none">
                                        <ModernToggle value={isFocusCoachEnabled} onValueChange={() => { }} />
                                    </View>
                                </TouchableOpacity>

                                {isFocusCoachEnabled && Platform.OS === 'android' && (
                                    <Animated.View entering={FadeInDown.duration(400)} className="p-1">
                                        {/* YouTube Section */}
                                        <View className="mb-1 p-3">
                                            <View className="flex-row items-center mb-3">
                                                <MaterialCommunityIcons name="youtube" size={18} color="#FF0000" />
                                                <Text className="text-white/40 font-headline font-black text-[9px] uppercase ml-2 tracking-widest">SCROLLING YOUTUBE</Text>
                                                <View className="flex-1 h-[1px] bg-white/5 ml-3" />
                                                <Switch
                                                    value={blockShorts.youtube}
                                                    onValueChange={(v) => {
                                                        if (Platform.OS === 'android' && v && !hasAccessibility) {
                                                            setPendingToggle(() => () => setBlockShorts(p => ({ ...p, youtube: true })));
                                                            setShowAccessibilityDisclosure(true);
                                                            return;
                                                        }
                                                        setBlockShorts(p => ({ ...p, youtube: v }));
                                                        if (v) {
                                                            setFocusCoachConfig(p => ({ ...p, ytGate: true, ytShelf: true, ytFinite: true }));
                                                        }
                                                    }}
                                                    trackColor={{ false: '#1A1A1A', true: '#FF0000' }}
                                                    thumbColor="#FFF"
                                                />
                                            </View>

                                            {blockShorts.youtube && (
                                                <View className="ml-7 gap-3">
                                                    <TouchableOpacity
                                                        onPress={() => setFocusCoachConfig(p => ({ ...p, ytGate: !p.ytGate }))}
                                                        className="flex-row items-center justify-between"
                                                    >
                                                        <Text className={`text-[10px] font-headline font-black uppercase ${focusCoachConfig.ytGate ? 'text-white' : 'text-white/20'}`}>[ ] 3S CALM INTENT GATE</Text>
                                                        <Ionicons name={focusCoachConfig.ytGate ? "checkbox" : "square-outline"} size={16} color={focusCoachConfig.ytGate ? "white" : "rgba(255,255,255,0.2)"} />
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        onPress={() => setFocusCoachConfig(p => ({ ...p, ytShelf: !p.ytShelf }))}
                                                        className="flex-row items-center justify-between"
                                                    >
                                                        <Text className={`text-[10px] font-headline font-black uppercase ${focusCoachConfig.ytShelf ? 'text-white' : 'text-white/20'}`}>[ ] HIDE SHORTS SHELF (GPU)</Text>
                                                        <Ionicons name={focusCoachConfig.ytShelf ? "checkbox" : "square-outline"} size={16} color={focusCoachConfig.ytShelf ? "white" : "rgba(255,255,255,0.2)"} />
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        onPress={() => setFocusCoachConfig(p => ({ ...p, ytFinite: !p.ytFinite }))}
                                                        className="flex-row items-center justify-between"
                                                    >
                                                        <Text className={`text-[10px] font-headline font-black uppercase ${focusCoachConfig.ytFinite ? 'text-white' : 'text-white/20'}`}>[ ] AUTONOMOUS FINITE FEED</Text>
                                                        <Ionicons name={focusCoachConfig.ytFinite ? "checkbox" : "square-outline"} size={16} color={focusCoachConfig.ytFinite ? "white" : "rgba(255,255,255,0.2)"} />
                                                    </TouchableOpacity>

                                                    <View className="mt-1 flex-row items-center gap-2">
                                                        <MaterialCommunityIcons name="brain" size={14} color="rgba(255,255,255,0.3)" />
                                                        <Text className="text-[8px] text-white/30 font-label uppercase">Intelligent BrainRot Detection Active</Text>
                                                    </View>
                                                </View>
                                            )}
                                        </View>

                                        {/* Instagram Section */}
                                        <View className="mb-1 p-3">
                                            <View className="flex-row items-center mb-3">
                                                <MaterialCommunityIcons name="instagram" size={18} color="#E1306C" />
                                                <Text className="text-white/40 font-headline font-black text-[9px] uppercase ml-2 tracking-widest">SCROLLING INSTAGRAM</Text>
                                                <View className="flex-1 h-[1px] bg-white/5 ml-3" />
                                                <Switch
                                                    value={blockShorts.instagram}
                                                    onValueChange={(v) => {
                                                        if (Platform.OS === 'android' && v && !hasAccessibility) {
                                                            setPendingToggle(() => () => setBlockShorts(p => ({ ...p, instagram: true })));
                                                            setShowAccessibilityDisclosure(true);
                                                            return;
                                                        }
                                                        setBlockShorts(p => ({ ...p, instagram: v }));
                                                        if (v) {
                                                            setFocusCoachConfig(p => ({ ...p, igGate: true, igDMs: true, igFinite: true }));
                                                        }
                                                    }}
                                                    trackColor={{ false: '#1A1A1A', true: '#E1306C' }}
                                                    thumbColor="#FFF"
                                                />
                                            </View>

                                            {blockShorts.instagram && (
                                                <View className="ml-7 gap-3">
                                                    <TouchableOpacity
                                                        onPress={() => setFocusCoachConfig(p => ({ ...p, igGate: !p.igGate }))}
                                                        className="flex-row items-center justify-between"
                                                    >
                                                        <Text className={`text-[10px] font-headline font-black uppercase ${focusCoachConfig.igGate ? 'text-white' : 'text-white/20'}`}>[ ] 3S CALM INTENT GATE</Text>
                                                        <Ionicons name={focusCoachConfig.igGate ? "checkbox" : "square-outline"} size={16} color={focusCoachConfig.igGate ? "white" : "rgba(255,255,255,0.2)"} />
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        onPress={() => setFocusCoachConfig(p => ({ ...p, igDMs: !p.igDMs }))}
                                                        className="flex-row items-center justify-between"
                                                    >
                                                        <Text className={`text-[10px] font-headline font-black uppercase ${focusCoachConfig.igDMs ? 'text-white' : 'text-white/20'}`}>[ ] DM SAFE-ZONE PROTOCOL</Text>
                                                        <Ionicons name={focusCoachConfig.igDMs ? "checkbox" : "square-outline"} size={16} color={focusCoachConfig.igDMs ? "white" : "rgba(255,255,255,0.2)"} />
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        onPress={() => setFocusCoachConfig(p => ({ ...p, igFinite: !p.igFinite }))}
                                                        className="flex-row items-center justify-between"
                                                    >
                                                        <Text className={`text-[10px] font-headline font-black uppercase ${focusCoachConfig.igFinite ? 'text-white' : 'text-white/20'}`}>[ ] AUTONOMOUS FINITE FEED</Text>
                                                        <Ionicons name={focusCoachConfig.igFinite ? "checkbox" : "square-outline"} size={16} color={focusCoachConfig.igFinite ? "white" : "rgba(255,255,255,0.2)"} />
                                                    </TouchableOpacity>

                                                    <View className="mt-1 flex-row items-center gap-2">
                                                        <MaterialCommunityIcons name="brain" size={14} color="rgba(255,255,255,0.3)" />
                                                        <Text className="text-[8px] text-white/30 font-label uppercase">Intelligent BrainRot Detection Active</Text>
                                                    </View>
                                                </View>
                                            )}
                                        </View>
                                    </Animated.View>
                                )}

                                {isFocusCoachEnabled && Platform.OS === 'ios' && (
                                    <View className="p-5 border-t border-white/5">
                                        <Text className="text-white/30 font-label text-[10px] leading-4 italic">
                                            iOS does not permit surgical shielding.
                                            Focus Coach on iOS functions as a <Text className="text-white/60 font-bold">Hard Barrier</Text> with custom breathable shields.
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>

                        <View className="mt-4">
                            <Text className="text-white/20 font-headline font-black text-[10px] uppercase tracking-[0.3em] mb-3">GENERAL PROTECTION</Text>
                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() => handleToggleUninstall(!blockUninstall)}
                                className="border border-white/10 bg-black/40 p-4 flex-row items-center"
                            >
                                <View className="w-9 h-9 bg-white/5 items-center justify-center mr-4 border border-white/10">
                                    <Ionicons name="lock-closed-outline" size={18} color="white" />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-white font-headline font-black text-[11px] uppercase tracking-tight">PROTECT UNINSTALL</Text>
                                    <Text className="text-white/40 font-label text-[10px] mt-1">Prevent app removal during session</Text>
                                </View>
                                <View pointerEvents="none">
                                    <ModernToggle
                                        value={blockUninstall}
                                        onValueChange={() => { }}
                                    />
                                </View>
                            </TouchableOpacity>
                        </View>

                        <View className="mt-6 mb-4">
                            <View className="flex-row items-center gap-2 mb-3">
                                <Text className="text-white/40 font-headline font-black text-[9px] uppercase ml-1 tracking-widest">AI  PERSONALIZED</Text>
                                <View className="flex-1 h-[1px] bg-[#7851ff]/10 ml-2" />
                                <View className="bg-[#7851ff]/10 px-1.5 py-0.5 border border-[#7851ff]/20">
                                    <Text className="text-[#7851ff] font-label text-[8px] font-black">BETA</Text>
                                </View>
                            </View>

                            <View className="border border-[#7851ff]/20 bg-[#7851ff]/5 p-5 relative overflow-hidden">
                                <LinearGradient
                                    colors={['rgba(120, 81, 255, 0.1)', 'transparent']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={StyleSheet.absoluteFill}
                                />
                                <View className="flex-row items-start gap-4">
                                    <View className="w-10 h-10 bg-[#7851ff]/20 items-center justify-center border border-[#7851ff]/30">
                                        <MaterialCommunityIcons name="auto-fix" size={20} color="#7851ff" />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-white font-headline font-black text-sm uppercase tracking-tight">AI FOCUS COACH</Text>
                                        <Text className="text-white/40 font-label text-[10px] mt-1 leading-4">
                                            A personalized coach that learns your friction points and automatically adjusts blocks based on your cognitive load.
                                        </Text>
                                        <View className="flex-row items-center gap-2 mt-3">
                                            <View key="ai-dev-dot" className="w-1.5 h-1.5 rounded-full bg-[#7851ff] animate-pulse" />
                                            <Text className="text-[#7851ff] font-label text-[9px] font-black uppercase tracking-widest">DEVELOPMENT_IN_PROGRESS</Text>
                                        </View>
                                    </View>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>
            </BottomSheetScrollView>

            <View className="px-6 py-6 bg-[#0a0a0a]">
                <TouchableOpacity
                    className={`h-16 items-center justify-center ${hasAppsSelected ? 'bg-white' : 'bg-white/10'}`}
                    activeOpacity={0.9}
                    onPress={hasAppsSelected ? handleInitiate : () => Platform.OS === 'ios' ? setIsFamilyPickerVisible(true) : setIsAppSelectionVisible(true)}
                >
                    <View className="items-center">
                        <Text className={`font-headline font-black text-lg uppercase tracking-[0.2em] ${hasAppsSelected ? 'text-black' : 'text-white'}`}>
                            {hasAppsSelected ? 'Add Block' : 'Select Targets'}
                        </Text>
                        {hasAppsSelected && (
                            <Text className="text-black/40 font-label text-[10px] mt-1">Preparing airtight lockdown</Text>
                        )}
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

            {/* Focus Coach Tech Modal */}
            <Modal
                visible={isFocusCoachInfoVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setIsFocusCoachInfoVisible(false)}
            >
                <View className="flex-1 bg-black/90 justify-center px-10">
                    <View className="bg-[#0a0a0a] border border-white/20 p-8">
                        <View className="flex-row items-center mb-6">
                            <MaterialCommunityIcons name="brain" size={24} color="white" />
                            <Text className="text-white font-headline font-black text-lg uppercase tracking-widest ml-4">COACH_PROTOCOL_V2</Text>
                        </View>

                        <Text className="text-white/60 font-label text-[11px] leading-5 uppercase tracking-wide mb-6">
                            Surgical masking utilizes native GPU acceleration and Accessibility heuristics to detect in-app elements in real-time.
                            {"\n\n"}
                            <Text className="text-white font-bold">BYPASS_LOGIC:</Text> When active, the standard "Hard Wall" is replaced by a surgical entry gate. This allows you to check DMs without seeing reels.
                        </Text>

                        <TouchableOpacity
                            onPress={() => setIsFocusCoachInfoVisible(false)}
                            className="bg-white py-4 items-center"
                        >
                            <Text className="text-black font-headline font-black text-xs uppercase tracking-widest">ACKNOWLEDGE_DEEP_FOCUS</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Accessibility Disclosure Modal (Play Store Compliance) */}
            <Modal
                visible={showAccessibilityDisclosure}
                transparent
                animationType="slide"
            >
                <View className="flex-1 bg-black/95 justify-center px-8">
                    <View className="bg-[#0e0e0e] p-8 border border-white/20">
                        <View className="w-16 h-16 border border-white/10 items-center justify-center mb-8">
                            <Ionicons name="eye-outline" size={32} color="white" />
                        </View>

                        <Text className="text-white font-headline font-black text-2xl uppercase tracking-[0.2em] mb-4">
                            Surgical_Shield
                        </Text>

                        <Text className="text-white/60 font-label text-[11px] leading-5 mb-8">
                            Unlink uses the <Text className="text-white font-bold">Accessibility Service API</Text> to provide surgical shielding for YouTube and Instagram.
                            {"\n\n"}
                            This allows us to:
                            {"\n"}• Detect when you enter 'Shorts' or 'Reels' sections.
                            {"\n"}• Filter distracting content inside apps.
                            {"\n"}• Prevent app tampering during active sessions.
                            {"\n\n"}
                            <Text className="text-white/40 italic">We do NOT collect or store your personal data. All processing happens on-device.</Text>
                        </Text>

                        <View className="flex-row gap-4">
                            <TouchableOpacity
                                onPress={() => setShowAccessibilityDisclosure(false)}
                                className="flex-1 h-14 border border-white/10 items-center justify-center"
                            >
                                <Text className="text-white font-headline font-black text-[10px] uppercase tracking-widest">DECLINE</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => {
                                    setShowAccessibilityDisclosure(false);
                                    requestAccessibilityPermission();
                                    if (pendingToggle) pendingToggle();
                                }}
                                className="flex-1 h-14 bg-white items-center justify-center"
                            >
                                <Text className="text-black font-headline font-black text-[10px] uppercase tracking-widest">ENABLE_SHIELD</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

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

            {/* QR Generation Overlay */}
            {isQrModalVisible && (
                <Animated.View
                    entering={FadeIn}
                    style={StyleSheet.absoluteFill}
                    className="bg-black/95 items-center justify-center px-8 z-50"
                >
                    <View className="w-full bg-[#0a0a0a] border border-white/20 p-8 rounded-sm items-center">
                        <Text className="text-white font-headline font-black text-xl uppercase tracking-widest text-center mb-2">SIGNATURE_READY</Text>

                        <View className="flex-row items-center justify-center mb-6">
                            <Text className="text-[#72fe88] font-label text-[10px] uppercase tracking-widest text-center font-bold mr-2">
                                AUTOMATIC GALLERY STORAGE ACTIVE
                            </Text>
                            <TouchableOpacity onPress={() => Alert.alert(
                                "CLEANUP_PROTOCOL",
                                "1. SIGNATURE IS SAVED AUTOMATICALLY TO YOUR GALLERY.\n2. WHEN YOU DELETE THE BLOCK, UNLINK WILL PURGE THE MATCHING SIGNATURE AUTOMATICALLY."
                            )}>
                                <Ionicons name="information-circle-outline" size={14} color="#72fe88" />
                            </TouchableOpacity>
                        </View>

                        <View className="w-64 h-64 bg-white p-4 mb-6 items-center justify-center">
                            {generatedQrData && (
                                <QRCode
                                    value={generatedQrData}
                                    size={220}
                                    color="black"
                                    backgroundColor="white"
                                    logo={require('../../assets/icon.png')}
                                    logoSize={50}
                                    logoBackgroundColor="white"
                                    logoBorderRadius={10}
                                    getRef={(c) => (qrRef.current = c)}
                                />
                            )}
                        </View>

                        <View className="bg-white/5 border border-white/10 p-4 mb-8 flex-row items-center">
                            <Ionicons name="warning-outline" size={18} color="#FFD700" style={{ marginRight: 12 }} />
                            <Text className="flex-1 text-white/80 font-label text-[10px] uppercase tracking-wider leading-4">
                                IF THE QR IS LOST, YOU CAN'T STOP THE SESSION.{"\n"}
                                <Text className="text-white font-bold italic">REMEMBER THAT.</Text>
                            </Text>
                        </View>

                        <TouchableOpacity
                            onPress={async () => {
                                setIsQrSaving(true);
                                try {
                                    // 1. Await the Save and get the ID
                                    const assetId = await handleSaveQR(); 
                                    
                                    // 2. Construct the session with the actual assetId
                                    const sessionToSave = {
                                        ...pendingSession,
                                        strictnessConfig: {
                                            ...pendingSession.strictnessConfig,
                                            assetId: assetId
                                        }
                                    };

                                    // 3. Save to database
                                    await finalizeSession(sessionToSave);
                                    setIsQrModalVisible(false);
                                } catch (e) {
                                    console.error("Deploy failure:", e);
                                    setIsQrSaving(false);
                                }
                            }}
                            className="w-full h-14 bg-white items-center justify-center mb-3"
                            disabled={isQrSaving}
                        >
                            <Text className="text-black font-headline font-black text-[10px] uppercase tracking-widest">
                                {isQrSaving ? 'SAVING QR CODE TO GALLERY...' : 'CONFIRM DEPLOYMENT'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setIsQrModalVisible(false)}
                            className="w-full h-14 border border-white/20 items-center justify-center opacity-50"
                        >
                            <Text className="text-white font-headline font-black text-xs uppercase tracking-widest">CANCEL SIGNATURE</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            )}

            {/* Security Permission Overlay */}
            {isAdminModalVisible && (
                <Animated.View
                    entering={FadeIn}
                    style={StyleSheet.absoluteFill}
                    className="bg-black/95 items-center justify-center px-8 z-[60]"
                >
                    <View className="w-full bg-[#0a0a0a] border border-white/20 p-8 rounded-sm items-center">
                        <View className="w-16 h-16 bg-white/5 items-center justify-center mb-6 border border-white/10">
                            <MaterialCommunityIcons name="shield-lock-outline" size={32} color="white" />
                        </View>

                        <Text className="text-white font-headline font-black text-xl uppercase tracking-widest text-center mb-2">UNINSTALL_PROTECTION</Text>
                        <Text className="text-white/40 font-label text-[9px] uppercase tracking-widest mb-8 text-center italic">LEVEL_02_SECURITY_ENFORCEMENT</Text>

                        <View className="bg-white/5 border border-white/10 p-5 mb-8 w-full">
                            <View className="flex-row items-start mb-4">
                                <View className="w-5 h-5 bg-white/10 items-center justify-center mr-3 mt-0.5">
                                    <View className="w-1.5 h-1.5 bg-white" />
                                </View>
                                <Text className="flex-1 text-white/80 font-label text-[10px] uppercase tracking-wider leading-4">
                                    Enabling this prevents the app from being uninstalled while a focus session is active.
                                </Text>
                            </View>
                            <View className="flex-row items-start">
                                <View className="w-5 h-5 bg-white/10 items-center justify-center mr-3 mt-0.5">
                                    <View className="w-1.5 h-1.5 bg-white" />
                                </View>
                                <Text className="flex-1 text-white/80 font-label text-[10px] uppercase tracking-wider leading-4">
                                    You will be redirected to the Android system settings to grant <Text className="text-white font-bold">Device Administrator</Text> access.
                                </Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            onPress={() => {
                                setIsAdminModalVisible(false);
                                setBlockUninstall(true);
                                requestAdmin();
                            }}
                            className="w-full h-14 bg-white items-center justify-center mb-3"
                        >
                            <Text className="text-black font-headline font-black text-xs uppercase tracking-widest">GRANT_PERMISSION</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setIsAdminModalVisible(false)}
                            className="w-full h-14 border border-white/20 items-center justify-center"
                        >
                            <Text className="text-white font-headline font-black text-xs uppercase tracking-widest">ABORT_REQUEST</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            )}
        </View>
    );
};
