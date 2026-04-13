import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetWrapper } from '../ui/BottomSheetWrapper';
import { SharedValue } from 'react-native-reanimated';

interface Rule {
    id: string;
    title: string;
    description: string;
    icon: keyof typeof Ionicons.glyphMap;
}

const RULES: Rule[] = [
    {
        id: 'block_now',
        title: 'BLOCK NOW',
        description: 'PROTOCOL_00: IMMEDIATE FOCUS ACTIVATION',
        icon: 'flash-outline',
    },
    {
        id: 'schedule',
        title: 'SCHEDULE BLOCKING',
        description: 'PROTOCOL_01: AUTOMATED FOCUS WINDOW',
        icon: 'calendar-outline',
    },
    {
        id: 'usage',
        title: 'SET TIME LIMITS',
        description: 'PROTOCOL_02: DAILY TEMPORAL CONSTRAINT',
        icon: 'time-outline',
    },

];

interface RuleCreationModalProps {
    visible: boolean;
    onClose: () => void;
    onSelectRule: (ruleId: string) => void;
    animatedIndex?: SharedValue<number>;
}

export const RuleCreationModal = ({
    visible,
    onClose,
    onSelectRule
}: RuleCreationModalProps) => {
    return (
        <BottomSheetWrapper
            visible={visible}
            onClose={onClose}
            title="MANAGE"
            snapPoints={['80%']}
        >
            <View className="space-y-4">
                {RULES.map((rule) => (
                    <TouchableOpacity
                        key={rule.id}
                        onPress={() => onSelectRule(rule.id)}
                        activeOpacity={0.7}
                        className="flex-row items-center border-2 border-white bg-black p-4 mb-3"
                    >
                        <View className="mr-4">
                            <Ionicons name={rule.icon} size={22} color="white" />
                        </View>
                        <View className="flex-1">
                            <Text className="text-white font-headline font-black text-md tracking-tight uppercase">
                                {rule.title}
                            </Text>
                            <Text className="text-white/40 font-label text-[9px] uppercase tracking-[0.15em] mt-1">
                                {rule.description}
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.3)" />
                    </TouchableOpacity>
                ))}
            </View>
            <View className="mt-4 pb-10">
                <Text className="text-white/20 font-label text-[10px] tracking-[0.3em] uppercase text-right">
                    UNLINK_CORE_V1.0.4
                </Text>
            </View>
        </BottomSheetWrapper>
    );
};
