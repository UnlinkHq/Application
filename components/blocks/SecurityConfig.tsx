import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Modal, AppState } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { ModernToggle } from '../ui/ModernToggle';
import { requestAdmin, isAdminActive } from '../../modules/screen-time';
import * as Haptics from 'expo-haptics';

interface SecurityConfigProps {
    enabled: boolean;
    onEnabledChange: (value: boolean) => void;
}

export const SecurityConfig = ({
    enabled,
    onEnabledChange
}: SecurityConfigProps) => {
    const [isAdminModalVisible, setIsAdminModalVisible] = useState(false);

    // When user returns from the Android OS admin grant dialog, read the real outcome
    useEffect(() => {
        const sub = AppState.addEventListener('change', (state) => {
            if (state === 'active') {
                onEnabledChange(isAdminActive());
            }
        });
        return () => sub.remove();
    }, [onEnabledChange]);

    const handleToggle = (value: boolean) => {
        if (value && !isAdminActive()) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setIsAdminModalVisible(true);
            return;
        }
        onEnabledChange(value);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    return (
        <View className="mt-4">
            <Text className="text-white/20 font-headline font-black text-[10px] uppercase tracking-[0.3em] mb-3">ADVANCED PROTECTION</Text>
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleToggle(!enabled)}
                className="border border-white/10 bg-black/40 p-4 flex-row items-center"
            >
                <View className="w-9 h-9 bg-white/5 items-center justify-center mr-4 border border-white/10">
                    <Ionicons name="shield-checkmark-outline" size={18} color="white" />
                </View>
                <View className="flex-1">
                    <Text className="text-white font-headline font-black text-[11px] uppercase tracking-tight">STRICT MODE</Text>
                    <Text className="text-white/40 font-label text-[10px] mt-1 leading-tight">No loopholes. Prevents you from force-stopping or uninstalling the app while a focus session is active.</Text>
                </View>
                <View pointerEvents="none">
                    <ModernToggle
                        value={enabled}
                        onValueChange={() => { }}
                    />
                </View>
            </TouchableOpacity>

            {isAdminModalVisible && (
                <Modal
                    transparent={true}
                    visible={isAdminModalVisible}
                    animationType="fade"
                    onRequestClose={() => setIsAdminModalVisible(false)}
                >
                    <Animated.View
                        entering={FadeIn}
                        style={StyleSheet.absoluteFillObject}
                        className="bg-black/95 items-center justify-center px-8"
                    >
                        <View className="w-full bg-[#0a0a0a] border border-white/20 p-8 rounded-sm items-center">
                            <View className="w-16 h-16 bg-white/5 items-center justify-center mb-6 border border-white/10">
                                <MaterialCommunityIcons name="shield-lock-outline" size={32} color="white" />
                            </View>

                            <Text className="text-white font-headline font-black text-xl uppercase tracking-widest text-center mb-2">STRICT MODE</Text>
                            <Text className="text-white/40 font-label text-[9px] uppercase tracking-widest mb-8 text-center italic">MAXIMUM SECURITY ENFORCEMENT</Text>

                            <View className="bg-white/5 border border-white/10 p-5 mb-8 w-full">
                                <View className="flex-row items-start mb-4">
                                    <View className="w-5 h-5 bg-white/10 items-center justify-center mr-3 mt-0.5">
                                        <View className="w-1.5 h-1.5 bg-white" />
                                    </View>
                                    <Text className="flex-1 text-white/80 font-label text-[10px] uppercase tracking-wider leading-4">
                                        Enabling this prevents the app from being uninstalled while a focus session is active.
                                    </Text>
                                </View>
                                <View className="flex-row items-start">
                                    <View className="w-5 h-5 bg-white/10 items-center justify-center mr-3 mt-0.5">
                                        <View className="w-1.5 h-1.5 bg-white" />
                                    </View>
                                    <Text className="flex-1 text-white/80 font-label text-[10px] uppercase tracking-wider leading-4">
                                        You will be redirected to the Android system settings to grant <Text className="text-white font-bold">Device Administrator</Text> access.
                                    </Text>
                                </View>
                            </View>

                            <TouchableOpacity
                                onPress={() => {
                                    setIsAdminModalVisible(false);
                                    requestAdmin();
                                    // onEnabledChange is called by the AppState listener
                                    // once the user returns from the OS dialog with the real outcome
                                }}
                                className="w-full h-14 bg-white items-center justify-center mb-3"
                            >
                                <Text className="text-black font-headline font-black text-xs uppercase tracking-widest">GRANT PERMISSION</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setIsAdminModalVisible(false)}
                                className="w-full h-14 border border-white/20 items-center justify-center"
                            >
                                <Text className="text-white font-headline font-black text-xs uppercase tracking-widest">ABORT REQUEST</Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </Modal>
            )}
        </View>
    );
};
