import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, Platform, AppState, RefreshControl, Image, InteractionManager } from 'react-native';
import { SvgXml } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useBlocking } from '../../context/BlockingContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { ScreenTimeChart } from '../ScreenTimeChart';
import { ScreenTimeService } from '../../services/ScreenTimeService';
import { DailyUsage, MOCK_DATA } from '../../utils/screenTimeData';
import { DatePickerModal } from '../ui/DatePickerModal';
import { PermissionBanner } from '../ui/PermissionBanner';
import { FocusStorageService, BlockSession } from '../../services/FocusStorageService';
import { QRUnlockModal } from '../blocks/QRUnlockModal';
import { MomTestUnlockModal } from '../blocks/MomTestUnlockModal';
import { useSelection } from '../../context/SelectionContext';

// Optimized Sub-components
import { DateStrip } from '../home/DateStrip';
import { DailyOverview } from '../home/DailyOverview';
import { AppUsageList } from '../home/AppUsageList';

const ActiveProtocolStatus = ({
    session,
    onStop,
    onEmergencyStop,
    onToggleBreak
}: {
    session: BlockSession,
    onStop: () => void,
    onEmergencyStop: () => void,
    onToggleBreak: () => void
}) => {
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

    const formatTime = (totalMs: number) => {
        const totalSecs = Math.floor(totalMs / 1000);
        const h = Math.floor(totalSecs / 3600);
        const m = Math.floor((totalSecs % 3600) / 60);
        const s = totalSecs % 60;
        return `${h > 0 ? h + ':' : ''}${h > 0 && m < 10 ? '0' + m : m}:${s < 10 ? '0' : ''}${s}`;
    };

    const referenceTime = session.isOnBreak && session.breakStartTime ? session.breakStartTime : now;
    const totalPauseMs = session.accumulatedBreakMs || 0;
    
    // Elapsed since start
    const elapsedMs = Math.max(0, referenceTime - session.startTime - totalPauseMs);
    
    // Remaining in session
    const totalDurationMs = session.durationMins * 60 * 1000;
    const remainingMs = Math.max(0, totalDurationMs - elapsedMs);

    // Break remaining (if active)
    const breakDurationMs = (session.timedBreaks?.durationMins || 0) * 60 * 1000;
    const breakElapsedMs = session.isOnBreak && session.breakStartTime ? now - session.breakStartTime : 0;
    const breakRemainingMs = Math.max(0, breakDurationMs - breakElapsedMs);

    const isOnBreak = !!session.isOnBreak;

    const breaksLeft = session.timedBreaks.enabled
        ? session.timedBreaks.allowedCount - (session.timedBreaks.usedCount || 0)
        : 0;

    return (
        <View className={`p-4 mb-8 border-2 ${isOnBreak ? 'border-[#72fe88] bg-[#72fe88]/5' : 'border-white bg-white/5'}`}>
            {/* Context Header */}
            <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center gap-2">
                    <View className={`w-2 h-2 rounded-full ${isOnBreak ? 'bg-[#72fe88]' : 'bg-white'} ${!isOnBreak ? 'animate-pulse' : ''}`} />
                    <Text className={`font-headline font-black text-[10px] uppercase tracking-[0.15em] ${isOnBreak ? 'text-[#72fe88]' : 'text-white'}`}>
                        {isOnBreak ? `Break Active (${formatTime(breakRemainingMs)})` : 'Protocol Engaged'}
                    </Text>
                </View>
                <View className="px-2 py-0.5 border border-white/20">
                    <Text className="text-white/40 font-label text-[8px] uppercase tracking-tighter">
                        {session.strictnessConfig.mode.replace('_', ' ')} logic
                    </Text>
                </View>
            </View>

            {/* Session Identification */}
            <View className="mb-5">
                <Text className="text-white font-headline font-black text-xl uppercase tracking-tighter leading-tight">
                    {session.title || 'UNNAMED_PROTOCOL'}
                </Text>
            </View>

            {/* Target Visuals - App Icons & Surgical Indicators */}
            <View className="flex-row items-center gap-4 mb-6">
                <View className="flex-row">
                    {session.appIcons?.slice(0, 5).map((icon, idx) => (
                        <View key={idx} className="w-8 h-8 bg-black border border-white/20" style={{ marginLeft: idx === 0 ? 0 : -10, zIndex: 10 - idx }}>
                            <Image source={{ uri: icon }} className="w-full h-full opacity-60" />
                        </View>
                    ))}
                    {(session.appIcons?.length || 0) > 5 && (
                        <View className="w-8 h-8 bg-white/10 items-center justify-center border border-white/20" style={{ marginLeft: -10 }}>
                            <Text className="text-white font-label text-[8px]">+{session.appIcons!.length - 5}</Text>
                        </View>
                    )}
                </View>

                <View className="flex-1 flex-row flex-wrap gap-2">
                    {session.scrollingProtocol?.youtube?.enabled && (
                        <View className="px-2 py-0.5 border border-red-500/30 bg-red-500/5">
                            <Text className="text-red-500 font-label text-[7px] uppercase tracking-widest">YT_SHORTS</Text>
                        </View>
                    )}
                    {session.scrollingProtocol?.instagram?.enabled && (
                        <View className="px-2 py-0.5 border border-pink-500/30 bg-pink-500/5">
                            <Text className="text-pink-500 font-label text-[7px] uppercase tracking-widest">IG_REELS</Text>
                        </View>
                    )}
                </View>
            </View>

            {/* Core Metrics Grid */}
            <View className="flex-row mb-5 py-4 border-y border-white/10">
                <View className="flex-1">
                    <Text className="text-white/30 font-label text-[8px] uppercase tracking-widest mb-1">Session Elapsed</Text>
                    <Text className="text-white font-headline font-black text-xl">{formatTime(elapsedMs)}</Text>
                </View>
                <View className="w-[1px] bg-white/10 mx-3" />
                <View className="flex-1">
                    <Text className="text-white/30 font-label text-[8px] uppercase tracking-widest mb-1">Time to Target</Text>
                    <Text className={`font-headline font-black text-xl ${remainingMs < 300000 && !isOnBreak ? 'text-red-500' : 'text-white'}`}>
                        {formatTime(remainingMs)}
                    </Text>
                </View>
                <View className="w-[1px] bg-white/10 mx-3" />
                <View className="flex-1">
                    <Text className="text-white/30 font-label text-[8px] uppercase tracking-widest mb-1">Breaks Left</Text>
                    <Text className="text-white font-headline font-black text-xl">{breaksLeft}</Text>
                </View>
            </View>

            {/* Interaction Layer */}
            <View className="flex-row gap-2">
                {session.timedBreaks.enabled && (isOnBreak || breaksLeft > 0) && (
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={onToggleBreak}
                        className={`flex-1 h-11 items-center justify-center border ${isOnBreak ? 'bg-[#72fe88] border-[#72fe88]' : 'bg-transparent border-white/20'}`}
                    >
                        <Text className={`font-headline font-black text-[9px] uppercase tracking-widest ${isOnBreak ? 'text-black' : 'text-white'}`}>
                            {isOnBreak ? 'End Break' : 'Take Break'}
                        </Text>
                    </TouchableOpacity>
                )}

                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={onStop}
                    className="flex-1 h-11 items-center justify-center border border-white bg-white"
                >
                    <Text className="text-black font-headline font-black text-[9px] uppercase tracking-widest">Secure Stop</Text>
                </TouchableOpacity>
            </View>

            {/* Mission Override (Dev Only) */}
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={onEmergencyStop}
                className="mt-3 h-9 items-center justify-center border border-red-500/10 bg-red-500/5"
            >
                <Text className="text-red-500/60 font-headline font-black text-[8px] uppercase tracking-[0.25em]">
                    Emergency Force Stop
                </Text>
            </TouchableOpacity>
        </View>
    );
};

