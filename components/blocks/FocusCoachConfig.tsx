import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Switch, Platform, Modal } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ModernToggle } from '../ui/ModernToggle';
import { requestAccessibilityPermission } from '../../modules/screen-time';

export interface ScrollingProtocolConfig {
    enabled: boolean;
    youtube: {
        enabled: boolean;
    };
    instagram: {
        enabled: boolean;
    };
}

interface FocusCoachConfigProps {
    config: ScrollingProtocolConfig;
    onConfigChange: (config: ScrollingProtocolConfig) => void;
    hasAccessibility: boolean;
}

export const FocusCoachConfig = ({
    config,
    onConfigChange,
    hasAccessibility
}: FocusCoachConfigProps) => {
    const [isInfoVisible, setIsInfoVisible] = useState(false);
    const [showAccessibilityDisclosure, setShowAccessibilityDisclosure] = useState(false);
    const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

    const updateConfig = (updates: Partial<ScrollingProtocolConfig>) => {
        onConfigChange({ ...config, ...updates });
    };

    const handleMainToggle = () => {
        if (Platform.OS === 'android' && !hasAccessibility && !config.enabled) {
            setPendingAction(() => () => updateConfig({ enabled: true }));
            setShowAccessibilityDisclosure(true);
            return;
        }
        updateConfig({ enabled: !config.enabled });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    };

    const handleYoutubeToggle = (v: boolean) => {
        if (Platform.OS === 'android' && v && !hasAccessibility) {
            setPendingAction(() => () => onConfigChange({ ...config, youtube: { enabled: true } }));
            setShowAccessibilityDisclosure(true);
            return;
        }
        onConfigChange({ ...config, youtube: { enabled: v } });
    };

    const handleInstagramToggle = (v: boolean) => {
        if (Platform.OS === 'android' && v && !hasAccessibility) {
            setPendingAction(() => () => onConfigChange({ ...config, instagram: { enabled: true } }));
            setShowAccessibilityDisclosure(true);
            return;
        }
        onConfigChange({ ...config, instagram: { enabled: v } });
    };

    return (
        <View className="mt-4 mb-2">
            <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center gap-2">
                    <Text className="text-white/20 font-headline font-black text-[10px] uppercase tracking-[0.3em]">FOCUS COACH</Text>
                    <TouchableOpacity onPress={() => setIsInfoVisible(true)}>
                        <Ionicons name="information-circle-outline" size={14} color="rgba(255,255,255,0.2)" />
                    </TouchableOpacity>
                </View>
            </View>

            <View className="border border-white/10 bg-black/40 overflow-hidden">
                {/* Header Toggle */}
                <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={handleMainToggle}
                    className="flex-row items-center p-5 bg-white/5 border-b border-white/5"
                >
                    <View className="w-10 h-10 bg-white/5 items-center justify-center mr-4 border border-white/10">
                        <MaterialCommunityIcons name="brain" size={20} color={config.enabled ? "#FFF" : "rgba(255,255,255,0.2)"} />
                    </View>
                    <View className="flex-1">
                        <Text className="text-white font-headline font-black text-xs uppercase tracking-tight">Block Scrolling</Text>
                        <Text className="text-white/40 font-label text-[9px] mt-1">
                            {config.enabled ? "Bypassing Hard Blocks for Coach Heuristics" : "Coach inactive. Standard blocks will apply."}
                        </Text>
                    </View>
                    <View pointerEvents="none">
                        <ModernToggle value={config.enabled} onValueChange={() => { }} />
                    </View>
                </TouchableOpacity>

                {config.enabled && Platform.OS === 'android' && (
                    <Animated.View entering={FadeInDown.duration(400)} className="p-1">
                        {/* YouTube Section */}
                        <View className="mb-1 p-3">
                            <View className="flex-row items-center">
                                <MaterialCommunityIcons name="youtube" size={18} color="#FF0000" />
                                <Text className="text-white/40 font-headline font-black text-[9px] uppercase ml-2 tracking-widest">SCROLLING YOUTUBE</Text>
                                <View className="flex-1 h-[1px] bg-white/5 ml-3" />
                                <Switch
                                    value={config.youtube.enabled}
                                    onValueChange={handleYoutubeToggle}
                                    trackColor={{ false: '#1A1A1A', true: '#FF0000' }}
                                    thumbColor="#FFF"
                                />
                            </View>
                        </View>

                        {/* Instagram Section */}
                        <View className="mb-1 p-3">
                            <View className="flex-row items-center">
                                <MaterialCommunityIcons name="instagram" size={18} color="#E1306C" />
                                <Text className="text-white/40 font-headline font-black text-[9px] uppercase ml-2 tracking-widest">SCROLLING INSTAGRAM</Text>
                                <View className="flex-1 h-[1px] bg-white/5 ml-3" />
                                <Switch
                                    value={config.instagram.enabled}
                                    onValueChange={handleInstagramToggle}
                                    trackColor={{ false: '#1A1A1A', true: '#E1306C' }}
                                    thumbColor="#FFF"
                                />
                            </View>
                        </View>
                    </Animated.View>
                )}

                {config.enabled && Platform.OS === 'ios' && (
                    <View className="p-5 border-t border-white/5">
                        <Text className="text-white/30 font-label text-[10px] leading-4 italic">
                            iOS does not permit surgical shielding.
                            Focus Coach on iOS functions as a <Text className="text-white/60 font-bold">Hard Barrier</Text> with custom breathable shields.
                        </Text>
                    </View>
                )}
            </View>

            {/* Info Modal */}
            <Modal
                visible={isInfoVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setIsInfoVisible(false)}
            >
                <View className="flex-1 bg-black/90 justify-center px-10">
                    <View className="bg-[#0a0a0a] border border-white/20 p-8">
                        <View className="flex-row items-center mb-6">
                            <MaterialCommunityIcons name="brain" size={24} color="white" />
                            <Text className="text-white font-headline font-black text-lg uppercase tracking-widest ml-4">COACH PROTOCOL V2</Text>
                        </View>

                        <Text className="text-white/60 font-label text-[11px] leading-5 uppercase tracking-wide mb-6">
                            Surgical masking utilizes native GPU acceleration and Accessibility heuristics to detect in-app elements in real-time.
                            {"\n\n"}
                            <Text className="text-white font-bold">BYPASS_LOGIC:</Text> When active, the standard "Hard Wall" is replaced by a surgical entry gate. This allows you to check DMs without seeing reels.
                        </Text>

                        <TouchableOpacity
                            onPress={() => setIsInfoVisible(false)}
                            className="bg-white py-4 items-center"
                        >
                            <Text className="text-black font-headline font-black text-xs uppercase tracking-widest">ACKNOWLEDGE DEEP FOCUS</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Accessibility Disclosure Modal */}
            <Modal
                visible={showAccessibilityDisclosure}
                transparent
                animationType="slide"
            >
                <View className="flex-1 bg-black/95 justify-center px-8">
                    <View className="bg-[#0e0e0e] p-8 border border-white/20">
                        <View className="w-16 h-16 border border-white/10 items-center justify-center mb-8">
                            <Ionicons name="eye-outline" size={32} color="white" />
                        </View>

                        <Text className="text-white font-headline font-black text-2xl uppercase tracking-[0.2em] mb-4">
                            Surgical Shield
                        </Text>

                        <Text className="text-white/60 font-label text-[11px] leading-5 mb-8">
                            Unlink uses the <Text className="text-white font-bold">Accessibility Service API</Text> to provide surgical shielding for YouTube and Instagram.
                            {"\n\n"}
                            This allows us to:
                            {"\n"}• Detect when you enter 'Shorts' or 'Reels' sections.
                            {"\n"}• Filter distracting content inside apps.
                            {"\n"}• Prevent app tampering during active sessions.
                            {"\n\n"}
                            <Text className="text-white/40 italic">We do NOT collect or store your personal data. All processing happens on-device.</Text>
                        </Text>

                        <View className="flex-row gap-4">
                            <TouchableOpacity
                                onPress={() => setShowAccessibilityDisclosure(false)}
                                className="flex-1 h-14 border border-white/10 items-center justify-center"
                            >
                                <Text className="text-white font-headline font-black text-[10px] uppercase tracking-widest">DECLINE</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => {
                                    setShowAccessibilityDisclosure(false);
                                    requestAccessibilityPermission();
                                    if (pendingAction) pendingAction();
                                }}
                                className="flex-1 h-14 bg-white items-center justify-center"
                            >
                                <Text className="text-black font-headline font-black text-[10px] uppercase tracking-widest">ENABLE SHIELD</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};
