import { View, Text, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBlocking } from '../../context/BlockingContext';
import { Ionicons } from '@expo/vector-icons';

import { MaterialIcons } from '@expo/vector-icons';

export const SettingsScreen = () => {
    const { isStrict, setStrict } = useBlocking();

    const SectionHeader = ({ title }: { title: string }) => (
        <View className="flex-row items-center gap-2 mb-6">
            <Text className="font-label text-[10px] uppercase tracking-[0.4em] text-zinc-500">{title}</Text>
            <View className="h-[1px] flex-1 bg-white/20" />
        </View>
    );

    const SettingsItem = ({ icon, label, rightElement, onPress, isLast = false }: { 
        icon: string, label: string, rightElement?: React.ReactNode, onPress?: () => void, isLast?: boolean 
    }) => (
        <TouchableOpacity 
            activeOpacity={0.7}
            onPress={onPress}
            className={`flex-row items-center justify-between p-6 border-white/10 ${!isLast ? 'border-b' : ''} border-x border-t last:border-b`}
            style={{ borderStyle: 'solid', borderWidth: 1, borderColor: '#ffffff20' }}
        >
            <View className="flex-row items-center gap-4">
                <MaterialIcons name={icon as any} size={20} color="white" />
                <Text className="font-label text-xs uppercase tracking-[0.2em] text-white">{label}</Text>
            </View>
            <View className="flex-row items-center gap-2">
                {rightElement}
                {onPress && <MaterialIcons name="chevron-right" size={20} color="#5d5f5f" />}
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView className="flex-1 bg-black" edges={['top']}>
            {/* Header */}
            <View className="h-16 flex-row items-center justify-between px-6 border-b border-white/10 bg-black">
                <View className="flex-row items-center gap-2">
                    <MaterialIcons name="link-off" size={24} color="white" />
                    <Text className="font-headline font-black text-2xl tracking-[0.2em] text-white uppercase">UNLINK</Text>
                </View>
                <View className="flex-row items-center gap-4">
                    <MaterialIcons name="sensors" size={24} color="white" />
                    <View className="w-8 h-8 border border-white items-center justify-center">
                        <MaterialIcons name="person" size={20} color="white" />
                    </View>
                </View>
            </View>

            <ScrollView 
                className="flex-1 px-6" 
                contentContainerStyle={{ paddingTop: 32, paddingBottom: 240 }}
            >
                {/* Premium Banner */}
                <View className="border border-white p-8 mb-12 relative overflow-hidden">
                    <View className="flex-row justify-between items-start mb-6">
                        <View>
                            <Text className="font-label text-[10px] tracking-[0.3em] text-zinc-500 uppercase mb-2">System Status: Restricted</Text>
                            <Text className="font-headline font-black text-4xl tracking-tighter uppercase text-white">Unlock Pro</Text>
                        </View>
                        <MaterialIcons name="workspace-premium" size={24} color="rgba(255,255,255,0.2)" />
                    </View>
                    <Text className="text-zinc-400 font-label text-xs uppercase tracking-wider mb-6">
                        Deep-focus protocols // Biometric unlinking // Encrypted data export
                    </Text>
                    <TouchableOpacity className="bg-white py-4 items-center">
                        <Text className="text-black font-label font-bold text-[10px] uppercase tracking-[0.2em]">Claim Membership</Text>
                    </TouchableOpacity>
                </View>

                {/* Diagnostics */}
                <SectionHeader title="System Diagnostics" />
                <View className="flex-row gap-4 mb-12">
                    <View className="flex-1 border border-white/20 p-6 h-32 justify-between">
                        <Text className="font-label text-[10px] uppercase tracking-[0.2em] text-zinc-500">Journey</Text>
                        <View>
                            <View className="flex-row items-baseline gap-2">
                                <Text className="font-headline font-black text-4xl text-white">12</Text>
                                <Text className="font-label text-[10px] text-zinc-400 uppercase tracking-widest">Days</Text>
                            </View>
                            <View className="mt-2 h-0.5 bg-zinc-900 w-full">
                                <View className="h-full bg-white w-2/5" />
                            </View>
                        </View>
                    </View>
                    <View className="flex-1 border border-white/20 p-6 h-32 justify-between">
                        <Text className="font-label text-[10px] uppercase tracking-[0.2em] text-zinc-500">Mindfulness</Text>
                        <View>
                            <View className="flex-row items-baseline gap-2">
                                <Text className="font-headline font-black text-4xl text-white">84</Text>
                                <Text className="font-label text-[10px] text-zinc-400 uppercase tracking-widest">Breaks</Text>
                            </View>
                            <View className="mt-2 h-0.5 bg-zinc-900 w-full">
                                <View className="h-full bg-white w-3/4" />
                            </View>
                        </View>
                    </View>
                </View>

                {/* Parameters */}
                <SectionHeader title="General Parameters" />
                <View className="mb-12">
                    <TouchableOpacity 
                        onPress={() => setStrict(!isStrict)}
                        activeOpacity={0.7}
                        className="flex-row items-center justify-between p-6 border border-white/20 border-b-0"
                    >
                        <View className="flex-row items-center gap-4">
                            <MaterialIcons name="security" size={20} color="white" />
                            <Text className="font-label text-xs uppercase tracking-[0.2em] text-white">Strict Mode</Text>
                        </View>
                        <View className={`w-12 h-6 border border-white flex justify-center px-1 ${isStrict ? 'items-end' : 'items-start'}`}>
                            <View className="w-4 h-4 bg-white" />
                        </View>
                    </TouchableOpacity>
                    <SettingsItem icon="branding-watermark" label="Customize Block Screen" onPress={() => {}} />
                    <SettingsItem icon="timer-10-alt-1" label="Rule Edit Cooldown" rightElement={<Text className="font-label text-[10px] text-zinc-500 uppercase">24H</Text>} onPress={() => {}} />
                    <SettingsItem icon="visibility-off" label="Exclude from Screen Time" onPress={() => {}} isLast />
                </View>

                {/* Socials */}
                <SectionHeader title="Follow Our Socials" />
                <View className="mb-12">
                    <SettingsItem icon="share" label="Xiaohongshu" onPress={() => {}} />
                    <SettingsItem icon="close" label="X" onPress={() => {}} />
                    <SettingsItem icon="forum" label="Reddit" onPress={() => {}} isLast />
                </View>

                {/* Gateways */}
                
                {/* Version Footer */}
                <View className="pt-12 pb-8 items-center gap-6">
                    <MaterialIcons name="sensors" size={32} color="rgba(255,255,255,0.2)" />
                    <View className="items-center">
                        <Text className="font-label text-[10px] uppercase tracking-[0.4em] text-white">Unlink  v-0.1 beta</Text>
                     
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};
