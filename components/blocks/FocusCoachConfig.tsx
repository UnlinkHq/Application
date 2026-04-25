import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Switch, Platform, Modal } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ModernToggle } from '../ui/ModernToggle';
import { requestAccessibilityPermission } from '../../modules/screen-time';

export interface ScrollingProtocolConfig {
    enabled: boolean;
    youtube: {
        enabled: boolean;
        intentGate: boolean;
        hideShorts: boolean;
        finiteFeed: boolean;
    };
    instagram: {
        enabled: boolean;
        intentGate: boolean;
        dmSafeZone: boolean;
        finiteFeed: boolean;
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

    const updateYoutube = (updates: Partial<ScrollingProtocolConfig['youtube']>) => {
        updateConfig({
            youtube: { ...config.youtube, ...updates }
        });
    };

    const updateInstagram = (updates: Partial<ScrollingProtocolConfig['instagram']>) => {
        updateConfig({
            instagram: { ...config.instagram, ...updates }
        });
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
            setPendingAction(() => () => updateYoutube({ enabled: true, intentGate: true, hideShorts: true, finiteFeed: true }));
            setShowAccessibilityDisclosure(true);
            return;
        }
        updateYoutube({ 
            enabled: v,
            ...(v ? { intentGate: true, hideShorts: true, finiteFeed: true } : {})
        });
    };

    const handleInstagramToggle = (v: boolean) => {
        if (Platform.OS === 'android' && v && !hasAccessibility) {
            setPendingAction(() => () => updateInstagram({ enabled: true, intentGate: true, dmSafeZone: true, finiteFeed: true }));
            setShowAccessibilityDisclosure(true);
            return;
        }
        updateInstagram({ 
            enabled: v,
            ...(v ? { intentGate: true, dmSafeZone: true, finiteFeed: true } : {})
        });
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
                            <View className="flex-row items-center mb-3">
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

                            {config.youtube.enabled && (
                                <View className="ml-7 gap-3">
                                    <TouchableOpacity
                                        onPress={() => updateYoutube({ intentGate: !config.youtube.intentGate })}
                                        className="flex-row items-center justify-between"
                                    >
                                        <Text className={`text-[10px] font-headline font-black uppercase ${config.youtube.intentGate ? 'text-white' : 'text-white/20'}`}>[ ] 3S CALM INTENT GATE</Text>
                                        <Ionicons name={config.youtube.intentGate ? "checkbox" : "square-outline"} size={16} color={config.youtube.intentGate ? "white" : "rgba(255,255,255,0.2)"} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => updateYoutube({ hideShorts: !config.youtube.hideShorts })}
                                        className="flex-row items-center justify-between"
                                    >
                                        <Text className={`text-[10px] font-headline font-black uppercase ${config.youtube.hideShorts ? 'text-white' : 'text-white/20'}`}>[ ] HIDE SHORTS SHELF (GPU)</Text>
                                        <Ionicons name={config.youtube.hideShorts ? "checkbox" : "square-outline"} size={16} color={config.youtube.hideShorts ? "white" : "rgba(255,255,255,0.2)"} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => updateYoutube({ finiteFeed: !config.youtube.finiteFeed })}
                                        className="flex-row items-center justify-between"
                                    >
                                        <Text className={`text-[10px] font-headline font-black uppercase ${config.youtube.finiteFeed ? 'text-white' : 'text-white/20'}`}>[ ] AUTONOMOUS FINITE FEED</Text>
                                        <Ionicons name={config.youtube.finiteFeed ? "checkbox" : "square-outline"} size={16} color={config.youtube.finiteFeed ? "white" : "rgba(255,255,255,0.2)"} />
                                    </TouchableOpacity>

                                    <View className="mt-1 flex-row items-center gap-2">
                                        <MaterialCommunityIcons name="brain" size={14} color="rgba(255,255,255,0.3)" />
                                        <Text className="text-[8px] text-white/30 font-label uppercase">Intelligent BrainRot Detection Active</Text>
                                    </View>
                                </View>
                            )}
                        </View>

                        {/* Instagram Section */}
                        <View className="mb-1 p-3">
                            <View className="flex-row items-center mb-3">
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

                            {config.instagram.enabled && (
                                <View className="ml-7 gap-3">
                                    <TouchableOpacity
                                        onPress={() => updateInstagram({ intentGate: !config.instagram.intentGate })}
                                        className="flex-row items-center justify-between"
                                    >
                                        <Text className={`text-[10px] font-headline font-black uppercase ${config.instagram.intentGate ? 'text-white' : 'text-white/20'}`}>[ ] 3S CALM INTENT GATE</Text>
                                        <Ionicons name={config.instagram.intentGate ? "checkbox" : "square-outline"} size={16} color={config.instagram.intentGate ? "white" : "rgba(255,255,255,0.2)"} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => updateInstagram({ dmSafeZone: !config.instagram.dmSafeZone })}
                                        className="flex-row items-center justify-between"
                                    >
                                        <Text className={`text-[10px] font-headline font-black uppercase ${config.instagram.dmSafeZone ? 'text-white' : 'text-white/20'}`}>[ ] DM SAFE-ZONE PROTOCOL</Text>
                                        <Ionicons name={config.instagram.dmSafeZone ? "checkbox" : "square-outline"} size={16} color={config.instagram.dmSafeZone ? "white" : "rgba(255,255,255,0.2)"} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => updateInstagram({ finiteFeed: !config.instagram.finiteFeed })}
                                        className="flex-row items-center justify-between"
                                    >
                                        <Text className={`text-[10px] font-headline font-black uppercase ${config.instagram.finiteFeed ? 'text-white' : 'text-white/20'}`}>[ ] AUTONOMOUS FINITE FEED</Text>
                                        <Ionicons name={config.instagram.finiteFeed ? "checkbox" : "square-outline"} size={16} color={config.instagram.finiteFeed ? "white" : "rgba(255,255,255,0.2)"} />
                                    </TouchableOpacity>

                                    <View className="mt-1 flex-row items-center gap-2">
                                        <MaterialCommunityIcons name="brain" size={14} color="rgba(255,255,255,0.3)" />
                                        <Text className="text-[8px] text-white/30 font-label uppercase">Intelligent BrainRot Detection Active</Text>
                                    </View>
                                </View>
                            )}
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
                            <Text className="text-white font-headline font-black text-lg uppercase tracking-widest ml-4">COACH_PROTOCOL_V2</Text>
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
                            <Text className="text-black font-headline font-black text-xs uppercase tracking-widest">ACKNOWLEDGE_DEEP_FOCUS</Text>
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
                            Surgical_Shield
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
                                <Text className="text-black font-headline font-black text-[10px] uppercase tracking-widest">ENABLE_SHIELD</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};
