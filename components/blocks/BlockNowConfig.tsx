import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, Image, Dimensions, StyleSheet, Platform, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    runOnJS,
    useAnimatedProps,
    withRepeat,
    withSequence,
    withTiming
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Svg, { Circle, Path, G } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { AppSelectionModal } from './AppSelectionModal';
import { StrictModeModal, StrictModeLevel } from './StrictModeModal';
import { isAdminActive, requestAdmin, deactivateAdmin } from '../../modules/screen-time';

const { width } = Dimensions.get('window');
// Increased Dial size now that scrolling is re-enabled
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

// --- Circular Duration Picker ---

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
        <View className="items-center justify-center my-6">
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
                        <Text className="text-white font-headline font-black text-4xl tracking-tighter">
                            {formatDuration(duration)}
                        </Text>
                    </View>

                    <Animated.View
                        style={[
                            thumbStyle,
                            {
                                position: 'absolute',
                                left: CENTER - 14,
                                top: CENTER - 14,
                                width: 28,
                                height: 28,
                                borderRadius: 14,
                                backgroundColor: 'white',
                                borderWidth: 6,
                                borderColor: 'black',
                                ...Platform.select({
                                    ios: { shadowColor: '#fff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 5 },
                                    android: { elevation: 10 }
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

    // Toggles for new features
    const [blockShorts, setBlockShorts] = useState({ youtube: false, instagram: false });
    const [blockUninstall, setBlockUninstall] = useState(false);

    const [isAppSelectionVisible, setIsAppSelectionVisible] = useState(false);
    const [isStrictModeVisible, setIsStrictModeVisible] = useState(false);

    // Sync blockUninstall state with actual native admin status
    useEffect(() => {
        if (Platform.OS === 'android') {
            setBlockUninstall(isAdminActive());
        }
    }, []);

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
        } else {
            deactivateAdmin();
        }
        // Native status might change asynchronously, but we toggle UI immediately for responsiveness
        setBlockUninstall(value);
    };

    const hasAppsSelected = selectedApps.length > 0;

    // Animated Glow logic
    const glowValue = useSharedValue(0.2);
    useEffect(() => {
        glowValue.value = withRepeat(withSequence(withTiming(0.8, { duration: 1500 }), withTiming(0.2, { duration: 1500 })), -1, true);
    }, []);

    const glowStyle = useAnimatedStyle(() => ({
        opacity: glowValue.value
    }));

    return (
        <View className="flex-1 bg-transparent">
            <BottomSheetScrollView
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 60 }}
            >
                <View className="px-1">
                    {/* Identification */}
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

                    {/* Circular Picker */}
                    <CircularDurationPicker duration={duration} onSelectDuration={setDuration} />

                    {/* Premium Full Box Configuration */}
                    <View className="gap-3 mt-2">
                        {/* Box 1: Target Apps */}
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => setIsAppSelectionVisible(true)}
                            className={`border p-5 ${hasAppsSelected ? 'bg-white/5 border-white' : 'bg-black border-white/10'}`}
                            style={{ elevation: hasAppsSelected ? 4 : 0 }}
                        >
                            <View className="flex-row justify-between items-center mb-4">
                                <Text className="text-white font-headline font-black text-xs uppercase tracking-widest">TARGETS</Text>
                                <Ionicons name="apps-outline" size={16} color="white" />
                            </View>

                            <View className="flex-row items-center">
                                {hasAppsSelected ? (
                                    <View className="flex-row flex-1 items-center">
                                        <View className="flex-row">
                                            {selectedApps.slice(0, 4).map((app, index) => (
                                                <Image
                                                    key={app.id}
                                                    source={{ uri: app.icon }}
                                                    style={{ marginLeft: index === 0 ? 0 : -16 }}
                                                    className="w-11 h-11 rounded-full bg-black border-2 border-black"
                                                />
                                            ))}
                                        </View>
                                        {selectedApps.length > 4 && (
                                            <View className="ml-2 bg-white/10 px-2.5 py-1 rounded-full">
                                                <Text className="text-white font-label text-[10px] uppercase">+{selectedApps.length - 4}</Text>
                                            </View>
                                        )}
                                        <Text className="text-white/40 font-label text-[9px] uppercase ml-auto">
                                            {selectedApps.length} APPS
                                        </Text>
                                    </View>
                                ) : (
                                    <View className="flex-row items-center">
                                        <Ionicons name="add-circle-outline" size={24} color="rgba(255,255,255,0.1)" />
                                        <Text className="text-white/20 font-label text-[10px] uppercase italic ml-3">NO_TARGETS_SELECTED</Text>
                                    </View>
                                )}
                            </View>
                        </TouchableOpacity>

                        {/* Box 2: Strictness (with Glow) */}
                        <View className="relative">
                            <Animated.View style={[{ position: 'absolute', top: -5, left: -5, right: -5, bottom: -5, borderRadius: 5, padding: 5 }, glowStyle]}>
                                <LinearGradient colors={['rgba(255,255,255,0.2)', 'transparent']} style={{ flex: 1, borderRadius: 5 }} />
                            </Animated.View>
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => setIsStrictModeVisible(true)}
                                className="border p-5 bg-black border-white/20 relative"
                            >
                                <View className="flex-row justify-between items-center mb-4">
                                    <View className="flex-row items-center gap-2">
                                        <Text className="text-white font-headline font-black text-xs uppercase tracking-widest">STRICTNESS</Text>
                                        <View className="bg-white/10 px-1.5 py-0.5 rounded">
                                            <Text className="text-white/40 font-label text-[8px]">PREMIUM</Text>
                                        </View>
                                    </View>
                                    <Ionicons name="shield-checkmark-outline" size={16} color="white" />
                                </View>

                                <View className="flex-row items-center gap-3">
                                    <View className="w-11 h-11 rounded-full bg-white/5 items-center justify-center border border-white/10">
                                        <Ionicons name={getModeIcon(strictMode)} size={24} color="white" />
                                    </View>
                                    <View>
                                        <Text className="text-white font-headline font-black text-sm uppercase tracking-tight">
                                            {getModeTitle(strictMode)}
                                        </Text>
                                        <Text className="text-white/40 font-label text-[9px] uppercase mt-0.5 tracking-widest">
                                            TAP_TO_RECONFIGURE
                                        </Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        </View>

                        {/* Section: Block Shorts */}
                        <View className="mt-4 mb-2">
                            <Text className="text-white/20 font-headline font-black text-[10px] uppercase tracking-[0.3em] mb-3">BLOCK_SHORTS</Text>
                            <View className="border border-white/10 bg-black/40 p-1">
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={() => setBlockShorts(p => ({ ...p, youtube: !p.youtube }))}
                                    className="flex-row items-center p-4 border-b border-white/5"
                                >
                                    <View className="w-10 h-10 rounded-full bg-[#FF0000] items-center justify-center mr-4">
                                        <Ionicons name="logo-youtube" size={20} color="white" />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-white font-headline font-black text-xs uppercase tracking-tight">YOUTUBE_SHORTS</Text>
                                        <Text className="text-white/40 font-label text-[8px] uppercase mt-1">ENABLES_SURGICAL_BLOCK</Text>
                                    </View>
                                    <Switch
                                        value={blockShorts.youtube}
                                        onValueChange={(v) => setBlockShorts(p => ({ ...p, youtube: v }))}
                                        trackColor={{ false: '#222', true: '#fff' }}
                                        thumbColor={blockShorts.youtube ? '#000' : '#444'}
                                    />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={() => setBlockShorts(p => ({ ...p, instagram: !p.instagram }))}
                                    className="flex-row items-center p-4"
                                >
                                    <View className="w-10 h-10 rounded-full bg-[#E1306C] items-center justify-center mr-4">
                                        <Ionicons name="logo-instagram" size={20} color="white" />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-white font-headline font-black text-xs uppercase tracking-tight">INSTAGRAM_REELS</Text>
                                        <Text className="text-white/40 font-label text-[8px] uppercase mt-1">RESTRICT_SHORT_FORM_VIDEO</Text>
                                    </View>
                                    <Switch
                                        value={blockShorts.instagram}
                                        onValueChange={(v) => setBlockShorts(p => ({ ...p, instagram: v }))}
                                        trackColor={{ false: '#222', true: '#fff' }}
                                        thumbColor={blockShorts.instagram ? '#000' : '#444'}
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Section: General */}
                        <View className="mt-4">
                            <Text className="text-white/20 font-headline font-black text-[10px] uppercase tracking-[0.3em] mb-3">GENERAL_PROTECTION</Text>
                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() => handleToggleUninstall(!blockUninstall)}
                                className="border border-white/10 bg-black/40 p-4 flex-row items-center"
                            >
                                <View className="w-10 h-10 rounded-full bg-white/5 items-center justify-center mr-4 border border-white/10">
                                    <Ionicons name="lock-closed-outline" size={20} color="white" />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-white font-headline font-black text-xs uppercase tracking-tight">PROTECT_UNINSTALL</Text>
                                    <Text className="text-white/40 font-label text-[8px] uppercase mt-1">PREVENT_APP_REMOVAL_DURING_SESSION</Text>
                                </View>
                                <Switch
                                    value={blockUninstall}
                                    onValueChange={handleToggleUninstall}
                                    trackColor={{ false: '#222', true: '#fff' }}
                                    thumbColor={blockUninstall ? '#000' : '#444'}
                                />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </BottomSheetScrollView>

            {/* Powerful CTA */}
            <View className="px-1 pt-2">
                <TouchableOpacity
                    className={`h-22 items-center justify-center no-corners ${hasAppsSelected ? 'bg-white' : 'bg-white/10 border border-white/10'}`}
                    activeOpacity={0.9}
                    onPress={hasAppsSelected ? onBack : () => setIsAppSelectionVisible(true)}
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

            {/* Modals */}
            <AppSelectionModal
                visible={isAppSelectionVisible}
                onClose={() => setIsAppSelectionVisible(false)}
                selectedApps={selectedApps.map(a => a.id)}
                onToggleApp={toggleAppSelection}
            />

            <StrictModeModal
                visible={isStrictModeVisible}
                onClose={() => setIsStrictModeVisible(false)}
                currentMode={strictMode}
                onConfirm={(mode) => setStrictMode(mode)}
            />
        </View>
    );
};
