import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform, ActivityIndicator, AppState } from 'react-native';
import { MaterialIcons, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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
    const handleAllowBackground = () => ScreenTimeModule.requestAccessibilityPermission();
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
                    <PermissionItem 
                        title="BACKGROUND PERMISSION"
                        description="Monitors active apps to trigger surgical interventions."
                        isGranted={permissions.background}
                        onPress={handleAllowBackground}
                    />
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

                {/* Why Section */}
                <TouchableOpacity 
                    onPress={() => setShowWhyModal(true)}
                    className="mt-12 flex-row items-center border border-white/10 p-4 bg-white/5"
                >
                    <View className="w-6 h-6 border border-white/20 items-center justify-center mr-3">
                        <Text className="text-white font-black text-xs">?</Text>
                    </View>
                    <Text className="text-white/60 font-headline font-black text-[10px] uppercase tracking-widest flex-1">
                        WHY SHOULD I GIVE THESE PERMISSIONS?
                    </Text>
                    <MaterialIcons name="chevron-right" size={20} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>

                <View className="mt-8 items-center">
                    <Text className="text-white/20 font-label text-[10px] uppercase tracking-widest">TRUSTED BY 10K+ PRODUCTIVE USERS</Text>
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
                        UNLINK IS BUILT ON PRIVACY. WE NEVER SEND YOUR DATA TO OUR SERVERS WITHOUT YOUR PERMISSION.
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

                    <TouchableOpacity 
                        onPress={() => setShowWhyModal(false)}
                        className="mt-10 bg-white py-4 items-center"
                    >
                        <Text className="text-black font-headline font-black text-[10px] uppercase tracking-widest">UNDERSTOOD</Text>
                    </TouchableOpacity>
                </View>
            </BottomSheetWrapper>
        </View>
    );
};
