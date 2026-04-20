import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, Platform, AppState, RefreshControl, Image, InteractionManager } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useBlocking } from '../../context/BlockingContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { ScreenTimeChart } from '../ScreenTimeChart';
import { ScreenTimeService } from '../../services/ScreenTimeService';
import { DailyUsage, MOCK_DATA } from '../../utils/screenTimeData';
import { DatePickerModal } from '../ui/DatePickerModal';
import { PermissionBanner } from '../ui/PermissionBanner';
import { FocusStorageService, BlockSession } from '../../services/FocusStorageService';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { QRUnlockModal } from '../blocks/QRUnlockModal';
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
    const referenceTime = session.isOnBreak && session.breakStartTime ? session.breakStartTime : Date.now();
    const totalPauseMs = session.accumulatedBreakMs || 0;
    const elapsed = Math.floor((referenceTime - session.startTime - totalPauseMs) / (1000 * 60));
    const remaining = Math.max(0, session.durationMins - elapsed);
    const isOnBreak = !!session.isOnBreak;
    
    const breaksLeft = session.timedBreaks.enabled 
        ? session.timedBreaks.allowedCount - (session.timedBreaks.usedCount || 0)
        : 0;

    return (
        <View className={`p-4 mb-8 border-2 ${isOnBreak ? 'border-[#72fe88] bg-[#72fe88]/5' : 'border-white bg-white/5'}`}>
            {/* Context Header */}
            <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center gap-2">
                    <View className={`w-2 h-2 rounded-full ${isOnBreak ? 'bg-[#72fe88]' : 'bg-white'} ${!isOnBreak && 'animate-pulse'}`} />
                    <Text className={`font-headline font-black text-[10px] uppercase tracking-[0.15em] ${isOnBreak ? 'text-[#72fe88]' : 'text-white'}`}>
                        {isOnBreak ? `Break Active (${session.timedBreaks.durationMins}m)` : 'Protocol Engaged'}
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
                    <Text className="text-white font-headline font-black text-xl">{elapsed}m</Text>
                </View>
                <View className="w-[1px] bg-white/10 mx-3" />
                <View className="flex-1">
                    <Text className="text-white/30 font-label text-[8px] uppercase tracking-widest mb-1">Time to Target</Text>
                    <Text className={`font-headline font-black text-xl ${remaining < 5 && !isOnBreak ? 'text-red-500' : 'text-white'}`}>
                        {remaining}m
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

        return () => {
            if (intervalId) clearInterval(intervalId);
            subscription.remove();
        };
    }, [selectedDate, isFocused, activeConfigId]);

    // Auto-Resume Timer for Break Mode
    useEffect(() => {
        let breakTimer: NodeJS.Timeout;
        
        if (activeSession?.isOnBreak && activeSession.breakStartTime && activeSession.timedBreaks.durationMins > 0) {
            const totalBreakMs = activeSession.timedBreaks.durationMins * 60 * 1000;
            const elapsedBreakMs = Date.now() - activeSession.breakStartTime;
            const remainingBreakMs = Math.max(0, totalBreakMs - elapsedBreakMs);
            
            console.log(`--- [BREAK_TIMER] RESUMING_IN: ${Math.round(remainingBreakMs/1000)}s ---`);

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

                {/* Header - Optical Instrument Branding */}
                <View className="h-16 flex-row items-center justify-between px-3 border-b border-white/10 bg-black">
                    <View className="flex-row items-center gap-2">
                        <MaterialIcons name="link-off" size={24} color="white" />
                        <Text className="font-headline font-black text-2xl tracking-[0.2em] text-white">UNLINK</Text>
                    </View>
                    <View className="flex-row items-center gap-4">
                        <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
                            <MaterialIcons name="settings" size={20} color="white" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => checkPermissionAndLoadData(true)}>
                            <MaterialIcons name="refresh" size={24} color="#5d5f5f" />
                        </TouchableOpacity>
                        <View className="w-8 h-8 border border-white/20 overflow-hidden">
                            <Image
                                source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBUeGsbHEB8rtvHLaZZi0isp6NjjJYjjkG9WZgStcPLCpV4x7f6VkiU0LvcS7mkFKDkmJCC_dPdOdSpXat487hhko57AJqN0OW9PA9W8kHSLmj_AQ0WMApqSJ1kofXMfaBKFs_hzCf0YmqYXwaVzSMzAfvSINvlRYfXm3-f-ubC0i_tVkcyrhuD0HiBYF7pBeXl1uQ2uBsaE4ggCfi2pb8YhFnJyQBE7r9GZTh6alGDQLTaEwp5pP1pzP_nie35iYk-EQ3HTlA7gD8' }}
                                className="w-full h-full"
                            />
                        </View>
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
                    <QRUnlockModal
                        visible={isQrUnlockVisible}
                        onClose={() => setIsQrUnlockVisible(false)}
                        expectedData={activeSession.strictnessConfig.qrCodeData || ''}
                        onSuccess={() => {
                            setIsQrUnlockVisible(false);
                            handleStopActiveSession();
                        }}
                    />
                )}

            </View>
        </SafeAreaView>
    );
};
