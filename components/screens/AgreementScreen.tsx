import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, AppState } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ScreenTime from '../../modules/screen-time';

export const AgreementScreen = () => {
    const navigation = useNavigation<any>();
    const [permissions, setPermissions] = useState({ accessibility: false, overlay: false });

    const checkPermissions = async () => {
        const hasAccess = await ScreenTime.hasPermission();
        const hasOverlay = await ScreenTime.hasOverlayPermission();
        setPermissions({ accessibility: hasAccess, overlay: hasOverlay });
    };

    useEffect(() => {
        checkPermissions();
        const sub = AppState.addEventListener('change', (state) => {
            if (state === 'active') checkPermissions();
        });
        return () => sub.remove();
    }, []);

    const handleAction = () => {
        if (!permissions.accessibility) {
            ScreenTime.requestPermission();
        } else if (!permissions.overlay) {
            ScreenTime.requestOverlayPermission();
        } else {
            navigation.goBack();
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-black">
            <View className="flex-1 px-8 pt-12 pb-8">
                {/* Header */}
                <View className="mb-12">
                    <MaterialIcons name="security" size={40} color="white" />
                    <Text className="text-white font-headline font-black text-4xl tracking-tighter mt-6 uppercase">
                        FOCUS_AGREEMENT
                    </Text>
                    <View className="h-[2px] w-12 bg-white mt-4" />
                </View>

                <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                    <View className="space-y-8">
                        <Section 
                            number="01" 
                            title="ACCESS_COVENANT" 
                            body="To surgically remove digital distractions like Reels and Shorts, Unlink requires the use of the Android Accessibility Service. This is the only way to detect specifically where you are in an app and intervene on your behalf." 
                            status={permissions.accessibility ? 'GRANTED' : 'REQUIRED'}
                        />
                        
                        <Section 
                            number="02" 
                            title="SYSTEM_OVERLAY" 
                            body="During an active Focus Protocol, Unlink will draw a system-level overlay to prevent access to restricted packages. This requires 'Display over other apps' permission." 
                            status={permissions.overlay ? 'GRANTED' : 'REQUIRED'}
                        />

                        <Section 
                            number="03" 
                            title="DATA_INTEGRITY" 
                            body="Unlink does not store, transmit, or monetize your screen content. All processing happens locally within this device. We look only for specific 'distraction identifiers' defined in your block rules." 
                        />

                        <View className="bg-white/5 p-6 border border-white/10 rounded-sm mt-4">
                            <Text className="text-white/40 font-label text-[10px] leading-4 tracking-widest uppercase mb-4">
                                PROMINENT_DISCLOSURE_ACKNOWLEDGED
                            </Text>
                            <Text className="text-white font-headline text-xs leading-5">
                                I understand that granting the Accessibility and Overlay permissions is required for hard blocking and that my data never leaves this device.
                            </Text>
                        </View>
                    </View>
                </ScrollView>

                {/* Footer Action */}
                <View className="pt-8">
                    <TouchableOpacity
                        onPress={handleAction}
                        className={`${permissions.accessibility && permissions.overlay ? 'bg-white' : 'bg-white/10 border border-white/20'} h-16 items-center justify-center no-corners`}
                        activeOpacity={0.9}
                    >
                        <Text className={`${permissions.accessibility && permissions.overlay ? 'text-black' : 'text-white'} font-headline font-black text-sm uppercase tracking-[0.2em]`}>
                            {!permissions.accessibility ? 'GRANT_ACCESSIBILITY' : !permissions.overlay ? 'GRANT_OVERLAY' : 'I_AGREE_AND_COMMIT'}
                        </Text>
                    </TouchableOpacity>
                    <Text className="text-white/20 font-label text-[8px] text-center mt-4 uppercase tracking-[0.2em]">
                        FAILURE_TO_COMPLY_MAY_IMPACT_WEEKLY_PROGRESS_REPORT
                    </Text>
                </View>
            </View>
        </SafeAreaView>
    );
};

const Section = ({ number, title, body, status }: { number: string, title: string, body: string, status?: string }) => (
    <View className="mb-10">
        <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center">
                <Text className="text-white/20 font-label text-[10px] tracking-widest mr-4">{number}</Text>
                <Text className="text-white font-headline font-black text-[12px] tracking-[0.2em] uppercase">
                    {title}
                </Text>
            </View>
            {status && (
                <Text className={`${status === 'GRANTED' ? 'text-green-500' : 'text-white/30'} font-label text-[8px] tracking-widest uppercase`}>
                    [{status}]
                </Text>
            )}
        </View>
        <Text className="text-white/60 font-body text-sm leading-6">
            {body}
        </Text>
    </View>
);
