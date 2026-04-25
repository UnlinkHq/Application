import React, { useState, useCallback, useEffect, useRef, useContext } from 'react';
import { View, Text, Switch, TouchableOpacity, Platform, Alert, Linking, StyleSheet, Dimensions, TextInput, DeviceEventEmitter, Image, Modal } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AppSelectionModal } from './AppSelectionModal';
import { StrictModeModal, StrictModeLevel } from './StrictModeModal';
import { SignatureDeploymentModal } from './SignatureDeploymentModal';
import { FocusStorageService } from '../../services/FocusStorageService';
import { SelectionContext } from '../../context/SelectionContext';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import QRCode from 'react-native-qrcode-svg';
import Animated, { FadeIn } from 'react-native-reanimated';
import { ModernToggle } from '../ui/ModernToggle';
import { ConfigRow } from '../ui/ConfigRow';
import {
    isAdminActive,
    getSelectionCount,
    FamilyPickerView
} from '../../modules/screen-time';

const { width } = Dimensions.get('window');

interface ScheduleBlockConfigProps {
    onBack: () => void;
}

const formatTimeSurgical = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
};

const formatTimeInternal = (date: Date) => {
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
};

export const ScheduleBlockConfig = ({ onBack }: ScheduleBlockConfigProps) => {
    // Graceful context consumption - prevents crash if provider is missing
    const selectionContext = useContext(SelectionContext);
    const closeSelection = selectionContext ? selectionContext.closeSelection : () => { };

    // -- Configuration State --
    const [title, setTitle] = useState('');
    const [isEnabled, setIsEnabled] = useState(true);
    const [selectedApps, setSelectedApps] = useState<{ id: string, icon: string }[]>([]);
    const [nativeIosCount, setNativeIosCount] = useState(0);
    const [days, setDays] = useState(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    const [startTime, setStartTime] = useState(new Date(new Date().setHours(9, 0, 0, 0)));
    const [endTime, setEndTime] = useState(new Date(new Date().setHours(17, 0, 0, 0)));
    const [strictMode, setStrictMode] = useState<StrictModeLevel>('normal');

    // -- UI State --
    const [isAppSelectionVisible, setIsAppSelectionVisible] = useState(false);
    const [isStrictModeVisible, setIsStrictModeVisible] = useState(false);
    const [showStartTimePicker, setShowStartTimePicker] = useState(false);
    const [showEndTimePicker, setShowEndTimePicker] = useState(false);
    const [isFamilyPickerVisible, setIsFamilyPickerVisible] = useState(false);
    
    // -- Strict Mode States --
    const [strictConfig, setStrictConfig] = useState<any>(null);
    const [isQrModalVisible, setIsQrModalVisible] = useState(false);
    const [generatedQrData, setGeneratedQrData] = useState<string | null>(null);
    const [isQrSaving, setIsQrSaving] = useState(false);
    const [pendingPayload, setPendingPayload] = useState<any>(null);
    const qrRef = useRef<any>(null);

    const allDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // -- Lifecycle: Sync with Native Selection Count (iOS) --
    useEffect(() => {
        if (Platform.OS === 'ios') {
            setNativeIosCount(getSelectionCount());
        }
    }, []);

    // -- Day Recurrence Handlers --
    const toggleDay = useCallback((day: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setDays(prev =>
            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
        );
    }, []);

    const toggleAppSelection = useCallback((appId: string, appIcon: string) => {
        setSelectedApps(prev => {
            const exists = prev.find(a => a.id === appId);
            if (exists) return prev.filter(a => a.id !== appId);
            return [...prev, { id: appId, icon: appIcon }];
        });
    }, []);

    const finalizeDeployment = async (payload: any) => {
        const schedule = FocusStorageService.migrateSession(payload);
        try {
            await FocusStorageService.saveBlock(schedule);
            
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            DeviceEventEmitter.emit('UNLINK REFRESH DATA');
            onBack();
        } catch (e) {
            console.error('Core Save Failure:', e);
            Alert.alert("STORAGE ERROR", "FAILED TO COMMIT PROTOCOL TO LIBRARY");
        }
    };

    // -- Deployment Logic --
    const handleConfirm = async () => {
        const hasAppsSelected = Platform.OS === 'ios' ? nativeIosCount > 0 : selectedApps.length > 0;

        if (!hasAppsSelected) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Alert.alert("REQUIRED TARGETS", "PLEASE SELECT APPS TO SCHEDULE RESTRICTIONS");
            return;
        }

        if (days.length === 0) {
            Alert.alert("REQUIRED SCHEDULE", "PLEASE SELECT AT LEAST ONE DAY FOR RECURRENCE");
            return;
        }

        const schedulePayload = {
            id: `sched_${Math.random().toString(36).substring(7)}`,
            title: title || "SCHEDULED FOCUS",
            type: 'schedule',
            enabled: isEnabled,
            apps: selectedApps.map(a => a.id),
            appIcons: selectedApps.map(a => a.icon),
            schedule: {
                startTime: formatTimeInternal(startTime),
                endTime: formatTimeInternal(endTime),
                days: days
            },
            strictnessConfig: {
                mode: strictMode,
                isUninstallProtected: isAdminActive(),
                ...strictConfig
            },
            scrollingProtocol: {
                enabled: false,
                youtube: { enabled: false },
                instagram: { enabled: false }
            }
        };

        // Handle QR Flow if needed
        if (strictMode === 'qr_code') {
            const qrData = `UNLINK_SCHED_${Date.now()}`;
            setGeneratedQrData(qrData);
            setPendingPayload(schedulePayload);
            setIsQrModalVisible(true);
            return;
        }

        await finalizeDeployment(schedulePayload);
    };

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

    return (
        <View className="flex-1">
            <BottomSheetScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 0 }}
            >
                {/* Section: Protocol Identity */}
                <View className="mt-8 mb-10">
                    <Text className="text-white/40 font-label text-[10px] uppercase tracking-widest mb-4">PROTOCOL IDENTITY</Text>
                    <View className="border-b border-white/20 pb-4">
                        <TextInput
                            placeholder="NAME YOUR SCHEDULE"
                            placeholderTextColor="rgba(255,255,255,0.1)"
                            className="text-white font-headline font-black text-xl uppercase tracking-tight"
                            value={title}
                            onChangeText={setTitle}
                            selectionColor="white"
                        />
                    </View>
                </View>

                {/* Section: Auto-Deploy Toggle */}
                <View className="bg-white/5 border border-white/10 p-5 flex-row justify-between items-center mb-8">
                    <View className="flex-row items-center">
                        <MaterialCommunityIcons name="clock-check-outline" size={18} color="white" style={{ marginRight: 12 }} />
                        <Text className="text-white font-headline font-black text-[11px] uppercase tracking-widest">AUTO DEPLOY ENABLE</Text>
                    </View>
                    <ModernToggle
                        value={isEnabled}
                        onValueChange={setIsEnabled}
                    />
                </View>

                {/* Section: Configuration Core */}
                <View className="mb-10">
                    <Text className="text-white/40 font-label text-[10px] uppercase tracking-widest mb-4">SPECIFICATIONS</Text>
                    <View className="border border-white/10 bg-white/5">
                        <ConfigRow
                            title="RESTRICTION TARGETS"
                            icon="apps-outline"
                            iconLibrary="Ionicons"
                            onPress={() => Platform.OS === 'ios' ? setIsFamilyPickerVisible(true) : setIsAppSelectionVisible(true)}
                            selectedApps={selectedApps}
                            nativeCount={nativeIosCount}
                        />

                        <ConfigRow
                            title="STRICTNESS ENFORCEMENT"
                            icon={getModeIcon(strictMode) as any}
                            subtitle={getModeTitle(strictMode)}
                            onPress={() => setIsStrictModeVisible(true)}
                        />
                    </View>
                </View>

                {/* Section: Recurrence Window */}
                <View className="mb-10">
                    <Text className="text-white/40 font-label text-[10px] uppercase tracking-widest mb-4">RECURRENCE WINDOW</Text>
                    <View className="flex-row justify-between bg-white/5 p-2 border border-white/5">
                        {allDays.map(day => (
                            <TouchableOpacity
                                key={day}
                                onPress={() => toggleDay(day)}
                                className={`w-10 h-10 items-center justify-center ${days.includes(day) ? 'bg-white' : 'bg-transparent'}`}
                            >
                                <Text className={`font-headline font-black text-[10px] uppercase ${days.includes(day) ? 'text-black' : 'text-white/40'}`}>
                                    {day[0]}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Section: Phase Boundaries */}
                <View className="mb-10">
                    <Text className="text-white/40 font-label text-[10px] uppercase tracking-widest mb-4">PHASE BOUNDARIES</Text>
                    <View className="border border-white/10 bg-white/5">
                        <TouchableOpacity
                            onPress={() => setShowStartTimePicker(true)}
                            className="flex-row justify-between items-center p-5 border-b border-white/5"
                        >
                            <View className="flex-row items-center">
                                <MaterialCommunityIcons name="clock-start" size={16} color="rgba(255,255,255,0.4)" style={{ marginRight: 12 }} />
                                <Text className="text-white font-headline font-black text-[10px] uppercase tracking-widest">START PHASE</Text>
                            </View>
                            <View className="bg-white/10 px-3 py-1.5">
                                <Text className="text-white font-headline font-black text-[10px]">
                                    {formatTimeSurgical(startTime)}
                                </Text>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setShowEndTimePicker(true)}
                            className="flex-row justify-between items-center p-5"
                        >
                            <View className="flex-row items-center">
                                <MaterialCommunityIcons name="clock-end" size={16} color="rgba(255,255,255,0.4)" style={{ marginRight: 12 }} />
                                <Text className="text-white font-headline font-black text-[10px] uppercase tracking-widest">END PHASE</Text>
                            </View>
                            <View className="bg-white/10 px-3 py-1.5">
                                <Text className="text-white font-headline font-black text-[10px]">
                                    {formatTimeSurgical(endTime)}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Time Selection Engines (Native Fallback) */}
                {showStartTimePicker && (
                    <DateTimePicker
                        value={startTime}
                        mode="time"
                        is24Hour={false}
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(event, date) => {
                            if (Platform.OS === 'android') setShowStartTimePicker(false);
                            if (date) {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setStartTime(date);
                            }
                        }}
                    />
                )}
                {showEndTimePicker && (
                    <DateTimePicker
                        value={endTime}
                        mode="time"
                        is24Hour={false}
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(event, date) => {
                            if (Platform.OS === 'android') setShowEndTimePicker(false);
                            if (date) {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setEndTime(date);
                            }
                        }}
                    />
                )}
            </BottomSheetScrollView>

            {/* Global Commitment Action */}
            <View className="p-6 pb-10 bg-[#050505] border-t border-white/5">
                <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={handleConfirm}
                    className="h-16 bg-white items-center justify-center border border-white"
                >
                    <Text className="text-black font-headline font-black text-xs uppercase tracking-[0.3em]">
                        SAVE TO LIBRARY
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Protocol Configuration Modals */}
            <AppSelectionModal
                visible={isAppSelectionVisible}
                onClose={() => setIsAppSelectionVisible(false)}
                onToggleApp={toggleAppSelection}
                selectedApps={selectedApps.map(a => a.id)}
            />

            <StrictModeModal
                visible={isStrictModeVisible}
                onClose={() => setIsStrictModeVisible(false)}
                onConfirm={(mode: StrictModeLevel, config: any) => {
                    setStrictMode(mode);
                    setStrictConfig(config);
                }}
                currentMode={strictMode}
            />

            {/* Signature Protocol Overlay */}
            <SignatureDeploymentModal
                visible={isQrModalVisible}
                qrData={generatedQrData}
                title="SCHEDULE_SIGNATURE"
                onCancel={() => {
                    setIsQrModalVisible(false);
                    setIsQrSaving(false);
                }}
                onSuccess={async (assetId) => {
                    const finalPayload = {
                        ...pendingPayload,
                        strictnessConfig: {
                            ...pendingPayload.strictnessConfig,
                            assetId
                        }
                    };
                    await finalizeDeployment(finalPayload);
                }}
            />

            {/* iOS Family Picker */}
            {Platform.OS === 'ios' && (
                <Modal
                    visible={isFamilyPickerVisible}
                    animationType="slide"
                >
                    <FamilyPickerView style={{ flex: 1 }} />
                    <TouchableOpacity
                        style={{ position: 'absolute', top: 40, right: 20 }}
                        onPress={() => setIsFamilyPickerVisible(false)}
                    >
                        <Text className="text-white font-bold">Done</Text>
                    </TouchableOpacity>
                </Modal>
            )}
        </View>
    );
};
