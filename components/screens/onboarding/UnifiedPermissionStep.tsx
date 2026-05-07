import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform, ActivityIndicator, AppState, Linking } from 'react-native';
import { MaterialIcons, Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import ScreenTimeModule from '../../../modules/screen-time';
import { BottomSheetWrapper } from '../../ui/BottomSheetWrapper';

interface UnifiedPermissionStepProps {
  onPermissionGranted: () => void;
}

export const UnifiedPermissionStep: React.FC<UnifiedPermissionStepProps> = ({ onPermissionGranted }) => {
    const [permissions, setPermissions] = useState({
        usage: false,
        background: false,
        overlay: false,
        battery: false
    });
    const [isLoading, setIsLoading] = useState(true);
    const [showWhyModal, setShowWhyModal] = useState(false);
    const [showAccessibilityDisclosure, setShowAccessibilityDisclosure] = useState(false);
    const [disclosureAccepted, setDisclosureAccepted] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const checkWithGuard = async () => {
            try {
                const usage = await ScreenTimeModule.hasPermission();
                const background = await ScreenTimeModule.isAccessibilityServiceEnabled();
                const overlay = await ScreenTimeModule.hasOverlayPermission();
                const battery = await ScreenTimeModule.isBatteryOptimizationExempted();
                
                if (isMounted) {
                    setPermissions({ usage, background, overlay, battery });
                }
            } catch (error) {
                console.error('[UnifiedPermissionStep] Error checking permissions:', error);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        checkWithGuard();
        
        // Instant Detection: Listen for app returning from Settings
        const subscription = AppState.addEventListener('change', nextAppState => {
            if (nextAppState === 'active') {
                checkWithGuard();
            }
        });
        
        // Polling fallback (Safety)
        const interval = setInterval(checkWithGuard, 5000);
        
        return () => {
            isMounted = false;
            subscription.remove();
            clearInterval(interval);
        };
    }, []);

    const [batteryClickCount, setBatteryClickCount] = useState(0);
    const handleAllowUsage = () => ScreenTimeModule.requestUsageStatsPermission();
    const handleAllowBackground = () => {
        if (!disclosureAccepted) {
            setShowAccessibilityDisclosure(true);
        } else {
            ScreenTimeModule.requestAccessibilityPermission();
        }
    };
    const handleAllowOverlay = () => ScreenTimeModule.requestOverlayPermission();
    const handleAllowBattery = () => {
        if (batteryClickCount === 0) {
            ScreenTimeModule.requestBatteryOptimizationExemption();
        } else {
            // Fallback for devices where the direct prompt doesn't work well
            ScreenTimeModule.openBatteryOptimizationSettings();
        }
        setBatteryClickCount(prev => prev + 1);
    };

    const allGranted = permissions.usage && permissions.background && permissions.overlay && permissions.battery;

    const PermissionItem = ({ 
        title, 
        description, 
        isGranted, 
        onPress 
    }: { 
        title: string; 
        description: string; 
        isGranted: boolean; 
        onPress: () => void;
    }) => (
        <View className="py-6 border-b border-white/5 flex-row items-center justify-between">
            <View className="flex-1 mr-4">
                <Text className={`font-headline font-black text-sm tracking-widest uppercase ${isGranted ? 'text-white' : 'text-white/60'}`}>
                    {title}
                </Text>
                <Text className="text-white/40 font-label text-[10px] mt-1">
                    {description}
                </Text>
            </View>
            
            {isGranted ? (
                <View className="w-12 h-12 bg-white items-center justify-center">
                    <MaterialIcons name="check" size={24} color="black" />
                </View>
            ) : (
                <TouchableOpacity 
                    onPress={onPress}
                    className="bg-white px-6 py-2"
                >
                    <Text className="text-black font-headline font-black text-[10px] uppercase tracking-widest">ALLOW</Text>
                </TouchableOpacity>
            )}
        </View>
    );

    return (
        <View className="flex-1 bg-black px-6">
            <ScrollView showsVerticalScrollIndicator={false} className="flex-1 pt-8">
                <Text className="text-4xl font-headline font-black text-white leading-tight tracking-widest uppercase mb-12">
                    ENABLE PERMISSION{'\n'}TO START FOCUSING
                </Text>

                <View className="space-y-2">
                    <PermissionItem 
                        title="USAGE PERMISSION"
                        description="Allows Unlink to track and analysis your focus patterns."
                        isGranted={permissions.usage}
                        onPress={handleAllowUsage}
                    />
                    <View>
                        <PermissionItem 
                            title="BLOCKING ENGINE (ACCESSIBILITY)"
                            description="Uses Accessibility Service API to detect distracting app usage (like YouTube Shorts) and trigger the focus overlay."
                            isGranted={permissions.background}
                            onPress={handleAllowBackground}
                        />
                        {!permissions.background && (
                            <View className="mt-2 p-3 bg-[#111111] border border-[#ff4444]/20">
                                <Text className="text-[#ff4444] font-headline font-black text-[10px] uppercase tracking-widest mb-1">
                                    XIAOMI / ANDROID 13+ USERS:
                                </Text>
                                <Text className="text-white/50 font-label text-[9px] leading-relaxed">
                                    If this permission is greyed out or says "Restricted Setting": Go to phone Settings → Apps → Unlink → Tap the top right 3 dots (or scroll to bottom) → "Allow restricted settings". Then come back here.
                                </Text>
                            </View>
                        )}
                    </View>
                    <PermissionItem 
                        title="OVERLAY PERMISSION"
                        description="Enables the block screen to prevent distractions."
                        isGranted={permissions.overlay}
                        onPress={handleAllowOverlay}
                    />
                    <View>
                        <PermissionItem 
                            title="BATTERY OPTIMIZATION"
                            description="Allows the engine to stay active and vigilant in the background."
                            isGranted={permissions.battery}
                            onPress={handleAllowBattery}
                        />
                        {!permissions.battery && batteryClickCount > 0 && (
                            <TouchableOpacity 
                                onPress={() => ScreenTimeModule.openAppInfoSettings()}
                                className="mt-2 self-start"
                            >
                                <Text className="text-white/30 font-label text-[9px] uppercase tracking-widest border-b border-white/10">
                                    Still not working? Open App Info &gt; Battery &gt; Unrestricted
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Prominent Disclosure Section (Required for Play Store) */}
                <View className="mt-8 p-5 bg-[#111111] border border-white/10">
                    <View className="flex-row items-center mb-3">
                        <MaterialIcons name="security" size={16} color="#72fe88" />
                        <Text className="text-[#72fe88] font-headline font-black text-[10px] uppercase tracking-widest ml-2">
                            PROMINENT DISCLOSURE
                        </Text>
                    </View>
                    <Text className="text-white/40 font-label text-[10px] leading-relaxed">
                        Unlink uses the <Text className="text-white">Accessibility Service API</Text> to identify when a target application is launched. This information is used solely to display our focus overlay and block access to distracting content. We <Text className="text-white">do not</Text> collect, store, or transmit any user data processed through this service.
                    </Text>
                </View>

                {/* Why Section */}
                <TouchableOpacity 
                    onPress={() => setShowWhyModal(true)}
                    className="mt-6 flex-row items-center border border-white/10 p-4 bg-white/5"
                >
                    <View className="w-6 h-6 border border-white/20 items-center justify-center mr-3">
                        <Text className="text-white font-black text-xs">?</Text>
                    </View>
                    <Text className="text-white/60 font-headline font-black text-[10px] uppercase tracking-widest flex-1">
                        PRIVACY & DATA DETAILS
                    </Text>
                    <MaterialIcons name="chevron-right" size={20} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>

                <View className="mt-8 items-center">
                    <Text className="text-white/20 font-label text-[10px] uppercase tracking-widest">ENFORCED BY THE SURGICAL ENGINE</Text>
                </View>
            </ScrollView>

            <View className="pb-12 pt-4">
                <TouchableOpacity
                    onPress={onPermissionGranted}
                    disabled={!allGranted}
                    className={`w-full py-6 items-center border-2 ${allGranted ? 'bg-white border-white' : 'bg-transparent border-white/20'}`}
                >
                    <Text className={`font-headline font-black text-lg tracking-widest uppercase ${allGranted ? 'text-black' : 'text-white/20'}`}>
                        CONTINUE
                    </Text>
                </TouchableOpacity>
            </View>

            <BottomSheetWrapper
                visible={showWhyModal}
                onClose={() => setShowWhyModal(false)}
                title="DATA PRIVACY & PERMISSIONS"
                snapPoints={['70%']}
            >
                <View className="px-6 py-4">
                    <Text className="text-white/40 font-label text-[10px] uppercase tracking-widest mb-6 leading-relaxed">
                        UNLINK IS BUILT ON ABSOLUTE PRIVACY. ALL SCREEN TIME DATA AND APP MONITORING HAPPENS LOCALLY ON YOUR DEVICE. WE DO NOT COLLECT OR UPLOAD ANY PERSONAL DATA.
                    </Text>

                    <View className="space-y-6">
                        <View>
                            <Text className="text-white font-headline font-black text-xs uppercase tracking-widest mb-2">USAGE DATA</Text>
                            <Text className="text-white/40 font-label text-[10px] leading-relaxed">
                                Used to visualize your focus leaks and suggest better habits. This stays entirely on your device.
                            </Text>
                        </View>
                        <View>
                            <Text className="text-white font-headline font-black text-xs uppercase tracking-widest mb-2">ACCESSIBILITY</Text>
                            <Text className="text-white/40 font-label text-[10px] leading-relaxed">
                                Used solely for context-switching detection. We do not read your passwords, messages, or keystrokes.
                            </Text>
                        </View>
                        <View>
                            <Text className="text-white font-headline font-black text-xs uppercase tracking-widest mb-2">OVERLAY</Text>
                            <Text className="text-white/40 font-label text-[10px] leading-relaxed">
                                Required to place the "Vantablack" barrier over distracting apps when you are in focus mode.
                            </Text>
                        </View>
                    </View>

                    <View className="mt-8 pt-6 border-t border-white/10">
                        <Text className="text-white/60 font-headline font-black text-[10px] uppercase tracking-widest mb-3 text-center">
                            FULLY OPEN SOURCE. VERIFY IT YOURSELF.
                        </Text>
                        <View className="flex-col gap-3">
                            <TouchableOpacity 
                                onPress={() => Linking.openURL('https://github.com/UnlinkHq/Application/tree/develop')}
                                className="bg-white/10 py-3 flex-row justify-center items-center border border-white/20"
                            >
                                <MaterialCommunityIcons name="github" size={16} color="white" style={{ marginRight: 8 }} />
                                <Text className="text-white font-headline font-black text-[10px] uppercase tracking-widest">
                                    VIEW SOURCE CODE
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={() => Linking.openURL('https://t.me/shahileeee')}
                                className="bg-[#2AABEE]/10 py-3 flex-row justify-center items-center border border-[#2AABEE]/30"
                            >
                                <FontAwesome5 name="telegram-plane" size={16} color="#2AABEE" style={{ marginRight: 8 }} />
                                <Text className="text-[#2AABEE] font-headline font-black text-[10px] uppercase tracking-widest">
                                    MESSAGE THE DEVELOPER
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <TouchableOpacity 
                        onPress={() => setShowWhyModal(false)}
                        className="mt-6 bg-white py-4 items-center"
                    >
                        <Text className="text-black font-headline font-black text-[10px] uppercase tracking-widest">UNDERSTOOD</Text>
                    </TouchableOpacity>
                </View>
            </BottomSheetWrapper>
            <BottomSheetWrapper
                visible={showAccessibilityDisclosure}
                onClose={() => setShowAccessibilityDisclosure(false)}
                title="PROMINENT DISCLOSURE"
                snapPoints={['45%']}
            >
                <View className="px-6 py-4">
                    <View className="flex-row items-center mb-4">
                        <MaterialIcons name="security" size={24} color="#72fe88" />
                        <Text className="text-[#72fe88] font-headline font-black text-sm uppercase tracking-widest ml-3">
                            ACCESSIBILITY API CONSENT
                        </Text>
                    </View>
                    <Text className="text-white/80 font-label text-[11px] uppercase tracking-widest mb-6 leading-relaxed">
                        Unlink uses the <Text className="text-white font-bold">Accessibility Service API</Text> to identify when a target application is launched. This information is used solely to display our focus overlay and block access to distracting content. 
                        
                        We <Text className="text-white font-bold">do not</Text> collect, store, or transmit any user data processed through this service.
                    </Text>

                    <TouchableOpacity 
                        onPress={() => {
                            setDisclosureAccepted(true);
                            setShowAccessibilityDisclosure(false);
                            // Give modal time to close before opening system settings
                            setTimeout(() => {
                                ScreenTimeModule.requestAccessibilityPermission();
                            }, 300);
                        }}
                        className="bg-white py-4 items-center"
                    >
                        <Text className="text-black font-headline font-black text-[10px] uppercase tracking-widest">I HAVE READ AND ACCEPT</Text>
                    </TouchableOpacity>
                </View>
            </BottomSheetWrapper>
        </View>
    );
};
