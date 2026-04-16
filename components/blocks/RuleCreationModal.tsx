import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
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
        title: 'Block Now',
        description: 'Instant focus activation with custom targets.',
        icon: 'flash-outline',
    },
    {
        id: 'schedule',
        title: 'Schedule Blocking',
        description: 'Automated focus windows aligned with your routine.',
        icon: 'calendar-outline',
    },
    {
        id: 'usage',
        title: 'Set Time Limits',
        description: 'Daily usage constraints for specific applications.',
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
    const [selectedRule, setSelectedRule] = useState<string | null>(null);

    const handlePress = (id: string) => {
        setSelectedRule(id);
        // Add a slight delay to show the "Tick" selection animation before closing/navigating
        setTimeout(() => {
            onSelectRule(id);
            // Reset state after navigation completes so it's fresh next time
            setTimeout(() => setSelectedRule(null), 500);
        }, 300);
    };

    return (
        <BottomSheetWrapper
            visible={visible}
            onClose={onClose}
            title="MANAGE"
            snapPoints={['55%']}
            detached={true}
            enableDynamicSizing={true}
        >
            <View className="space-y-3 mt-2">
                {RULES.map((rule) => (
                    <TouchableOpacity
                        key={rule.id}
                        onPress={() => handlePress(rule.id)}
                        activeOpacity={0.7}
                        className={`flex-row items-center p-5 rounded-2xl border-2 mb-3 ${selectedRule === rule.id ? 'border-white bg-white/5' : 'border-white/5 bg-[#121212]'}`}
                    >
                        <View className="w-12 h-12 rounded-full bg-white/10 items-center justify-center mr-4">
                            <Ionicons name={rule.icon} size={24} color="white" />
                        </View>
                        <View className="flex-1 mr-4">
                            <Text className="text-white font-headline font-black text-sm tracking-tight">
                                {rule.title}
                            </Text>
                            <Text className="text-white/40 font-label text-[10px] mt-1 leading-tight">
                                {rule.description}
                            </Text>
                        </View>
                        <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${selectedRule === rule.id ? 'bg-white border-white' : 'bg-transparent border-white/20'}`}>
                            {selectedRule === rule.id && (
                                <MaterialIcons name="check" size={14} color="black" />
                            )}
                        </View>
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
