import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { AppSelectionModal } from './AppSelectionModal';

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

interface BlockNowConfigProps {
    onBack: () => void;
}

const DURATIONS = [
    { label: '15M', value: 15 },
    { label: '30M', value: 30 },
    { label: '1H', value: 60 },
    { label: '2H', value: 120 },
];

export const BlockNowConfig = ({ onBack }: BlockNowConfigProps) => {
    const [selectedApps, setSelectedApps] = useState<string[]>([]);
    const [duration, setDuration] = useState<number>(60);
    const [strictMode, setStrictMode] = useState<StrictModeLevel>('normal');
    const [title, setTitle] = useState('');
    
    // Modals visibility state
    const [isAppSelectionVisible, setIsAppSelectionVisible] = useState(false);

    const toggleAppSelection = (appId: string) => {
        if (selectedApps.includes(appId)) {
            setSelectedApps(selectedApps.filter(id => id !== appId));
        } else {
            setSelectedApps([...selectedApps, appId]);
        }
    };

    const hasAppsSelected = selectedApps.length > 0;

    return (
        <View className="flex-1 bg-transparent">
            <BottomSheetScrollView 
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 40 }}
            >
                <View className="px-1 mb-6">
                    {/* Select Apps Cell */}
                    <TouchableOpacity 
                        activeOpacity={0.7}
                        onPress={() => setIsAppSelectionVisible(true)}
                        className="border-2 border-white p-5 mb-8 flex-row justify-between items-center"
                    >
                        <View className="flex-1">
                            <Text className="text-white font-headline font-black text-lg uppercase tracking-tight mb-2">
                                SELECT APPS TO BLOCK
                            </Text>
                            {hasAppsSelected ? (
                                <View className="bg-white/20 px-3 py-1 self-start">
                                    <Text className="text-white font-label text-[10px] uppercase tracking-widest">
                                        {selectedApps.length} SELECTED
                                    </Text>
                                </View>
                            ) : (
                                <View className="bg-red-500/20 px-3 py-1 self-start">
                                    <Text className="text-red-400 font-label text-[10px] uppercase tracking-widest">
                                        NO APPS SELECTED
                                    </Text>
                                </View>
                            )}
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.4)" />
                    </TouchableOpacity>

                    {/* Select Duration */}
                    <Text className="text-white font-headline font-black text-xs uppercase tracking-[0.3em] mb-4">BLOCK DURATION</Text>
                    <View className="flex-row justify-between mb-8">
                        {DURATIONS.map((d) => (
                            <TouchableOpacity
                                key={d.value}
                                onPress={() => setDuration(d.value)}
                                className={`flex-1 border-2 p-4 items-center justify-center mr-2 last:mr-0 no-corners ${
                                    duration === d.value ? 'bg-white border-white' : 'bg-transparent border-white/20'
                                }`}
                            >
                                <Text className={`font-headline font-black text-lg ${
                                    duration === d.value ? 'text-black' : 'text-white'
                                }`}>
                                    {d.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Strict Mode Options Inline */}
                    <Text className="text-white font-headline font-black text-xs uppercase tracking-[0.3em] mb-4">DIFFICULTY</Text>
                    <View className="space-y-4 mb-8">
                        {STRICT_MODES.map((mode) => (
                            <TouchableOpacity
                                key={mode.id}
                                onPress={() => setStrictMode(mode.id)}
                                activeOpacity={0.7}
                                className={`flex-row items-center border-2 p-4 mb-3 no-corners ${
                                    strictMode === mode.id ? 'border-white bg-white/10' : 'border-white/20 bg-black'
                                }`}
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
                                <View className={`w-6 h-6 border-2 items-center justify-center ${strictMode === mode.id ? 'bg-white border-white' : 'bg-transparent border-white/40'}`}>
                                    {strictMode === mode.id && (
                                        <Ionicons name="checkmark" size={16} color="black" />
                                    )}
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Title Input */}
                    <Text className="text-white font-headline font-black text-xs uppercase tracking-[0.3em] mb-4">IDENTIFIER</Text>
                    <View className="border-b-2 border-white/30 pb-2 mb-6">
                        <TextInput
                            value={title}
                            onChangeText={setTitle}
                            placeholder="TITLE (OPTIONAL)"
                            placeholderTextColor="rgba(255,255,255,0.3)"
                            className="text-white font-headline font-black text-lg uppercase"
                            selectionColor="white"
                        />
                    </View>
                </View>
            </BottomSheetScrollView>

            {/* Action Button */}
            <View className="pt-4 pb-0">
                <TouchableOpacity 
                    className={`h-16 items-center justify-center no-corners ${hasAppsSelected ? 'bg-white' : 'bg-[#222] border-2 border-white/20'}`}
                    activeOpacity={0.9}
                    onPress={hasAppsSelected ? onBack : () => setIsAppSelectionVisible(true)}
                >
                    <Text className={`font-headline font-black text-lg uppercase tracking-[0.3em] ${hasAppsSelected ? 'text-black' : 'text-white/60'}`}>
                        {hasAppsSelected ? 'CONFIRM PROTOCOL' : 'SELECT TARGETS FIRST'}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Nested Modals */}
            <AppSelectionModal
                visible={isAppSelectionVisible}
                onClose={() => setIsAppSelectionVisible(false)}
                selectedApps={selectedApps}
                onToggleApp={toggleAppSelection}
            />
        </View>
    );
};
