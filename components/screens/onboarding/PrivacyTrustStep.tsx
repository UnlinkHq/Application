import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface PrivacyTrustStepProps {
  onNext: () => void;
}

const PromiseRow = ({ icon, title, body }: { icon: string; title: string; body: string }) => (
  <View className="mb-6 flex-row">
    <View className="mr-4 mt-0.5 h-9 w-9 flex-shrink-0 items-center justify-center border border-white/10 bg-white/5">
      <MaterialCommunityIcons name={icon as any} size={18} color="#72fe88" />
    </View>
    <View className="flex-1">
      <Text className="mb-1 font-headline text-[11px] font-black uppercase tracking-widest text-white">
        {title}
      </Text>
      <Text className="font-label text-[10px] leading-relaxed text-white/50">{body}</Text>
    </View>
  </View>
);

export const PrivacyTrustStep: React.FC<PrivacyTrustStepProps> = ({ onNext }) => {
  return (
    <View className="flex-1 bg-black">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="mb-2 flex-row items-center">
          <View className="mr-3 h-2 w-2 bg-[#72fe88]" />
          <Text className="font-headline text-[10px] font-black uppercase tracking-widest text-[#72fe88]">
            OUR PROMISE
          </Text>
        </View>

        <Text className="mb-3 font-headline text-3xl font-black uppercase leading-tight tracking-widest text-white">
          YOURS,{'\n'}AND ONLY YOURS
        </Text>

        <Text className="mb-10 font-label text-[11px] leading-relaxed text-white/40">
          Unlink is built to be trusted. No accounts, no tracking, no data harvesting — just a tool
          that works for you, on your device.
        </Text>

        <PromiseRow
          icon="account-off-outline"
          title="No login. No sign-up."
          body="You never create an account. There is no password, no profile, and no Google or Apple sign-in required to use Unlink. Never share your passwords with Unlink or anyone claiming to represent Unlink."
        />
        <PromiseRow
          icon="cellphone-lock"
          title="100% local storage"
          body="Your blocks, schedules, focus history, and usage data are stored only on this device. We have no server that receives or holds them."
        />
        <PromiseRow
          icon="email-check-outline"
          title="Email only when you ask"
          body="The only cloud provider we use for user data is Resend, and only to send optional verification emails you initiate. Everything else is processed and stored on-device."
        />
        <PromiseRow
          icon="code-tags"
          title="Open source"
          body="Unlink's code is open for anyone to inspect. You don't have to take our word for it — you can read exactly what the app does."
        />

        {/* Reassurance box */}
        <View className="mb-2 mt-2 border border-white/10 bg-white/5 p-5">
          <View className="mb-3 flex-row items-center">
            <MaterialCommunityIcons name="shield-check" size={18} color="#72fe88" />
            <Text className="ml-2 font-headline text-[10px] font-black uppercase tracking-widest text-[#72fe88]">
              NO ADS · NO TRACKERS · NO SELLING DATA
            </Text>
          </View>
          <Text className="font-label text-[10px] leading-relaxed text-white/50">
            We make money from the app itself — never from your data. Your attention is the thing
            we're protecting, not selling.
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => Linking.openURL('https://www.getunlink.com/privacy')}
          className="my-6 flex-row items-center justify-center">
          <MaterialCommunityIcons
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

      {/* Footer CTA */}
      <View className="border-t border-white/5 bg-black px-6 pb-8 pt-4">
        <TouchableOpacity
          onPress={onNext}
          activeOpacity={0.9}
          className="w-full items-center bg-white py-5 active:scale-[0.98]">
          <Text className="font-headline text-sm font-black uppercase tracking-widest text-black">
            CONTINUE
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
