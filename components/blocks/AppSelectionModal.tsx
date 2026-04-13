import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetWrapper } from '../ui/BottomSheetWrapper';
import { getInstalledApps } from '../../modules/screen-time';
import { BottomSheetSectionList } from '@gorhom/bottom-sheet';
import { classifyApp, AppCategory, CATEGORY_LABELS } from '../../core/utils/classification';

const MOCK_APPS = [
    { id: 'com.instagram.android', name: 'Instagram', icon: 'https://cdn-icons-png.flaticon.com/512/174/174855.png', isMock: true },
    { id: 'com.zhiliaoapp.musically', name: 'TikTok', icon: 'https://cdn-icons-png.flaticon.com/512/3046/3046121.png', isMock: true },
    { id: 'com.google.android.youtube', name: 'YouTube', icon: 'https://cdn-icons-png.flaticon.com/512/1384/1384060.png', isMock: true },
    { id: 'com.facebook.katana', name: 'Facebook', icon: 'https://cdn-icons-png.flaticon.com/512/124/124010.png', isMock: true },
    { id: 'com.twitter.android', name: 'Twitter', icon: 'https://cdn-icons-png.flaticon.com/512/1216/1216895.png', isMock: true },
];

interface App {
    id: string;
    name: string;
    icon: string;
    category: AppCategory;
    isMock?: boolean;
}

interface AppSelectionModalProps {
    visible: boolean;
    onClose: () => void;
    selectedApps: string[];
    onToggleApp: (appId: string, appIcon: string) => void;
}

const AppItem = memo(({ 
    app, 
    isSelected, 
    onToggle 
}: { 
    app: App; 
    isSelected: boolean; 
    onToggle: (id: string, icon: string) => void;
}) => (
    <TouchableOpacity
        onPress={() => onToggle(app.id, app.icon)}
        activeOpacity={0.7}
        className={`flex-row items-center border p-4 mb-2 ${isSelected ? 'border-white bg-white/10' : 'border-white/10 bg-[#0a0a0a]'}`}
    >
        <Image 
            source={{ uri: app.icon }} 
            className={`w-10 h-10 rounded-xl mr-4 ${app.isMock ? 'grayscale' : ''}`} 
            resizeMode="contain"
        />
        <View className="flex-1">
            <Text className="text-white font-headline font-black text-sm uppercase tracking-tight">
                {app.name}
            </Text>
            <Text className="text-white/40 font-label text-[9px] uppercase tracking-widest mt-1">
                {app.id.split('.').slice(-2).join('.')}
            </Text>
        </View>
        <View className={`w-6 h-6 border-2 items-center justify-center ${isSelected ? 'bg-white border-white' : 'bg-transparent border-white/20'}`}>
            {isSelected && (
                <Ionicons name="checkmark" size={16} color="black" />
            )}
        </View>
    </TouchableOpacity>
));

