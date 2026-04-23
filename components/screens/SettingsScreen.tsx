import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useBlocking } from '../../context/BlockingContext';
import { Ionicons, MaterialIcons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { BrandLogo } from '../ui/BrandLogo';
import { FocusStorageService, BlockSession } from '../../services/FocusStorageService';
import { isAdminActive, requestAdmin, deactivateAdmin } from '../../modules/screen-time';

export const SettingsScreen = () => {
    const navigation = useNavigation();
    const { isStrict, setStrict } = useBlocking();
    const [activeSession, setActiveSession] = useState<BlockSession | null>(null);
    const [isUninstallProtected, setIsUninstallProtected] = useState(false);

    useFocusEffect(
        useCallback(() => {
            const checkStatus = async () => {
                const session = await FocusStorageService.getActiveSession();
                setActiveSession(session);
                
                if (Platform.OS === 'android') {
                    setIsUninstallProtected(isAdminActive());
                }
            };
            checkStatus();
        }, [])
    );

    const isSessionLocking = activeSession?.strictnessConfig?.isUninstallProtected === true;

    const handleToggleUninstall = () => {
        if (isSessionLocking) return;

        if (Platform.OS === 'android') {
            if (isUninstallProtected) {
                deactivateAdmin();
                setIsUninstallProtected(false);
            } else {
                requestAdmin();
                // We don't set local state to true yet, 
                // the focus effect will pick it up when the user returns
            }
        }
    };

    const SectionHeader = ({ title }: { title: string }) => (
        <View className="flex-row items-center gap-2 mb-6">
            <Text className="font-label text-[10px] uppercase tracking-widest text-zinc-500">{title}</Text>
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
                <Text className="font-label text-sm uppercase tracking-widest text-white">{label}</Text>
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
                <View className="flex-row items-center gap-4">
                    <TouchableOpacity onPress={() => navigation.goBack()} className="p-1 -ml-2">
                        <Ionicons name="close" size={28} color="white" />
                    </TouchableOpacity>
                    <BrandLogo width={90} height={28} />
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


                {/* Parameters */}
                <SectionHeader title="General Parameters" />
                <View className="mb-12">
                    <TouchableOpacity
                        onPress={handleToggleUninstall}
                        activeOpacity={0.7}
                        className={`flex-row items-center justify-between p-6 border border-white/20 border-b-0 ${isSessionLocking ? 'opacity-50' : ''}`}
                    >
                        <View className="flex-row items-center gap-4">
                            <MaterialIcons name="security" size={20} color="white" />
                            <View>
                                <Text className="font-label text-sm uppercase tracking-widest text-white">Prevent Uninstall</Text>
                                {isSessionLocking && (
                                    <View className="flex-row items-center mt-1">
                                         <MaterialIcons name="lock" size={10} color="#72fe88" />
                                         <Text className="text-[#72fe88] font-label text-[8px] uppercase ml-1">LOCKED_BY_ACTIVE_SESSION</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                        <View className={`w-12 h-6 border ${isSessionLocking ? 'border-[#72fe88]' : 'border-white'} flex justify-center px-1 ${isUninstallProtected || isSessionLocking ? 'items-end' : 'items-start'}`}>
                            <View className={`w-4 h-4 ${isUninstallProtected || isSessionLocking ? 'bg-[#72fe88]' : 'bg-white'}`} />
                        </View>
                    </TouchableOpacity>
                    <SettingsItem 
                        icon="branding-watermark" 
                        label="Customize Block Screen" 
                        rightElement={
                            <View className="bg-blue-500/10 px-1.5 py-0.5 border border-blue-500/20">
                                <Text className="text-blue-500 font-label text-[8px] font-black tracking-widest">BETA</Text>
                            </View>
                        }
                        onPress={() => { }} 
                        isLast 
                    />
                </View>

                {/* Socials & Journey */}
                <SectionHeader title="Founder's Journey" />
                <View className="border border-[#72fe88]/20 bg-[#72fe88]/5 p-6 mb-8 border-dashed">
                    <Text className="text-white font-headline font-black text-xs uppercase tracking-widest mb-3">Startup Mission</Text>
                    <Text className="text-white/60 font-label text-[10px] leading-5 mb-4 italic">
                        "Unlink is a labor of love to help us reclaim our focus. We are building this journey together—if you want to see the hard work behind the scenes, join our social channels."
                    </Text>
                    <View className="flex-row gap-4">
                        <TouchableOpacity 
                            activeOpacity={0.7} 
                            className="flex-row items-center gap-2 p-2"
                            onPress={() => {
                                console.log('Opening Telegram...');
                                Linking.openURL('https://t.me/shahileeee').catch(err => console.error("Couldn't load page", err));
                            }}
                        >
                            <FontAwesome5 name="telegram-plane" size={18} color="white" />
                            <Text className="text-white font-label text-[10px] uppercase underline tracking-tighter">@shahileeee</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            activeOpacity={0.7} 
                            className="flex-row items-center gap-2 p-2"
                            onPress={() => {
                                console.log('Opening Instagram...');
                                Linking.openURL('https://instagram.com/_shahilee').catch(err => console.error("Couldn't load page", err));
                            }}
                        >
                            <FontAwesome5 name="instagram" size={18} color="white" />
                            <Text className="text-white font-label text-[10px] uppercase underline tracking-tighter">_shahilee</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <SectionHeader title="Direct Support" />
                <View className="mb-12">
                    <SettingsItem
                        icon="message"
                        label="Message me on Telegram"
                        onPress={() => {
                            import('react-native').then(({ Alert, Linking }) => {
                                Alert.alert(
                                    "FOUNDER_SUPPORT",
                                    "I respond fast! Usually within a few hours. Message me for any bugs, feedback, or just to say hi @shahileeee",
                                    [
                                        { text: "LATER", style: "cancel" },
                                        { text: "OPEN_TELEGRAM", onPress: () => Linking.openURL('https://t.me/shahileeee') }
                                    ]
                                );
                            });
                        }}
                    />
                    <SettingsItem
                        icon="delete-outline"
                        label="I want to Uninstall / Issues"
                        isLast
                        onPress={() => {
                            import('react-native').then(({ Alert, Linking }) => {
                                Alert.alert(
                                    "WAIT_BEFORE_YOU_GO!",
                                    "Is there something wrong? I'm working hard on this startup journey and would love to fix any issues you have personally. Message me on Telegram @shahileeee and I'll respond fast!",
                                    [
                                        { text: "NEVERMIND", style: "cancel" },
                                        { text: "HELP_ME_DIRECTLY", onPress: () => Linking.openURL('https://t.me/shahileeee') }
                                    ]
                                );
                            });
                        }}
                    />
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
