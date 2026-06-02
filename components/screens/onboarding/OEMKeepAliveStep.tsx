import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import {
    getManufacturer,
    openAutoStartSettings,
    requestBatteryOptimizationExemption,
    openBatteryOptimizationSettings,
} from '../../../modules/screen-time';

interface OEMKeepAliveStepProps {
    /** Optional CTA shown at the bottom (e.g. to advance onboarding). */
    onContinue?: () => void;
    continueLabel?: string;
}

type OemGuide = {
    label: string;
    needsAutostart: boolean;
    steps: string[];
};

/**
 * The #1 reason focus apps "stop working": aggressive OEM ROMs (Xiaomi/MIUI, Oppo/ColorOS,
 * Vivo/Funtouch, OnePlus, Samsung, Huawei) kill background services unless the user grants
 * Autostart + removes battery restrictions. Stock Android (Pixel/Motorola) only needs the
 * battery exemption. This screen detects the manufacturer and shows tailored steps.
 */
const GUIDES: Record<string, OemGuide> = {
    xiaomi: {
        label: 'Xiaomi / Redmi / POCO (MIUI)',
        needsAutostart: true,
        steps: [
            'Tap "Enable Autostart" and turn ON Autostart for Unlink.',
            'Tap "Battery" and set Unlink to "No restrictions".',
            'In Recents, lock Unlink (pull down on the card or tap the lock icon).',
        ],
    },
    poco: { label: 'POCO (MIUI)', needsAutostart: true, steps: [
        'Tap "Enable Autostart" and turn ON Autostart for Unlink.',
        'Tap "Battery" and set Unlink to "No restrictions".',
        'In Recents, lock Unlink.',
    ]},
    redmi: { label: 'Redmi (MIUI)', needsAutostart: true, steps: [
        'Tap "Enable Autostart" and turn ON Autostart for Unlink.',
        'Tap "Battery" and set Unlink to "No restrictions".',
        'In Recents, lock Unlink.',
    ]},
    oppo: { label: 'OPPO (ColorOS)', needsAutostart: true, steps: [
        'Tap "Enable Autostart" and allow Unlink to auto-launch.',
        'Tap "Battery" and disable optimization for Unlink.',
        'Settings → Battery → allow background activity.',
    ]},
    realme: { label: 'realme (realme UI)', needsAutostart: true, steps: [
        'Tap "Enable Autostart" and allow Unlink to auto-launch.',
        'Tap "Battery" and disable optimization for Unlink.',
    ]},
    vivo: { label: 'vivo / iQOO (Funtouch)', needsAutostart: true, steps: [
        'Tap "Enable Autostart" and allow background start for Unlink.',
        'Tap "Battery" and set high background power consumption to allowed.',
    ]},
    oneplus: { label: 'OnePlus (OxygenOS)', needsAutostart: true, steps: [
        'Tap "Enable Autostart" and allow Unlink to run in the background.',
        'Tap "Battery" → Battery optimization → set Unlink to "Don\'t optimize".',
        'Settings → Battery → Advanced → disable "Sleep standby optimization".',
    ]},
    samsung: { label: 'Samsung (One UI)', needsAutostart: true, steps: [
        'Tap "Battery settings", then set Unlink to "Unrestricted".',
        'Settings → Battery → Background usage limits → remove Unlink from "Sleeping/Deep sleeping apps".',
        'Disable "Put unused apps to sleep" if Unlink keeps stopping.',
    ]},
    huawei: { label: 'Huawei / Honor (EMUI)', needsAutostart: true, steps: [
        'Tap "Enable Autostart" → set Unlink to Manage manually and enable all three toggles.',
        'Tap "Battery" and disable optimization for Unlink.',
    ]},
};

const STOCK_GUIDE: OemGuide = {
    label: 'Your device',
    needsAutostart: false,
    steps: [
        'Tap "Allow background" and set Unlink battery usage to "Unrestricted".',
    ],
};

