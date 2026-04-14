import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, Image, Dimensions, StyleSheet, Platform, AppState, AppStateStatus, Modal } from 'react-native';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    runOnJS,
    useAnimatedProps,
    withRepeat,
    withTiming
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
    FamilyPickerView 
} from '../../modules/screen-time';
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
        case 'interruptions': return 'stop-circle-outline';
        case 'limit': return 'time-outline';
        case 'extreme': return 'close-circle-outline';
    }
};

const getModeTitle = (mode: StrictModeLevel) => {
    switch (mode) {
        case 'normal': return 'NORMAL (EASY)';
        case 'interruptions': return 'INTERRUPTIONS (MED)';
        case 'limit': return 'UNBLOCK LIMIT (HARD)';
        case 'extreme': return 'ALWAYS BLOCK (EXTREME)';
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
    const [title, setTitle] = useState('');
    const [blockShorts, setBlockShorts] = useState({ youtube: false, instagram: false });
    const [blockUninstall, setBlockUninstall] = useState(false);
    const [isAppSelectionVisible, setIsAppSelectionVisible] = useState(false);
    const [isStrictModeVisible, setIsStrictModeVisible] = useState(false);
    const [isFamilyPickerVisible, setIsFamilyPickerVisible] = useState(false);
    const [nativeIosCount, setNativeIosCount] = useState(0);

    const syncNativeStatus = useCallback(() => {
        if (Platform.OS === 'android') {
            setBlockUninstall(isAdminActive());
        } else if (Platform.OS === 'ios') {
            setNativeIosCount(getSelectionCount());
        }
    }, []);

    useEffect(() => {
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
        if (Platform.OS !== 'android') return;
        if (value) {
            requestAdmin();
            setBlockUninstall(true);
        } else {
            deactivateAdmin();
            setBlockUninstall(false);
        }
    };

    const handleInitiate = async () => {
        const hasApps = Platform.OS === 'ios' ? nativeIosCount > 0 : selectedApps.length > 0;
        const hasSurgical = blockShorts.youtube || blockShorts.instagram;
        
        if (!hasApps && !hasSurgical) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            alert("REQUIRED_FIELD: PLEASE_SELECT_TARGETS_OR_SURGICAL_BLOCKS");
            return;
        }

        const session = {
            id: Math.random().toString(36).substring(7),
            title: title || "NEW_SESSION",
            durationMins: duration,
            apps: selectedApps.map(a => a.id),
            appIcons: selectedApps.map(a => a.icon),
            surgicalFlags: blockShorts,
            strictMode: strictMode,
            startTime: Date.now()
        };

        if (Platform.OS === 'ios') {
            activateShield();
            await FocusStorageService.startSession(session);
        } else {
            // Android users save to library first, then 'Play' from Blocks tab
            await FocusStorageService.saveBlock(session);
        }
        
        onBack();
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
                        <Text className="text-white/20 font-headline font-black text-[10px] uppercase tracking-[0.3em] mb-1">IDENTIFICATION</Text>
                        <TextInput
                            value={title}
                            onChangeText={setTitle}
                            placeholder="NEW_SESSION_PROTOCOL"
                            placeholderTextColor="rgba(255,255,255,0.1)"
                            className="text-white font-headline font-black text-xl uppercase"
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
                                                        className="w-9 h-9 rounded-full bg-black border-2 border-black"
                                                    />
                                                ))}
                                                {selectedApps.length > 4 && (
                                                    <View className="ml-2 bg-white/10 px-2 py-1 rounded-full">
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
                                    { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 8 },
                                    glowStyle
                                ]}
                            >
                                <LinearGradient 
                                    colors={['rgba(255,255,255,0.08)', 'transparent']} 
                                    style={{ flex: 1, borderRadius: 8, marginHorizontal: 2 }} 
                                />
                            </Animated.View>
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => setIsStrictModeVisible(true)}
                                className="border border-white/40 p-5 bg-black rounded-lg"
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
                                        <View className="bg-white/10 px-1.5 py-0.5 rounded border border-white/10">
                                            <Text className="text-white/40 font-label text-[8px] font-bold">PREMIUM</Text>
                                        </View>
                                    </View>
                                    <Ionicons name="shield-checkmark-outline" size={16} color="white" />
                                </View>
                                <View className="flex-row items-center gap-3">
                                    <View className="w-10 h-10 rounded-full bg-white/5 items-center justify-center border border-white/10">
                                        <Ionicons name={getModeIcon(strictMode)} size={20} color="white" />
                                    </View>
                                    <View>
                                        <Text className="text-white font-headline font-black text-sm uppercase tracking-tight">
                                            {getModeTitle(strictMode)}
                                        </Text>
                                        <Text className="text-white/40 font-label text-[8px] uppercase mt-0.5 tracking-widest">
                                            TAP_TO_RECONFIGURE
                                        </Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        </View>

                        <View className="mt-4 mb-2">
                            <Text className="text-white/20 font-headline font-black text-[10px] uppercase tracking-[0.3em] mb-3">BLOCK_SHORTS</Text>
                            {Platform.OS === 'android' ? (
                                <View className="border border-white/10 bg-black/40 p-1">
                                    <TouchableOpacity
                                        activeOpacity={0.8}
                                        onPress={() => setBlockShorts(p => ({ ...p, youtube: !p.youtube }))}
                                        className="flex-row items-center p-4 border-b border-white/5"
                                    >
                                        <View className="w-9 h-9 rounded-full bg-white/5 items-center justify-center mr-4 border border-white/10">
                                            <MaterialIcons name="bolt" size={20} color="white" />
                                        </View>
                                        <View className="flex-1">
                                            <Text className="text-white font-headline font-black text-[11px] uppercase tracking-tight">YOUTUBE_SHORTS</Text>
                                            <Text className="text-white/40 font-label text-[8px] uppercase mt-1">ENABLES_SURGICAL_BLOCK</Text>
                                        </View>
                                        <ModernToggle 
                                            value={blockShorts.youtube} 
                                            onValueChange={(v) => setBlockShorts(p => ({ ...p, youtube: v }))} 
                                        />
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        activeOpacity={0.8}
                                        onPress={() => setBlockShorts(p => ({ ...p, instagram: !p.instagram }))}
                                        className="flex-row items-center p-4"
                                    >
                                        <View className="w-9 h-9 rounded-full bg-white/5 items-center justify-center mr-4 border border-white/10">
                                            <MaterialCommunityIcons name="movie-filter" size={20} color="white" />
                                        </View>
                                        <View className="flex-1">
                                            <Text className="text-white font-headline font-black text-[11px] uppercase tracking-tight">INSTAGRAM_REELS</Text>
                                            <Text className="text-white/40 font-label text-[8px] uppercase mt-1">RESTRICT_SHORT_FORM_VIDEO</Text>
                                        </View>
                                        <ModernToggle 
                                            value={blockShorts.instagram} 
                                            onValueChange={(v) => setBlockShorts(p => ({ ...p, instagram: v }))} 
                                        />
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View className="border border-white/10 bg-black/40 p-5 rounded-lg">
                                    <View className="flex-row items-center gap-2 mb-2">
                                        <Ionicons name="information-circle-outline" size={14} color="rgba(255,255,255,0.4)" />
                                        <Text className="text-white/40 font-headline font-black text-[9px] uppercase tracking-widest">IOS_PLATFORM_NOTICE</Text>
                                    </View>
                                    <Text className="text-white/30 font-label text-[10px] leading-4 italic">
                                        iOS does not permit surgical blocking of in-app features like Shorts. 
                                        Please use the dedicated <Text className="text-white/60 font-bold">Socials</Text> tab for refined platform control.
                                    </Text>
                                </View>
                            )}
                        </View>

                        <View className="mt-4">
                            <Text className="text-white/20 font-headline font-black text-[10px] uppercase tracking-[0.3em] mb-3">GENERAL_PROTECTION</Text>
                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() => handleToggleUninstall(!blockUninstall)}
                                className="border border-white/10 bg-black/40 p-4 flex-row items-center"
                            >
                                <View className="w-9 h-9 rounded-full bg-white/5 items-center justify-center mr-4 border border-white/10">
                                    <Ionicons name="lock-closed-outline" size={18} color="white" />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-white font-headline font-black text-[11px] uppercase tracking-tight">PROTECT_UNINSTALL</Text>
                                    <Text className="text-white/40 font-label text-[8px] uppercase mt-1">PREVENT_APP_REMOVAL_DURING_SESSION</Text>
                                </View>
                                <ModernToggle 
                                    value={blockUninstall} 
                                    onValueChange={handleToggleUninstall} 
                                />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </BottomSheetScrollView>

            <View className="px-1 pt-2">
                <TouchableOpacity
                    className={`h-22 items-center justify-center no-corners ${hasAppsSelected ? 'bg-white' : 'bg-white/10 border border-white/10'}`}
                    activeOpacity={0.9}
                    onPress={hasAppsSelected ? handleInitiate : () => Platform.OS === 'ios' ? setIsFamilyPickerVisible(true) : setIsAppSelectionVisible(true)}
                >
                    <View className="items-center">
                        <Text className={`font-headline font-black text-xl uppercase tracking-[0.5em] ${hasAppsSelected ? 'text-black' : 'text-white/20'}`}>
                            {hasAppsSelected ? 'INITIATE' : 'SELECT_TARGETS'}
                        </Text>
                        {hasAppsSelected && (
                            <Text className="text-black/40 font-label text-[8px] uppercase tracking-widest mt-1">PREPARING_AIRTIGHT_LOCKDOWN</Text>
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
                onConfirm={(mode) => setStrictMode(mode)}
            />
        </View>
    );
};
