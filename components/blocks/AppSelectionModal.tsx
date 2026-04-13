import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetWrapper } from '../ui/BottomSheetWrapper';

const MOCK_APPS = [
    { id: 'ig', name: 'Instagram', icon: 'https://cdn-icons-png.flaticon.com/512/174/174855.png' },
    { id: 'tt', name: 'TikTok', icon: 'https://cdn-icons-png.flaticon.com/512/3046/3046121.png' },
    { id: 'yt', name: 'YouTube', icon: 'https://cdn-icons-png.flaticon.com/512/1384/1384060.png' },
    { id: 'fb', name: 'Facebook', icon: 'https://cdn-icons-png.flaticon.com/512/124/124010.png' },
    { id: 'tw', name: 'Twitter', icon: 'https://cdn-icons-png.flaticon.com/512/733/733579.png' },
];

interface AppSelectionModalProps {
    visible: boolean;
    onClose: () => void;
    selectedApps: string[];
    onToggleApp: (appId: string) => void;
}

export const AppSelectionModal = ({
    visible,
    onClose,
    selectedApps,
    onToggleApp
}: AppSelectionModalProps) => {
    return (
        <BottomSheetWrapper
            visible={visible}
            onClose={onClose}
            title="SELECT APPS"
            snapPoints={['70%']}
        >
            <ScrollView showsVerticalScrollIndicator={false} className="mt-4">
                <View className="space-y-2">
                    {MOCK_APPS.map((app) => (
                        <TouchableOpacity
                            key={app.id}
                            onPress={() => onToggleApp(app.id)}
                            activeOpacity={0.7}
                            className="flex-row items-center border border-white/10 p-4 mb-2 bg-white/5"
                        >
                            <Image source={{ uri: app.icon }} className="w-8 h-8 rounded-lg mr-4 grayscale" />
                            <Text className="text-white font-headline font-black text-sm uppercase tracking-tight flex-1">
                                {app.name}
                            </Text>
                            <View className={`w-6 h-6 border-2 items-center justify-center ${selectedApps.includes(app.id) ? 'bg-white border-white' : 'bg-transparent border-white/20'}`}>
                                {selectedApps.includes(app.id) && (
                                    <Ionicons name="checkmark" size={16} color="black" />
                                )}
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
                <TouchableOpacity
                    onPress={onClose}
                    className="bg-white h-12 items-center justify-center mt-6 mb-8"
                >
                    <Text className="text-black font-headline font-black text-sm uppercase tracking-[0.2em]">COMPLETE_SELECTION</Text>
                </TouchableOpacity>
            </ScrollView>
        </BottomSheetWrapper>
    );
};
