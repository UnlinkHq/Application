import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    ScrollView,
    Linking,
    SafeAreaView,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';

interface AccessibilityDisclosureScreenProps {
    visible: boolean;
    onAccept: () => void;
    onDecline: () => void;
}

const Row = ({ icon, title, body }: { icon: string; title: string; body: string }) => (
    <View className="flex-row mb-6">
        <View className="w-8 h-8 bg-white/5 border border-white/10 items-center justify-center mr-4 mt-0.5 flex-shrink-0">
            <MaterialIcons name={icon as any} size={16} color="rgba(255,255,255,0.6)" />
        </View>
        <View className="flex-1">
            <Text className="text-white font-headline font-black text-[11px] uppercase tracking-widest mb-1">
                {title}
            </Text>
            <Text className="text-white/50 font-label text-[10px] leading-relaxed">
                {body}
            </Text>
        </View>
    </View>
);

export const AccessibilityDisclosureScreen: React.FC<AccessibilityDisclosureScreenProps> = ({
    visible,
    onAccept,
    onDecline,
}) => {
    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="fullScreen"
            statusBarTranslucent
        >
            <SafeAreaView className="flex-1 bg-black">
                <ScrollView
                    className="flex-1"
                    contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 48, paddingBottom: 32 }}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Header */}
                    <View className="flex-row items-center mb-2">
                        <View className="w-2 h-2 bg-[#72fe88] mr-3" />
                        <Text className="text-[#72fe88] font-headline font-black text-[10px] uppercase tracking-widest">
                            REQUIRED DISCLOSURE
                        </Text>
                    </View>

                    <Text className="text-white font-headline font-black text-3xl uppercase tracking-widest leading-tight mb-3">
                        BEFORE WE{'\n'}ENABLE BLOCKING
                    </Text>

                    <Text className="text-white/40 font-label text-[11px] leading-relaxed mb-10">
                        Google Play Store requires us to explain exactly how the
                        Accessibility Service is used before you grant it.
                        Please read this — it takes 30 seconds.
                    </Text>

                    {/* What we access */}
                    <Text className="text-white/20 font-headline font-black text-[9px] uppercase tracking-widest mb-5">
                        WHAT THE SERVICE DOES
                    </Text>

                    <Row
                        icon="apps"
                        title="Detects which app is open"
                        body="When you open an app, Unlink reads its package name (e.g. com.instagram.android) to check if it is on your block list. That is the only data read."
                    />
                    <Row
                        icon="block"
                        title="Shows a focus overlay"
                        body="If the app is blocked during your focus session, Unlink draws a reminder screen over it and redirects you home. The overlay belongs to Unlink — we do not interact with the blocked app's content."
                    />
                    <Row
                        icon="ondemand-video"
                        title="Detects Shorts & Reels scrolling (Surgical Mode only)"
                        body="In Surgical Mode, the service checks if specific UI elements inside YouTube or Instagram are visible (e.g. the Shorts container). It reads resource IDs — not video content, captions, or any personal data."
                    />

                    {/* Divider */}
                    <View className="border-t border-white/10 my-6" />

                    {/* What we do NOT do */}
                    <Text className="text-white/20 font-headline font-black text-[9px] uppercase tracking-widest mb-5">
                        WHAT WE NEVER DO
                    </Text>

                    {[
                        'Read passwords, PINs, or payment information',
                        'Read messages, emails, or notifications',
                        'Capture screenshots or record your screen',
                        'Send any accessibility data off your device',
                        'Track your location',
                        'Share your data with advertisers or third parties',
                    ].map((item) => (
                        <View key={item} className="flex-row items-start mb-3">
                            <MaterialIcons
                                name="close"
                                size={14}
                                color="#ff4444"
                                style={{ marginRight: 10, marginTop: 1 }}
                            />
                            <Text className="text-white/50 font-label text-[10px] leading-relaxed flex-1">
                                {item}
                            </Text>
                        </View>
                    ))}

                    {/* Divider */}
                    <View className="border-t border-white/10 my-6" />

                    {/* Data stays on device */}
                    <View className="bg-white/5 border border-white/10 p-5 mb-6">
                        <View className="flex-row items-center mb-3">
                            <MaterialCommunityIcons name="shield-lock" size={18} color="#72fe88" />
                            <Text className="text-[#72fe88] font-headline font-black text-[10px] uppercase tracking-widest ml-2">
                                ALL PROCESSING IS ON-DEVICE
                            </Text>
                        </View>
                        <Text className="text-white/50 font-label text-[10px] leading-relaxed">
                            Accessibility data never leaves your phone. Unlink has no server that
                            receives or stores what apps you use. Your focus history, block lists,
                            and usage patterns live only in your device's local storage.
                        </Text>
                    </View>

                    {/* You can disable it */}
                    <View className="flex-row items-start mb-10">
                        <MaterialIcons name="info-outline" size={14} color="rgba(255,255,255,0.3)" style={{ marginRight: 8, marginTop: 1 }} />
                        <Text className="text-white/30 font-label text-[10px] leading-relaxed flex-1">
                            You can disable the Accessibility Service at any time in{' '}
                            <Text className="text-white/50">
                                Android Settings → Accessibility → Unlink Focus Guard → Off
                            </Text>
                            . Disabling it will pause app blocking.
                        </Text>
                    </View>

                    {/* Privacy policy link */}
                    <TouchableOpacity
                        onPress={() => Linking.openURL('https://getunlink.com/privacy')}
                        className="flex-row items-center justify-center mb-8"
                    >
                        <MaterialIcons name="open-in-new" size={12} color="rgba(255,255,255,0.3)" style={{ marginRight: 6 }} />
                        <Text className="text-white/30 font-label text-[10px] uppercase tracking-widest underline">
                            Read our full Privacy Policy
                        </Text>
                    </TouchableOpacity>
                </ScrollView>

                {/* Fixed bottom CTAs */}
                <View className="px-6 pb-10 pt-4 border-t border-white/5 bg-black">
                    <TouchableOpacity
                        onPress={onAccept}
                        className="w-full bg-white py-5 items-center mb-3"
                        activeOpacity={0.9}
                    >
                        <Text className="text-black font-headline font-black text-sm uppercase tracking-widest">
                            I UNDERSTAND — ENABLE BLOCKING
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={onDecline}
                        className="w-full py-4 items-center"
                        activeOpacity={0.7}
                    >
                        <Text className="text-white/30 font-label text-[10px] uppercase tracking-widest">
                            Not now
                        </Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </Modal>
    );
};