const logoSvg = `<svg width="574" height="200" viewBox="0 0 574 200" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M53.97 135.47C62.12 135.47 68.72 132.99 73.75 128.04C78.78 123.09 81.3 116.53 81.3 108.38V43.16H107.68V107.42C107.68 115.57 106.4 122.93 103.84 129.48C101.28 136.04 97.69 141.63 93.05 146.27C88.41 150.91 82.78 154.46 76.14 156.94C69.51 159.41 62.11 160.66 53.96 160.66C45.81 160.66 38.41 159.42 31.78 156.94C25.14 154.46 19.47 150.91 14.75 146.27C10.03 141.63 6.39003 136.04 3.84003 129.48C1.28003 122.93 0 115.57 0 107.42V43.16H26.38V108.38C26.38 116.53 28.94 123.09 34.05 128.04C39.16 133 45.8 135.47 53.95 135.47H53.97Z" fill="white"/>
<path d="M173.08 69.53C164.77 69.53 158.09 71.97 153.06 76.85C148.02 81.73 145.51 88.24 145.51 96.39V160.65H119.13V96.39C119.13 88.72 120.49 81.61 123.21 75.05C125.93 68.5 129.68 62.86 134.48 58.14C139.28 53.43 144.95 49.75 151.51 47.11C158.06 44.47 165.26 43.15 173.09 43.15C180.92 43.15 188.11 44.47 194.67 47.11C201.22 49.75 206.9 53.43 211.7 58.14C216.5 62.86 220.21 68.5 222.85 75.05C225.49 81.61 226.81 88.72 226.81 96.39V160.65H200.43V96.39C200.43 88.24 197.95 81.73 193 76.85C188.04 71.98 181.41 69.53 173.1 69.53H173.08Z" fill="white"/>
<path d="M240.03 0.0100098V101.9H266.41V0.0100098H240.03Z" fill="#919191"/>
<path d="M303.56 0C308.35 0 312.35 1.60002 315.55 4.80002C318.75 8.00002 320.35 11.99 320.35 16.79C320.35 21.59 318.75 25.58 315.55 28.78C312.35 31.98 308.36 33.58 303.56 33.58C298.76 33.58 294.77 31.99 291.57 28.78C288.37 25.58 286.78 21.59 286.78 16.79C286.78 11.99 288.38 8.00002 291.57 4.80002C294.77 1.60002 298.76 0 303.56 0Z" fill="#919191"/>
<path d="M290.37 45.56H316.75V136.31C316.75 143.59 310.85 149.5 303.56 149.5C296.28 149.5 290.37 143.6 290.37 136.31V45.56Z" fill="#919191"/>
<path d="M444.45 75.04C441.79 68.52 438.09 62.88 433.29 58.13C428.5 53.42 422.82 49.75 416.25 47.14C409.69 44.48 402.52 43.15 394.66 43.15C386.8 43.15 379.64 44.48 373.07 47.14C366.51 49.76 360.87 53.42 356.03 58.13C351.24 62.88 347.49 68.52 344.79 75.04C342.05 81.6 340.68 88.73 340.68 96.38V101.9H367.06V96.38C367.06 88.24 369.6 81.72 374.63 76.85C379.66 71.98 386.35 69.52 394.65 69.52C402.95 69.52 409.59 71.98 414.54 76.85C419.49 81.72 421.99 88.25 421.99 96.38V160.65H448.37V96.38C448.37 88.73 447.04 81.6 444.42 75.04H444.45Z" fill="#919191"/>
<path d="M558.86 45.56C558.86 57.23 556.38 67.58 551.43 76.61C546.47 85.64 539.44 92.96 530.33 98.55C534.8 101.75 539 105.74 542.92 110.54C546.84 115.34 550.71 121.09 554.55 127.81L573.49 160.66H543.04L527.93 134.52C525.21 129.89 522.53 126.01 519.9 122.89C517.27 119.78 514.43 117.26 511.39 115.34C508.35 113.42 505 112.06 501.32 111.26C497.64 110.46 493.41 110.06 488.61 110.06H487.41V160.65H461.03V0H487.41V84.16H489.81C503.39 84.16 513.91 80.77 521.34 73.97C528.77 67.17 532.49 57.7 532.49 45.56H558.87H558.86Z" fill="#919191"/>
<path d="M367.09 125.86V136.33C367.09 155.66 358.47 172.98 344.82 184.62C333.75 194.12 319.37 199.84 303.58 199.84H303.54C287.79 199.84 273.38 194.12 262.3 184.62C248.65 172.98 240.03 155.66 240.03 136.33V125.86H266.41V136.33C266.41 156.83 283.04 173.46 303.54 173.46H303.58C324.08 173.46 340.71 156.83 340.71 136.33V125.86H367.09Z" fill="#919191"/>
</svg>


`;

