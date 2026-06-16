import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UToggle } from '../ui/UToggle';
import * as Haptics from 'expo-haptics';

interface SecurityConfigProps {
    enabled: boolean;
    onEnabledChange: (value: boolean) => void;
}

// Uninstall protection is enforced by the already-granted Accessibility service:
// during an active session the strict-mode self-protection detects + bounces the
// uninstall / force-stop / settings screens. No Device Admin, no extra permission —
// so this is a plain on/off toggle. (Device Admin is a post-launch Phase 2.)
export const SecurityConfig = ({
    enabled,
    onEnabledChange
}: SecurityConfigProps) => {
    const handleToggle = (value: boolean) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onEnabledChange(value);
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
                    <Text className="text-white/40 font-label text-[10px] mt-1 leading-tight">Makes it hard to quit. Blocks the force-stop & uninstall screens during an active session so you don't bail on impulse.</Text>
                </View>
                <View pointerEvents="none">
                    <UToggle value={enabled} onValueChange={() => {}} />
                </View>
            </TouchableOpacity>
        </View>
    );
};
