import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetWrapper } from '../ui/BottomSheetWrapper';

export type StrictModeLevel = 'normal' | 'interruptions' | 'limit' | 'extreme';

interface StrictModeOption {
    id: StrictModeLevel;
    title: string;
    description: string;
    icon: keyof typeof Ionicons.glyphMap;
}

const STRICT_MODES: StrictModeOption[] = [
    {
        id: 'normal',
        title: 'NORMAL (EASY)',
        description: 'Stop blocking whenever you want.',
        icon: 'pause-circle-outline'
    },
    {
        id: 'interruptions',
        title: 'INTERRUPTIONS (MEDIUM)',
        description: 'Complete a challenge to stop blocking.',
        icon: 'stop-circle-outline'
    },
    {
        id: 'limit',
        title: 'UNBLOCK LIMIT (HARD)',
        description: 'Stop blocking only a limited number of times per day.',
        icon: 'time-outline'
    },
    {
        id: 'extreme',
        title: 'ALWAYS BLOCK (EXTREME)',
        description: 'Completely prevent stopping the session.',
        icon: 'close-circle-outline'
    }
];

interface StrictModeModalProps {
    visible: boolean;
    onClose: () => void;
    currentMode: StrictModeLevel;
    onConfirm: (mode: StrictModeLevel) => void;
}

export const StrictModeModal = ({
    visible,
    onClose,
    currentMode,
    onConfirm
}: StrictModeModalProps) => {
    const [selectedMode, setSelectedMode] = useState<StrictModeLevel>(currentMode);
    const [challengeType, setChallengeType] = useState('math');

    // Sync selected mode when opened
    React.useEffect(() => {
        if (visible) {
            setSelectedMode(currentMode);
        }
    }, [visible, currentMode]);

    const handleConfirm = () => {
        onConfirm(selectedMode);
        onClose();
    };

    return (
        <BottomSheetWrapper
            visible={visible}
            onClose={onClose}
            title="STRICT MODE"
            snapPoints={['75%']}
        >
            <ScrollView showsVerticalScrollIndicator={false} className="mt-4 flex-1">
                <Text className="text-white/60 font-headline font-black text-xs uppercase tracking-[0.3em] mb-4">
                    CHOOSE DIFFICULTY EXTREMITY
                </Text>
                <View className="space-y-4">
                    {STRICT_MODES.map((mode) => (
                        <View key={mode.id}>
                            <TouchableOpacity
                                onPress={() => setSelectedMode(mode.id)}
                                activeOpacity={0.7}
                                className={`flex-row items-center border-2 p-4 no-corners ${selectedMode === mode.id ? 'border-white bg-white/10' : 'border-white/20 bg-black'}`}
                            >
                                <View className="mr-4">
                                    <Ionicons name={mode.icon} size={28} color="white" />
                                </View>
                                <View className="flex-1 mr-4">
                                    <Text className="text-white font-headline font-black text-md tracking-tight uppercase">
                                        {mode.title}
                                    </Text>
                                    <Text className="text-white/50 font-label text-[9px] uppercase tracking-[0.1em] mt-1 leading-tight">
                                        {mode.description}
                                    </Text>
                                </View>
                                <View className={`w-6 h-6 border-2 items-center justify-center ${selectedMode === mode.id ? 'bg-white border-white' : 'bg-transparent border-white/40'}`}>
                                    {selectedMode === mode.id && (
                                        <Ionicons name="checkmark" size={16} color="black" />
                                    )}
                                </View>
                            </TouchableOpacity>

                            {/* Nested options for Interruptions mode */}
                            {selectedMode === 'interruptions' && mode.id === 'interruptions' && (
                                <View className="ml-8 mt-2 mb-4 p-4 border-l-2 border-white/30 bg-white/5">
                                    <Text className="text-white font-headline font-black text-xs uppercase tracking-[0.2em] mb-3">
                                        CHALLENGE TYPE
                                    </Text>
                                    <View className="flex-row space-x-2">
                                        <TouchableOpacity 
                                            onPress={() => setChallengeType('math')}
                                            className={`flex-1 border p-3 flex-row items-center justify-center ${challengeType === 'math' ? 'border-white bg-white' : 'border-white/30 bg-transparent'}`}
                                        >
                                            <Text className={`font-headline font-black text-[10px] uppercase tracking-widest ${challengeType === 'math' ? 'text-black' : 'text-white'}`}>MATH</Text>
                                        </TouchableOpacity>
                                        
                                        <TouchableOpacity 
                                            onPress={() => setChallengeType('text')}
                                            className={`flex-1 border p-3 flex-row items-center justify-center ${challengeType === 'text' ? 'border-white bg-white' : 'border-white/30 bg-transparent'}`}
                                        >
                                            <Text className={`font-headline font-black text-[10px] uppercase tracking-widest ${challengeType === 'text' ? 'text-black' : 'text-white'}`}>TYPE</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity 
                                            onPress={() => setChallengeType('wait')}
                                            className={`flex-1 border p-3 flex-row items-center justify-center ${challengeType === 'wait' ? 'border-white bg-white' : 'border-white/30 bg-transparent'}`}
                                        >
                                            <Text className={`font-headline font-black text-[10px] uppercase tracking-widest ${challengeType === 'wait' ? 'text-black' : 'text-white'}`}>WAIT</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
                        </View>
                    ))}
                </View>
            </ScrollView>

            <View className="pt-4 pb-8 bg-[#000]">
                <TouchableOpacity 
                    className="h-16 bg-white items-center justify-center no-corners"
                    activeOpacity={0.9}
                    onPress={handleConfirm}
                >
                    <Text className="text-black font-headline font-black text-lg uppercase tracking-[0.3em]">
                        CONFIRM PROTOCOL
                    </Text>
                </TouchableOpacity>
            </View>
        </BottomSheetWrapper>
    );
};