export const HomeScreen = () => {
    const navigation = useNavigation<any>();
    const { isStrict, triggerDemoBlock } = useBlocking();
    const { activeConfigId } = useSelection();
    const isFocused = useIsFocused();

    const refreshCount = useRef(0);

    const [selectedDate, setSelectedDate] = useState(new Date().getDate());
    const [selectedHour, setSelectedHour] = useState<number | null>(null);
    const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
    const [activeSession, setActiveSession] = useState<BlockSession | null>(null);

    const [dailyData, setDailyData] = useState<DailyUsage | null>(null);
    const [hasPermission, setHasPermission] = useState(false);

    const [showDatePicker, setShowDatePicker] = useState(false);
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [currentMonth, setCurrentMonth] = useState(new Date().toLocaleString('default', { month: 'short' }));

    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [brainrotScore, setBrainrotScore] = useState<number>(0);
    const [globalShortsCount, setGlobalShortsCount] = useState<number>(0);

    useEffect(() => {
        const checkActiveSession = async () => {
            const session = await FocusStorageService.getActiveSession();
            setActiveSession(session);
        };

        // Priority 1: Instant load from Interactions/Cache
        InteractionManager.runAfterInteractions(() => {
            checkPermissionAndLoadData(false);
            checkActiveSession();
        });

        let intervalId: NodeJS.Timeout;
        if (isFocused) {
            checkActiveSession();
            intervalId = setInterval(() => {
                if (AppState.currentState === 'active') {
                    checkPermissionAndLoadData(true);
                    checkActiveSession();
                }
            }, 30 * 1000); // Check every 30s
        }

        const subscription = AppState.addEventListener('change', nextAppState => {
            if (nextAppState === 'active' && isFocused) {
                refreshCount.current += 1;
                checkPermissionAndLoadData(true);
                checkActiveSession();
            }
        });

        // Instant Sync: Listen for native break toggles
        const { addNativeBreakListener } = require('../../modules/screen-time');
        const nativeSub = addNativeBreakListener?.((event: any) => {
            console.log('[HomeScreen] Received native break request sync');
            checkActiveSession();
        });

        return () => {
            if (intervalId) clearInterval(intervalId);
            subscription.remove();
            nativeSub?.remove?.();
        };
    }, [selectedDate, isFocused, activeConfigId]);

    // Auto-Resume Timer for Break Mode
    useEffect(() => {
        let breakTimer: NodeJS.Timeout;

        if (activeSession?.isOnBreak && activeSession.breakStartTime && activeSession.timedBreaks.durationMins > 0) {
            const totalBreakMs = activeSession.timedBreaks.durationMins * 60 * 1000;
            const elapsedBreakMs = Date.now() - activeSession.breakStartTime;
            const remainingBreakMs = Math.max(0, totalBreakMs - elapsedBreakMs);

            console.log(`--- [BREAK_TIMER] RESUMING_IN: ${Math.round(remainingBreakMs / 1000)}s ---`);

            if (remainingBreakMs === 0) {
                handleToggleBreak();
            } else {
                breakTimer = setTimeout(() => {
                    handleToggleBreak();
                }, remainingBreakMs);
            }
        }

        return () => {
            if (breakTimer) clearTimeout(breakTimer);
        };
    }, [activeSession?.isOnBreak, activeSession?.breakStartTime]);

    const checkPermissionAndLoadData = async (silent = false, forceRefresh = false) => {
        if (!silent && !dailyData) setIsLoading(true);

        if (Platform.OS === 'android') {
            try {
                const hasPerm = await ScreenTimeService.hasPermission();
                setHasPermission(hasPerm);

                if (hasPerm) {
                    const date = new Date();
                    date.setDate(selectedDate);

                    // 1. Instant Cache Render
                    const cachedData = ScreenTimeService.getCachedUsage(date.getTime());
                    if (cachedData) {
                        setDailyData(cachedData);
                    }

                    // 2. Background Revalidation (bypass cache if forceRefresh is true)
                    const data = await ScreenTimeService.getDailyUsage(date.getTime(), forceRefresh);

                    const brainrotData = await ScreenTimeService.getGlobalBrainrot();
                    if (brainrotData.score !== undefined) {
                        setBrainrotScore(brainrotData.score);
                        setGlobalShortsCount(brainrotData.shortsCount || 0);
                    }

                    // Only update state if data actually changed
                    // (prevents unnecessary re-renders)
                    setDailyData(prev => {
                        if (JSON.stringify(prev) === JSON.stringify(data)) return prev;
                        return data;
                    });

                    const { updateSDKState } = require('../../core/sdk/provider');
                    const totalMinutes = data?.totalDuration ? data.totalDuration / 60 : 0;
                    const appUsageMap = data?.apps ? Object.fromEntries(data.apps.map(a => [a.name, a.duration / 60])) : {};

                    updateSDKState({
                        todayTotalMinutes: totalMinutes,
                        appUsage: appUsageMap
                    });
                } else {
                    setDailyData(MOCK_DATA[selectedDate] ?? null);
                }
            } catch (error) {
                console.error('[HomeScreen] Error checking permission:', error);
            } finally {
                setIsLoading(false);
                setRefreshing(false);
            }
        } else {
            setDailyData(MOCK_DATA[14]);
            setIsLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        checkPermissionAndLoadData(true, true); // Silent = true, forceRefresh = true
    }, []);

    const handleRequestPermission = () => {
        ScreenTimeService.requestPermission();
    };

    const displayedApps = useMemo(() => {
        if (!dailyData) return [];

        // If an hour is selected, show apps specific to that hour
        if (selectedHour !== null) {
            if (dailyData.hourly && dailyData.hourly[selectedHour]) {
                return dailyData.hourly[selectedHour].apps;
            }
            return [];
        }

        // Default: Show all apps for the day (Most Used)
        // dailyData.apps is now pre-aggregated by ScreenTimeService
        if (dailyData.apps && dailyData.apps.length > 0) {
            return dailyData.apps;
        }

        return [];
    }, [selectedHour, dailyData]);

    const handleSelectDate = useCallback((date: number) => {
        setSelectedDate(date);
        setSelectedHour(null);
        setSelectedAppId(null);
    }, []);

    const handleOpenDatePicker = useCallback(() => {
        setShowDatePicker(true);
    }, []);

    const handleClearAppSelection = useCallback(() => {
        setSelectedAppId(null);
    }, []);

    const handleAppPress = useCallback((appId: string) => {
        if (isStrict) {
            triggerDemoBlock();
        } else {
            setSelectedAppId(prev => prev === appId ? null : appId);
        }
    }, [isStrict, triggerDemoBlock]);

    const handleDatePickerSelect = useCallback((y: number, m: string) => {
        setCurrentYear(y);
        setCurrentMonth(m);
        setShowDatePicker(false);
    }, []);

    const handleDatePickerClose = useCallback(() => {
        setShowDatePicker(false);
    }, []);

    const [isQrUnlockVisible, setIsQrUnlockVisible] = useState(false);
    const [isMomTestUnlockVisible, setIsMomTestUnlockVisible] = useState(false);

    const handleToggleBreak = async () => {
        const updated = await FocusStorageService.toggleBreak();
        if (updated) {
            setActiveSession(updated);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
            // Might have failed due to no breaks left
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
    };

    const handleStopActiveSession = async () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        await FocusStorageService.stopSession();
        setActiveSession(null);
    };

    const selectedAppDuration = useMemo(() => {
        if (!selectedAppId || !dailyData) return 0;
        return dailyData.hourly.reduce((acc, h) => {
            const app = h.apps.find(a => a.id === selectedAppId);
            return acc + (app ? app.duration : 0);
        }, 0);
    }, [selectedAppId, dailyData]);

    if (isLoading && !dailyData) {
        return (
            <SafeAreaView className="flex-1 bg-black items-center justify-center">
                <View className="items-center">
                    <MaterialIcons name="hourglass-empty" size={48} color="white" style={{ opacity: 0.2 }} />
                    <Text className="text-white text-lg font-headline font-black uppercase tracking-widest mt-6 mb-2">Analyzing Logic...</Text>
                    <Text className="text-[#919191] font-label text-[10px] uppercase tracking-[0.2em]">Executing Data Protocol</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-black" edges={['top']}>
            <View className="flex-1">

                {/* Engine Health Banner */}
                <PermissionBanner />

                {/* Header - Optical Instrument Branding */}
                <View className="h-20 flex-row items-center px-4 border-b border-white/5 bg-black">
                    {/* Left: Branding */}
                    <View className="flex-1 flex-row items-center">
                        <SvgXml xml={logoSvg} width={90} />
                    </View>

                    {/* Center: Status Pill */}
                    <View className="flex-row items-center bg-[#0d0d0d] px-4 py-2 border border-white/10 rounded-sm">
                        <View className="flex-row items-center gap-2">
                            <Text className="text-xl">{brainrotScore > 80 ? "🧟‍♂️" : (brainrotScore > 60 ? "😵‍💫" : (brainrotScore > 40 ? "😐" : (brainrotScore > 20 ? "🙂" : "😎")))}</Text>
                            <Text className="text-white font-headline font-black text-xs uppercase tracking-widest">{brainrotScore.toFixed(1)}%</Text>
                        </View>

                        <View className="w-[1px] h-4 bg-white/20 mx-4" />

                        <View className="flex-row items-center gap-2">
                            <MaterialCommunityIcons name="gesture-swipe-up" size={14} color="#919191" />
                            <Text className="text-white font-headline font-black text-xs uppercase tracking-widest">{globalShortsCount}</Text>
                        </View>
                    </View>

                    {/* Right: Actions */}
                    <View className="flex-1 flex-row items-center justify-end gap-3">
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => navigation.navigate('Settings')}
                            className="p-1 items-center justify-center"
                        >
                            <MaterialIcons name="settings" size={22} color="white" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => checkPermissionAndLoadData(true)}
                            className="p-1 items-center justify-center"
                        >
                            <MaterialCommunityIcons name="refresh" size={22} color="#919191" />
                        </TouchableOpacity>
                    </View>
                </View>

                <FlatList
                    data={displayedApps}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{ paddingBottom: 240 }}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
                    }
                    ListHeaderComponent={
                        <>
                            {/* Section 01: Date Picker */}
                            <DateStrip
                                currentYear={currentYear}
                                currentMonth={currentMonth}
                                selectedDate={selectedDate}
                                onSelectDate={handleSelectDate}
                                onOpenDatePicker={handleOpenDatePicker}
                            />



                            {/* Section 02: Main Overview */}
                            <DailyOverview
                                dailyData={dailyData ?? undefined}
                                selectedAppId={selectedAppId}
                                selectedAppDuration={selectedAppDuration}
                                onClearAppSelection={handleClearAppSelection}
                            />

                            {/* Active Protocol Status - Elevated Dashboard */}
                            {activeSession && (
                                <View className="px-3">
                                    <ActiveProtocolStatus
                                        session={activeSession}
                                        onToggleBreak={handleToggleBreak}
                                        onEmergencyStop={handleStopActiveSession}
                                        onStop={() => {
                                            if (activeSession.strictnessConfig.mode === 'qr_code') {
                                                setIsQrUnlockVisible(true);
                                            } else if (activeSession.strictnessConfig.mode === 'mom_test') {
                                                setIsMomTestUnlockVisible(true);
                                            } else {
                                                handleStopActiveSession();
                                            }
                                        }}
                                    />
                                </View>
                            )}

                            {/* Section 03: Hourly Intensity Chart */}
                            <View className="px-3">
                                <ScreenTimeChart
                                    selectedDate={selectedDate}
                                    selectedHour={selectedHour}
                                    selectedAppId={selectedAppId}
                                    onSelectHour={setSelectedHour}
                                    dailyData={dailyData ?? undefined}
                                />
                            </View>

                            {/* Section 04: Consumption Label */}
                            <View className="px-3 mt-8">
                                <Text className="font-label text-[10px] uppercase tracking-widest text-[#919191] mb-8">
                                    {selectedHour !== null ? 'HOURLY_INTENSITY' : 'HOME_USAGE_STATS'}
                                </Text>
                            </View>
                        </>
                    }
                    renderItem={({ item }) => (
                        <View className="px-3">
                            <AppUsageList
                                apps={[item]}
                                selectedAppId={selectedAppId}
                                onAppPress={handleAppPress}
                                isHourlyView={selectedHour !== null}
                                hideHeader
                            />
                        </View>
                    )}
                    ListEmptyComponent={
                        <View className="px-3 pb-12">
                            <Text className="text-[#919191] font-label text-center py-10 uppercase text-[10px] tracking-widest border border-white/5">
                                No active usage detected
                            </Text>
                        </View>
                    }
                    // Optimization Props
                    initialNumToRender={8}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                    removeClippedSubviews={Platform.OS === 'android'}
                    ListFooterComponent={
                        <View className="pb-32 px-3">
                            {/* Aesthetic Separator */}
                            <View className="flex-row justify-center py-10 opacity-20">
                                <Text className="font-label text-2xl text-white transform rotate-45">//</Text>
                            </View>
                        </View>
                    }
                />

                <DatePickerModal
                    visible={showDatePicker}
                    onClose={handleDatePickerClose}
                    selectedYear={currentYear}
                    selectedMonth={currentMonth}
                    onSelect={handleDatePickerSelect}
                />

                {activeSession && (
                    <>
                        <QRUnlockModal
                            visible={isQrUnlockVisible}
                            onClose={() => setIsQrUnlockVisible(false)}
                            expectedData={activeSession.strictnessConfig.qrCodeData || ''}
                            onSuccess={() => {
                                setIsQrUnlockVisible(false);
                                handleStopActiveSession();
                            }}
                        />
                        <MomTestUnlockModal
                            visible={isMomTestUnlockVisible}
                            onClose={() => setIsMomTestUnlockVisible(false)}
                            session={activeSession}
                            onSuccess={() => {
                                setIsMomTestUnlockVisible(false);
                                handleStopActiveSession();
                            }}
                        />
                    </>
                )}

            </View>
        </SafeAreaView>
    );
};
