import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet, AppState } from 'react-native';
import { SvgXml } from 'react-native-svg';
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
    interpolateColor,
    FadeInDown
} from 'react-native-reanimated';
import * as MediaLibrary from 'expo-media-library';
import { FocusStorageService, BlockSession } from '../../services/FocusStorageService';
import { PermissionBanner } from '../ui/PermissionBanner';
import { useSelection } from '../../context/SelectionContext';

const logoSvg = `<svg width="574" height="200" viewBox="0 0 574 200" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M53.97 135.47C62.12 135.47 68.72 132.99 73.75 128.04C78.78 123.09 81.3 116.53 81.3 108.38V43.16H107.68V107.42C107.68 115.57 106.4 122.93 103.84 129.48C101.28 136.04 97.69 141.63 93.05 146.27C88.41 150.91 82.78 154.46 76.14 156.94C69.51 159.41 62.11 160.66 53.96 160.66C45.81 160.66 38.41 159.42 31.78 156.94C25.14 154.46 19.47 150.91 14.75 146.27C10.03 141.63 6.39003 136.04 3.84003 129.48C1.28003 122.93 0 115.57 0 107.42V43.16H26.38V108.38C26.38 116.53 28.94 123.09 34.05 128.04C39.16 133 45.8 135.47 53.95 135.47H53.97Z" fill="white"/>
<path d="M173.08 69.53C164.77 69.53 158.09 71.97 153.06 76.85C148.02 81.73 145.51 88.24 145.51 96.39V160.65H119.13V96.39C119.13 88.72 120.49 81.61 123.21 75.05C125.93 68.5 129.68 62.86 134.48 58.14C139.28 53.43 144.95 49.75 151.51 47.11C158.06 44.47 165.26 43.15 173.09 43.15C180.92 43.15 188.11 44.47 194.67 47.11C201.22 49.75 206.9 53.43 211.7 58.14C216.5 62.86 220.21 68.5 222.85 75.05C225.49 81.61 226.81 88.72 226.81 96.39V160.65H200.43V96.39C200.43 88.24 197.95 81.73 193 76.85C188.04 71.98 181.41 69.53 173.1 69.53H173.08Z" fill="white"/>
<path d="M240.03 0.0100098V101.9H266.41V0.0100098H240.03Z" fill="#919191"/>
<path d="M303.56 0C308.35 0 312.35 1.60002 315.55 4.80002C318.75 8.00002 320.35 11.99 320.35 16.79C320.35 21.59 318.75 25.58 315.55 28.78C312.35 31.98 308.36 33.58 303.56 33.58C298.76 33.58 294.77 31.99 291.57 28.78C288.37 25.58 286.78 21.59 286.78 16.79C286.78 11.99 288.38 8.00002 291.57 4.80002C294.77 1.60002 298.76 0 303.56 0Z" fill="#919191"/>
<path d="M290.37 45.56H316.75V136.31C316.75 143.59 310.85 149.5 303.56 149.5C296.28 149.5 290.37 143.6 290.37 136.31V45.56Z" fill="#919191"/>
<path d="M444.45 75.04C441.79 68.52 438.09 62.88 433.29 58.13C428.5 53.42 422.82 49.75 416.25 47.14C409.69 44.48 402.52 43.15 394.66 43.15C386.8 43.15 379.64 44.48 373.07 47.14C366.51 49.76 360.87 53.42 356.03 58.13C351.24 62.88 347.49 68.52 344.79 75.04C342.05 81.6 340.68 88.73 340.68 96.38V101.9H367.06V96.38C367.06 88.24 369.6 81.72 374.63 76.85C379.66 71.98 386.35 69.52 394.65 69.52C402.95 69.52 409.59 71.98 414.54 76.85C419.49 81.72 421.99 88.25 421.99 96.38V160.65H448.37V96.38C448.37 88.73 447.04 81.6 444.42 75.04H444.45Z" fill="#919191"/>
<path d="M558.86 45.56C558.86 57.23 556.38 67.58 551.43 76.61C546.47 85.64 539.44 92.96 530.33 98.55C534.8 101.75 539 105.74 542.92 110.54C546.84 115.34 550.71 121.09 554.55 127.81L573.49 160.66H543.04L527.93 134.52C525.21 129.89 522.53 126.01 519.9 122.89C517.27 119.78 514.43 117.26 511.39 115.34C508.35 113.42 505 112.06 501.32 111.26C497.64 110.46 493.41 110.06 488.61 110.06H487.41V160.65H461.03V0H487.41V84.16H489.81C503.39 84.16 513.91 80.77 521.34 73.97C528.77 67.17 532.49 57.7 532.49 45.56H558.87H558.86Z" fill="#919191"/>
<path d="M367.09 125.86V136.33C367.09 155.66 358.47 172.98 344.82 184.62C333.75 194.12 319.37 199.84 303.58 199.84H303.54C287.79 199.84 273.38 194.12 262.3 184.62C248.65 172.98 240.03 155.66 240.03 136.33V125.86H266.41V136.33C266.41 156.83 283.04 173.46 303.54 173.46H303.58C324.08 173.46 340.71 156.83 340.71 136.33V125.86H367.09Z" fill="#919191"/>
</svg>
`;