export const OEMKeepAliveStep: React.FC<OEMKeepAliveStepProps> = ({ onContinue, continueLabel = 'CONTINUE' }) => {
    const [autostartOpened, setAutostartOpened] = useState(false);
    const [batteryOpened, setBatteryOpened] = useState(false);

    const guide = useMemo<OemGuide>(() => {
        if (Platform.OS !== 'android') return STOCK_GUIDE;
        const mfr = (getManufacturer() || '').toLowerCase();
        const key = Object.keys(GUIDES).find(k => mfr.includes(k));
        return key ? GUIDES[key] : STOCK_GUIDE;
    }, []);

    if (Platform.OS !== 'android') return null;

    const handleAutostart = () => {
        openAutoStartSettings();
        setAutostartOpened(true);
    };
    const handleBattery = () => {
        if (!batteryOpened) requestBatteryOptimizationExemption();
        else openBatteryOptimizationSettings();
        setBatteryOpened(true);
    };

    return (
        <View className="flex-1 bg-black px-6">
            <ScrollView showsVerticalScrollIndicator={false} className="flex-1 pt-8">
                <Text className="text-4xl font-headline font-black text-white leading-tight tracking-widest uppercase mb-3">
                    KEEP UNLINK{'\n'}RUNNING
                </Text>
                <Text className="text-[#72fe88]/70 font-label text-[10px] uppercase tracking-widest mb-2 leading-relaxed">
                    Detected: {guide.label}
                </Text>
                <Text className="text-white/40 font-label text-[10px] uppercase tracking-widest mb-8 leading-relaxed">
                    Your phone aggressively closes background apps to save battery. Without this, Unlink can be silently killed and your blocks will stop. This takes 30 seconds.
                </Text>

                {guide.needsAutostart && (
                    <View className="py-6 border-b border-white/5 flex-row items-center justify-between">
                        <View className="flex-1 mr-4">
                            <Text className={`font-headline font-black text-sm tracking-widest uppercase ${autostartOpened ? 'text-white' : 'text-white/60'}`}>
                                AUTOSTART
                            </Text>
                            <Text className="text-white/40 font-label text-[10px] mt-1">
                                Allow Unlink to relaunch itself after it's closed.
                            </Text>
                        </View>
                        <TouchableOpacity onPress={handleAutostart} className="bg-white px-6 py-2">
                            <Text className="text-black font-headline font-black text-[10px] uppercase tracking-widest">
                                {autostartOpened ? 'REOPEN' : 'ENABLE'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View className="py-6 border-b border-white/5 flex-row items-center justify-between">
                    <View className="flex-1 mr-4">
                        <Text className={`font-headline font-black text-sm tracking-widest uppercase ${batteryOpened ? 'text-white' : 'text-white/60'}`}>
                            BATTERY: UNRESTRICTED
                        </Text>
                        <Text className="text-white/40 font-label text-[10px] mt-1">
                            Stop the OS from sleeping Unlink in the background.
                        </Text>
                    </View>
                    <TouchableOpacity onPress={handleBattery} className="bg-white px-6 py-2">
                        <Text className="text-black font-headline font-black text-[10px] uppercase tracking-widest">
                            {batteryOpened ? 'REOPEN' : 'ALLOW'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Manufacturer-specific steps */}
                <View className="mt-8 p-5 bg-[#111111] border border-white/10">
                    <View className="flex-row items-center mb-3">
                        <MaterialIcons name="checklist" size={16} color="#72fe88" />
                        <Text className="text-[#72fe88] font-headline font-black text-[10px] uppercase tracking-widest ml-2">
                            STEPS FOR {guide.label}
                        </Text>
                    </View>
                    {guide.steps.map((step, i) => (
                        <View key={i} className="flex-row items-start mb-3">
                            <Text className="text-white/30 font-headline font-black text-[10px] mr-2 mt-0.5">{i + 1}.</Text>
                            <Text className="flex-1 text-white/50 font-label text-[10px] leading-relaxed">{step}</Text>
                        </View>
                    ))}
                </View>

                <Text className="text-white/20 font-label text-[9px] uppercase tracking-widest mt-6 leading-relaxed text-center">
                    If a button opens the wrong page, search "Autostart" or "Battery" in your phone Settings and find Unlink.
                </Text>
            </ScrollView>

            {onContinue && (
                <View className="pb-12 pt-4">
                    <TouchableOpacity
                        onPress={onContinue}
                        className="w-full py-6 items-center border-2 bg-white border-white"
                    >
                        <Text className="font-headline font-black text-lg tracking-widest uppercase text-black">
                            {continueLabel}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
};
