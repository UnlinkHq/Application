import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, Platform, AppState, RefreshControl, Image, InteractionManager } from 'react-native';
import { useBlocking } from '../../context/BlockingContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { ScreenTimeChart } from '../ScreenTimeChart';
import { ScreenTimeService } from '../../services/ScreenTimeService';
import { DailyUsage, MOCK_DATA } from '../../utils/screenTimeData';
import { DatePickerModal } from '../ui/DatePickerModal';
import { PermissionBanner } from '../ui/PermissionBanner';

// Optimized Sub-components
import { DateStrip } from '../home/DateStrip';
import { DailyOverview } from '../home/DailyOverview';
import { AppUsageList } from '../home/AppUsageList';

export const HomeScreen = () => {
    const navigation = useNavigation<any>();
    const { isStrict, triggerDemoBlock } = useBlocking();
    const isFocused = useIsFocused();

    const refreshCount = useRef(0);

    const [selectedDate, setSelectedDate] = useState(new Date().getDate());
    const [selectedHour, setSelectedHour] = useState<number | null>(null);
    const [selectedAppId, setSelectedAppId] = useState<string | null>(null);

    const [dailyData, setDailyData] = useState<DailyUsage | null>(null);
    const [hasPermission, setHasPermission] = useState(false);

    const [showDatePicker, setShowDatePicker] = useState(false);
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [currentMonth, setCurrentMonth] = useState(new Date().toLocaleString('default', { month: 'short' }));

    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        // Priority 1: Instant load from Interactions/Cache
        InteractionManager.runAfterInteractions(() => {
            checkPermissionAndLoadData(false);
        });

        let intervalId: NodeJS.Timeout;
        if (isFocused) {
            intervalId = setInterval(() => {
                if (AppState.currentState === 'active') {
                    checkPermissionAndLoadData(true);
                }
            }, 30 * 1000); // Check every 30s
        }

        const subscription = AppState.addEventListener('change', nextAppState => {
            if (nextAppState === 'active' && isFocused) {
                refreshCount.current += 1;
                checkPermissionAndLoadData(true);
            }
        });

        return () => {
            if (intervalId) clearInterval(intervalId);
            subscription.remove();
        };
    }, [selectedDate, isFocused]);

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
                <View className="h-16 flex-row items-center justify-between px-6 border-b border-white/10 bg-black">
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
                        <View className="w-8 h-8 rounded-full border border-white/20 overflow-hidden">
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
                            {/* Permission Banner */}
                            <View className="px-6 mb-8 mt-4">
                                <PermissionBanner />
                            </View>

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

                            {/* Section 03: Hourly Intensity Chart */}
                            <View className="px-6">
                                <ScreenTimeChart
                                    selectedDate={selectedDate}
                                    selectedHour={selectedHour}
                                    selectedAppId={selectedAppId}
                                    onSelectHour={setSelectedHour}
                                    dailyData={dailyData ?? undefined}
                                />
                            </View>

                            {/* Section 04: Consumption Label */}
                            <View className="px-6 mt-8">
                                <Text className="font-label text-xs uppercase tracking-[0.2em] text-[#919191] mb-8">
                                    {selectedHour !== null ? 'Hourly Intensity' : 'Most Used Apps'}
                                </Text>
                            </View>
                        </>
                    }
                    renderItem={({ item }) => (
                        <View className="px-6">
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
                        <View className="px-6 pb-12">
                            <Text className="text-[#919191] font-label text-center py-10 uppercase text-[10px] tracking-widest border border-white/5">
                                No active usage detected
                            </Text>
                        </View>
                    }
                    ListFooterComponent={
                        /* Aesthetic Separator */
                        <View className="flex-row justify-center py-10 opacity-20">
                            <Text className="font-label text-2xl text-white transform rotate-45">//</Text>
                        </View>
                    }
                    // Optimization Props
                    initialNumToRender={8}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                    removeClippedSubviews={Platform.OS === 'android'}
                />

                <DatePickerModal
                    visible={showDatePicker}
                    onClose={handleDatePickerClose}
                    selectedYear={currentYear}
                    selectedMonth={currentMonth}
                    onSelect={handleDatePickerSelect}
                />

            </View>
        </SafeAreaView>
    );
};
