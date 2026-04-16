import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Animated, { 
    useSharedValue, 
    useAnimatedStyle, 
    withRepeat, 
    withTiming, 
    withSequence,
    interpolate,
    FadeInDown
} from 'react-native-reanimated';
import { FocusStorageService, BlockSession } from '../../services/FocusStorageService';
import { PermissionBanner } from '../ui/PermissionBanner';

export const BlocksScreen = () => {
    const navigation = useNavigation<any>();
    const [activeSession, setActiveSession] = useState<BlockSession | null>(null);
    const [library, setLibrary] = useState<BlockSession[]>([]);

    const refreshData = useCallback(async () => {
        const [active, lib] = await Promise.all([
            FocusStorageService.getActiveSession(),
            FocusStorageService.getLibraryBlocks()
        ]);
        setActiveSession(active);
        setLibrary(lib);
    }, []);

    useFocusEffect(
        useCallback(() => {
            refreshData();
            const interval = setInterval(refreshData, 5000);
            return () => clearInterval(interval);
        }, [refreshData])
    );

    useEffect(() => {
        const sub = AppState.addEventListener('change', (state) => {
            if (state === 'active') refreshData();
        });
        return () => sub.remove();
    }, [refreshData]);

    const handleStop = async () => {
        await FocusStorageService.stopSession();
        refreshData();
    };

    const handlePlay = async (block: BlockSession) => {
        const session = { ...block, startTime: Date.now() };
        console.log('--- [DEBUG] INITIATING_FOCUS_SESSION ---');
        console.log(JSON.stringify(session, null, 2));
        console.log('-----------------------------------------');
        await FocusStorageService.startSession(session);
        refreshData();
    };

    const handleDelete = async (id: string) => {
        await FocusStorageService.deleteBlock(id);
        refreshData();
    };

    const [showLockModal, setShowLockModal] = useState(false);

    const handleEdit = (block: BlockSession) => {
        if (activeSession) {
            setShowLockModal(true);
        } else {
            // navigation.navigate('EditBlock', { blockId: block.id });
            // For now, let's just toast or log
            console.log('Editing:', block.id);
        }
    };

    return (
        <View style={styles.root}>
            <SafeAreaView className="flex-1 bg-black" edges={['top']}>
                {/* Header */}
                <View className="h-16 flex-row items-center justify-between px-6 border-b border-white/10 bg-black">
                    <View className="flex-row items-center gap-2">
                        <MaterialIcons name="link-off" size={24} color="white" />
                        <Text className="font-headline font-black text-2xl tracking-[0.1em] text-white uppercase italic">UNLINK</Text>
                    </View>
                    <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
                        <MaterialIcons name="settings" size={20} color="white" />
                    </TouchableOpacity>
                </View>

                <ScrollView 
                    className="flex-1" 
                    contentContainerStyle={{ paddingBottom: 120, paddingTop: 24 }}
                    showsVerticalScrollIndicator={false}
                >
                    <View className="px-6 mb-8">
                        <PermissionBanner />
                    </View>



                    {/* Section: FOCUS_LIBRARY */}
                    <View className="px-6">
                        <View className="flex-row items-center justify-between mb-6">
                            <Text className="text-white/40 font-label text-[10px] uppercase tracking-[0.3em]">
                                FOCUS_LIBRARY
                            </Text>
                            <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
                                <Text className="text-blue-500 font-label text-[10px] uppercase tracking-widest">MANAGE_ALL</Text>
                            </TouchableOpacity>
                        </View>

                        {library.length > 0 ? (
                            library.map((block, idx) => (
                                <LibraryItem
                                    key={block.id}
                                    block={block}
                                    index={idx}
                                    onPlay={() => handlePlay(block)}
                                    onDelete={() => handleDelete(block.id)}
                                    onEdit={() => handleEdit(block)}
                                    isActive={activeSession?.id === block.id}
                                />
                            ))
                        ) : (
                            <View className="py-12 items-center">
                                <MaterialIcons name="inventory" size={40} color="rgba(255,255,255,0.05)" />
                                <Text className="text-white/20 font-label text-[10px] uppercase tracking-widest mt-4">Library empty</Text>
                            </View>
                        )}
                    </View>
                </ScrollView>

                {/* Session Lock Warning Modal */}
                {showLockModal && (
                    <View className="absolute inset-0 bg-black/80 items-center justify-center px-8 z-50">
                        <Animated.View
                            entering={FadeInDown.duration(400)}
                            className="w-full bg-[#0e0e0e] border border-white/20 p-8 items-center"
                        >
                            <View className="w-16 h-16 border border-red-500 items-center justify-center mb-6">
                                <MaterialIcons name="lock" size={32} color="#ef4444" />
                            </View>
                            <Text className="text-white font-headline font-black text-xl uppercase tracking-widest text-center mb-4">
                                PROTOCOL_ENFORCED
                            </Text>
                            <Text className="text-white/40 font-label text-[10px] text-center leading-4 mb-8">
                                You cannot modify focus parameters while a session is live. Terminate the active deployment to enable editing.
                            </Text>
                            <TouchableOpacity
                                onPress={() => setShowLockModal(false)}
                                className="w-full h-14 bg-white items-center justify-center"
                            >
                                <Text className="text-black font-headline font-black text-xs uppercase tracking-widest">ACKNOWLEDGE</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    </View>
                )}
            </SafeAreaView>
        </View>
    );
};