export const BlocksScreen = () => {
    const navigation = useNavigation<any>();
    const { openSelection } = useSelection();
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
        // LIGHNING_REFRESH: Listen for internal app signals to refresh instantly
        const refreshSub = require('react-native').DeviceEventEmitter.addListener('UNLINK_REFRESH_DATA', refreshData);
        
        return () => {
            sub.remove();
            refreshSub.remove();
        };
    }, [refreshData]);

    const handleStop = async () => {
        const previousSession = activeSession;
        setActiveSession(null); // Optimistic update
        try {
            await FocusStorageService.stopSession();
            refreshData();
        } catch (error) {
            setActiveSession(previousSession); // Rollback on error
            console.error('Failed to stop session:', error);
        }
    };

    const handlePlay = async (block: BlockSession) => {
        const session = { ...block, startTime: Date.now() };
        const previousSession = activeSession;
        setActiveSession(session); // Optimistic update
        
        console.log('--- [DEBUG] INITIATING_FOCUS_SESSION ---');
        try {
            await FocusStorageService.startSession(session);
            refreshData();
        } catch (error) {
            setActiveSession(previousSession); // Rollback
            console.error('Failed to start session:', error);
        }
    };

    const handleDelete = async (id: string) => {
        const block = library.find(b => b.id === id);
        const assetId = (block?.strictnessConfig as any)?.assetId;

        const previousLibrary = library;
        setLibrary(prev => prev.filter(b => b.id !== id)); // Optimistic update
        try {
            await FocusStorageService.deleteBlock(id);
            
            // Clean up the QR signature from the gallery
            if (assetId) {
                try {
                    await MediaLibrary.deleteAssetsAsync([assetId]);
                } catch (assetError) {
                    console.error('Failed to delete asset:', assetError);
                    // Silently fail if user denies deletion or asset is already gone
                }
            }
            
            refreshData();
        } catch (error) {
            setLibrary(previousLibrary); // Rollback
            console.error('Failed to delete block:', error);
        }
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
                    <View className="flex-row items-center mr-2">
                        <SvgXml xml={logoSvg} width={90} />
                    </View>
                    <View className="flex-row items-center gap-5">
                        <TouchableOpacity
                            onPress={openSelection}
                            className="w-10 h-10 items-center justify-center bg-white rounded-full"
                        >
                            <MaterialIcons name="add" size={24} color="black" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
                            <MaterialIcons name="settings" size={20} color="white" />
                        </TouchableOpacity>
                    </View>
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
            ? interpolateColor(pulse.value, [0.4, 0.9], ['rgba(255,255,255,0.4)', 'rgba(255,255,255,1.0)'])
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
                    <View className="flex-row items-center gap-3 flex-1 mr-4">
                        <View className="w-10 h-10 bg-white/5 items-center justify-center">
                            <MaterialCommunityIcons name="shield" size={20} color={isActive ? "#72fe88" : "white"} />
                        </View>
                        <View className="flex-1">
                            <Text
                                numberOfLines={1}
                                className={`font-headline font-black text-sm uppercase tracking-widest ${isActive ? 'text-[#72fe88]' : 'text-white'}`}
                            >
                                {block.title}
                            </Text>
                            <Text className="text-white/30 font-label text-[10px] mt-1">{block.apps.length} Targets • {block.durationMins} Mins</Text>
                        </View>
                    </View>

                    <View className="flex-row items-center gap-4">
                        {!isActive && (
                            <>
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
                    {block.scrollingProtocol.youtube.enabled && <MaterialCommunityIcons name="youtube-subscription" size={12} color="rgba(255,0,0,0.5)" style={{ marginRight: 8 }} />}
                    {block.scrollingProtocol.instagram.enabled && <MaterialCommunityIcons name="instagram" size={12} color="rgba(255,255,255,0.3)" />}
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
