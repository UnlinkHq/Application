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
  <View className="mb-6 flex-row">
    <View className="mr-4 mt-0.5 h-8 w-8 flex-shrink-0 items-center justify-center border border-white/10 bg-white/5">
      <MaterialIcons name={icon as any} size={16} color="rgba(255,255,255,0.6)" />
    </View>
    <View className="flex-1">
      <Text className="mb-1 font-headline text-[11px] font-black uppercase tracking-widest text-white">
        {title}
      </Text>
      <Text className="font-label text-[10px] leading-relaxed text-white/50">{body}</Text>
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
      statusBarTranslucent>
      <SafeAreaView className="flex-1 bg-black">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 48, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View className="mb-2 flex-row items-center">
            <View className="mr-3 h-2 w-2 bg-[#72fe88]" />
            <Text className="font-headline text-[10px] font-black uppercase tracking-widest text-[#72fe88]">
              REQUIRED DISCLOSURE
            </Text>
          </View>

          <Text className="mb-3 font-headline text-3xl font-black uppercase leading-tight tracking-widest text-white">
            BEFORE WE{'\n'}ENABLE BLOCKING
          </Text>

          <Text className="mb-10 font-label text-[11px] leading-relaxed text-white/40">
            Google Play Store requires us to explain exactly how the Accessibility Service is used
            before you grant it. Please read this before continuing.
          </Text>

          {/* What we access */}
          <Text className="mb-5 font-headline text-[9px] font-black uppercase tracking-widest text-white/20">
            WHAT THE SERVICE DOES
          </Text>

          <Row
            icon="apps"
            title="Detects which app is open"
            body="Unlink uses Accessibility to detect which app is currently open and show a focus overlay when you open apps you chose to block."
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
          <View className="my-6 border-t border-white/10" />

          {/* What we do NOT do */}
          <Text className="mb-5 font-headline text-[9px] font-black uppercase tracking-widest text-white/20">
            WHAT WE NEVER DO
          </Text>

          {[
            'Read passwords, PINs, or payment information',
            'Read screen content or personal files',
            'Read messages, emails, or notifications',
            'Capture screenshots or record your screen',
            'Send any accessibility data off your device',
            'Track your location',
            'Share your data with advertisers or third parties',
          ].map((item) => (
            <View key={item} className="mb-3 flex-row items-start">
              <MaterialIcons
                name="close"
                size={14}
                color="#ff4444"
                style={{ marginRight: 10, marginTop: 1 }}
              />
              <Text className="flex-1 font-label text-[10px] leading-relaxed text-white/50">
                {item}
              </Text>
            </View>
          ))}

          {/* Divider */}
          <View className="my-6 border-t border-white/10" />

          {/* Data stays on device */}
          <View className="mb-6 border border-white/10 bg-white/5 p-5">
            <View className="mb-3 flex-row items-center">
              <MaterialCommunityIcons name="shield-lock" size={18} color="#72fe88" />
              <Text className="ml-2 font-headline text-[10px] font-black uppercase tracking-widest text-[#72fe88]">
                ALL PROCESSING IS ON-DEVICE
              </Text>
            </View>
            <Text className="font-label text-[10px] leading-relaxed text-white/50">
              Unlink does not read messages, passwords, screen content, or personal files. The
              detected app package name stays on-device and is only used to compare the open app
              against your block list. The only cloud provider used for user data is Resend, and
              only for optional verification emails you initiate. Everything else is on-device, and
              Unlink is open source for review.
            </Text>
          </View>

          {/* You can disable it */}
          <View className="mb-10 flex-row items-start">
            <MaterialIcons
              name="info-outline"
              size={14}
              color="rgba(255,255,255,0.3)"
              style={{ marginRight: 8, marginTop: 1 }}
            />
            <Text className="flex-1 font-label text-[10px] leading-relaxed text-white/30">
              You can disable the Accessibility Service at any time in{' '}
              <Text className="text-white/50">
                Android Settings → Accessibility → Unlink Focus Guard → Off
              </Text>
              . Disabling it will pause app blocking.
            </Text>
          </View>

          {/* Privacy policy link */}
          <TouchableOpacity
            onPress={() => Linking.openURL('https://www.getunlink.com/privacy')}
            className="mb-8 flex-row items-center justify-center">
            <MaterialIcons
              name="open-in-new"
              size={12}
              color="rgba(255,255,255,0.3)"
              style={{ marginRight: 6 }}
            />
            <Text className="font-label text-[10px] uppercase tracking-widest text-white/30 underline">
              Read our full Privacy Policy
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Fixed bottom CTAs */}
        <View className="border-t border-white/5 bg-black px-6 pb-10 pt-4">
          <TouchableOpacity
            onPress={onAccept}
            className="mb-3 w-full items-center bg-white py-5"
            activeOpacity={0.9}>
            <Text className="font-headline text-sm font-black uppercase tracking-widest text-black">
              Agree and Continue
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onDecline}
            className="w-full items-center py-4"
            activeOpacity={0.7}>
            <Text className="font-label text-[10px] uppercase tracking-widest text-white/30">
              Not Now
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};