const ActiveBlockCard = ({ session, onStop }: { session: BlockSession, onStop: () => void }) => {
    const [remaining, setRemaining] = useState('');
    const pulse = useSharedValue(0.4);

    useEffect(() => {
        pulse.value = withRepeat(
            withSequence(
                withTiming(0.8, { duration: 2000 }),
                withTiming(0.4, { duration: 2000 })
            ),
            -1,
            true
        );

        const timer = setInterval(() => {
            const now = Date.now();
            const elapsedMins = (now - session.startTime) / (1000 * 60);
            const leftMins = Math.max(0, session.durationMins - elapsedMins);
            
            const h = Math.floor(leftMins / 60);
            const m = Math.floor(leftMins % 60);
            const s = Math.floor((leftMins * 60) % 60);
            setRemaining(`${h > 0 ? h + 'h ' : ''}${m}m ${s < 10 ? '0' + s : s}s`);
        }, 1000);

        return () => clearInterval(timer);
    }, [session]);

    const auraStyle = useAnimatedStyle(() => ({
        opacity: pulse.value,
        transform: [{ scale: interpolate(pulse.value, [0.4, 0.8], [1, 1.05]) }]
    }));

    const iconsToDisplay = session.appIcons?.slice(0, 4) || [];
    const extraCount = (session.apps.length > 4) ? session.apps.length - 4 : 0;

    return (
        <View>
            <Animated.View style={[auraStyle, styles.aura]} />
            <View className="bg-[#0e0e0e] border-2 border-white/20 p-6">
                <View className="flex-row items-center justify-between mb-8">
                    <TouchableOpacity onPress={onStop} className="flex-row items-center gap-2">
                        <View className="w-5 h-5 border border-red-500 items-center justify-center">
                            <View className="w-2 h-2 bg-red-500" />
                        </View>
                        <Text className="text-red-500 font-headline font-black text-xs uppercase tracking-widest">
                            Terminate session
                        </Text>
                    </TouchableOpacity>
                </View>

                <View className="flex-row items-center mb-8">
                    <View className="w-14 h-14 bg-white/5 border border-white/10 items-center justify-center mr-5">
                       <MaterialCommunityIcons name="timer-sand" size={32} color="white" />
                    </View>
                    <View>
                        <Text className="text-white font-headline font-black text-2xl uppercase tracking-widest mb-1">
                            {session.title}
                        </Text>
                        <Text className="text-white/40 font-label text-[10px] mt-1">
                            {session.apps.length} Targets • {remaining} left
                        </Text>
                    </View>
                </View>

                <View className="flex-row items-center justify-between pt-6 border-t border-white/5">
                    <View className="flex-row items-center">
                        <View className="w-2 h-2 bg-green-500 mr-2" />
                        <Text className="text-green-500/80 font-label text-[10px] italic uppercase tracking-widest font-black">
                            ENFORCEMENT ACTIVE
                        </Text>
                    </View>

                    <View className="flex-row items-center">
                        {iconsToDisplay.map((icon, idx) => (
                            <View key={idx} className="w-6 h-6 border border-black bg-[#1a1a1a] items-center justify-center -ml-2" style={{ zIndex: 10 - idx }}>
                                <Image source={{ uri: icon }} className="w-full h-full" resizeMode="contain" />
                            </View>
                        ))}
                    </View>
                </View>
            </View>
        </View>
    );
};