export const AppSelectionModal = ({
    visible,
    onClose,
    selectedApps,
    onToggleApp
}: AppSelectionModalProps) => {
    const [allApps, setAllApps] = useState<App[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const loadApps = async () => {
            setIsLoading(true);
            try {
                const installedApps = await getInstalledApps();
                if (installedApps && installedApps.length > 0) {
                    setAllApps(installedApps.map(a => ({
                        id: a.packageName,
                        name: a.label,
                        icon: a.icon && a.icon.length > 0 ? `data:image/png;base64,${a.icon}` : MOCK_APPS[0].icon,
                        category: classifyApp(a.packageName, a.category),
                        isMock: false,
                    })));
                } else {
                    setAllApps(MOCK_APPS.map(a => ({
                        ...a,
                        category: classifyApp(a.id)
                    })));
                }
            } catch (err) {
                console.warn('[AppSelectionModal] Failed to load apps', err);
            } finally {
                setIsLoading(false);
            }
        };

        if (visible) {
            loadApps();
        }
    }, [visible]);

    const filteredApps = useMemo(() => {
        if (!searchQuery) return allApps;
        return allApps.filter(app => 
            app.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
            app.id.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [allApps, searchQuery]);

    const sections = useMemo(() => {
        const groups: Record<AppCategory, App[]> = {} as any;
        
        filteredApps.forEach(app => {
            if (!groups[app.category]) groups[app.category] = [];
            groups[app.category].push(app);
        });

        return Object.entries(groups)
            .map(([category, data]) => ({
                category: category as AppCategory,
                title: CATEGORY_LABELS[category as AppCategory].label,
                data: data.sort((a, b) => a.name.localeCompare(b.name))
            }))
            .sort((a, b) => a.title.localeCompare(b.title));
    }, [filteredApps]);

    const renderItem = useCallback(({ item }: { item: App }) => (
        <AppItem 
            app={item} 
            isSelected={selectedApps.includes(item.id)} 
            onToggle={onToggleApp} 
        />
    ), [selectedApps, onToggleApp]);

    const renderSectionHeader = useCallback(({ section }: { section: any }) => (
        <View className="bg-black pt-6 pb-2 border-b border-white/5 mb-2">
            <View className="flex-row items-center justify-between">
                <Text className="text-white font-headline font-black text-[12px] tracking-[0.2em] uppercase">
                    {section.title}
                </Text>
                <View className="bg-white/10 px-2 py-0.5 rounded-sm">
                    <Text className="text-white/40 font-label text-[9px]">{section.data.length}</Text>
                </View>
            </View>
        </View>
    ), []);

    return (
        <BottomSheetWrapper
            visible={visible}
            onClose={onClose}
            title="SYSTEM_INDEX"
            snapPoints={['90%']}
        >
            <View className="flex-1">
                {/* Search Bar */}
                <View className="flex-row items-center bg-[#111] border-2 border-white/10 px-4 h-14 mb-4">
                    <Ionicons name="search" size={20} color="rgba(255,255,255,0.4)" />
                    <TextInput
                        className="flex-1 ml-3 text-white font-headline font-black text-sm uppercase"
                        placeholder="FILTER_IDENTIFIER"
                        placeholderTextColor="rgba(255,255,255,0.2)"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        selectionColor="white"
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.4)" />
                        </TouchableOpacity>
                    )}
                </View>

                {isLoading ? (
                    <View className="flex-1 justify-center items-center py-10">
                        <ActivityIndicator size="large" color="#ffffff" />
                        <Text className="text-white/50 font-label text-[10px] uppercase tracking-widest mt-4">
                            PARSING_PACKAGE_MANIFESTS
                        </Text>
                    </View>
                ) : (
                    <View className="flex-1">
                        <BottomSheetSectionList
                            sections={sections}
                            renderItem={renderItem}
                            renderSectionHeader={renderSectionHeader}
                            keyExtractor={(item) => item.id}
                            showsVerticalScrollIndicator={false}
                            stickySectionHeadersEnabled={true}
                            initialNumToRender={20}
                            maxToRenderPerBatch={10}
                            windowSize={5}
                            removeClippedSubviews={true}
                            contentContainerStyle={{ paddingBottom: 120 }}
                        />
                        
                        <View className="absolute bottom-4 left-0 right-0">
                           <TouchableOpacity
                                onPress={onClose}
                                className="bg-white h-16 items-center justify-center no-corners"
                                style={{ 
                                    shadowColor: '#fff', 
                                    shadowOffset: {width: 0, height: 0}, 
                                    shadowOpacity: 0.2, 
                                    shadowRadius: 10,
                                    elevation: 5
                                }}
                            >
                                <Text className="text-black font-headline font-black text-sm uppercase tracking-[0.2em]">
                                    {selectedApps.length > 0 ? `DEPLOY_TARGETS (${selectedApps.length})` : 'CLOSE_INDEX'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>
        </BottomSheetWrapper>
    );
};