const LibraryItem = ({ block, index, onPlay, onDelete, onEdit, isActive }: { block: BlockSession, index: number, onPlay: () => void, onDelete: () => void, onEdit?: (block: BlockSession) => void, isActive: boolean }) => {
    const pulse = useSharedValue(0.4);

    useEffect(() => {
        if (isActive) {
            pulse.value = withRepeat(
                withSequence(
                    withTiming(0.9, { duration: 2000 }),
                    withTiming(0.4, { duration: 2000 })
                ),
                -1,
                true
            );
        } else {
            pulse.value = 0;
        }
    }, [isActive]);

    const auraStyle = useAnimatedStyle(() => ({
        opacity: pulse.value,
        transform: [{ scale: interpolate(pulse.value, [0.4, 0.8], [1, 1.05]) }]
    }));

    const borderStyle = useAnimatedStyle(() => ({
        borderColor: isActive 
            ? interpolate(pulse.value, [0.4, 0.9], [0.4, 1.0]) // Higher contrast white pulse
            : 'rgba(255,255,255,0.1)',
        borderWidth: isActive ? 2 : 1,
        shadowColor: '#fff',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: isActive ? interpolate(pulse.value, [0.4, 0.9], [0, 0.5]) : 0,
        shadowRadius: 10,
    }), [isActive]);

    return (
        <View className="mb-4">
            {isActive && <Animated.View style={[auraStyle, styles.aura, { top: -8, bottom: -8, left: -8, right: -8, backgroundColor: 'rgba(255,255,255,0.15)' }]} />}
            <Animated.View
                entering={FadeInDown.delay(index * 100).duration(600)}
                style={borderStyle}
                className={`p-5 ${isActive ? 'bg-white/5' : 'bg-black'}`}
            >
                <View className="flex-row items-center justify-between mb-4">
                    <View className="flex-row items-center gap-3">
                        <View className="w-10 h-10 bg-white/5 items-center justify-center">
                            <MaterialCommunityIcons name="shield" size={20} color={isActive ? "#72fe88" : "white"} />
                        </View>
                        <View>
                            <Text className={`font-headline font-black text-sm uppercase tracking-widest ${isActive ? 'text-[#72fe88]' : 'text-white'}`}>{block.title}</Text>
                            <Text className="text-white/30 font-label text-[10px] mt-1">{block.apps.length} Targets • {block.durationMins} Mins</Text>
                        </View>
                    </View>

                    <View className="flex-row items-center gap-4">
                        {!isActive && (
                            <>
                                <TouchableOpacity onPress={() => onEdit?.(block)} className="p-2">
                                    <MaterialIcons name="edit" size={18} color="rgba(255,255,255,0.4)" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={onDelete} className="p-2">
                                    <MaterialIcons name="delete-outline" size={18} color="rgba(255,255,255,0.2)" />
                                </TouchableOpacity>
                            </>
                        )}
                        <TouchableOpacity
                            onPress={onPlay}
                            disabled={isActive}
                            className={`w-10 h-10 items-center justify-center ${isActive ? 'bg-[#72fe88]/20 border border-[#72fe88]' : 'bg-white'}`}
                        >
                            <MaterialIcons name={isActive ? "check" : "play-arrow"} size={24} color={isActive ? "#72fe88" : "black"} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Small Icon Row */}
                <View className="flex-row items-center">
                    {block.appIcons?.slice(0, 6).map((icon, idx) => (
                        <Image key={idx} source={{ uri: icon }} className="w-4 h-4 mr-2 opacity-40" />
                    ))}
                    {block.surgicalFlags?.youtube && <MaterialCommunityIcons name="youtube-subscription" size={12} color="rgba(255,0,0,0.5)" style={{ marginRight: 8 }} />}
                    {block.surgicalFlags?.instagram && <MaterialCommunityIcons name="instagram" size={12} color="rgba(255,255,255,0.3)" />}
                </View>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#000',
    },
    aura: {
        position: 'absolute',
        top: -15,
        bottom: -15,
        left: -15,
        right: -15,
        backgroundColor: 'rgba(255,255,255,0.05)',
    }
});
