import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface PrivacyTrustStepProps {
  onNext: () => void;
}

const PromiseRow = ({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: string;
}) => (
  <View className="flex-row mb-6">
    <View className="w-9 h-9 bg-white/5 border border-white/10 items-center justify-center mr-4 mt-0.5 flex-shrink-0">
      <MaterialCommunityIcons name={icon as any} size={18} color="#72fe88" />
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

export const PrivacyTrustStep: React.FC<PrivacyTrustStepProps> = ({ onNext }) => {
  return (
    <View className="flex-1 bg-black">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="flex-row items-center mb-2">
          <View className="w-2 h-2 bg-[#72fe88] mr-3" />
          <Text className="text-[#72fe88] font-headline font-black text-[10px] uppercase tracking-widest">
            OUR PROMISE
          </Text>
        </View>

        <Text className="text-white font-headline font-black text-3xl uppercase tracking-widest leading-tight mb-3">
          YOURS,{'\n'}AND ONLY YOURS
        </Text>

        <Text className="text-white/40 font-label text-[11px] leading-relaxed mb-10">
          Unlink is built to be trusted. No accounts, no tracking, no data
          harvesting — just a tool that works for you, on your device.
        </Text>

        <PromiseRow
          icon="account-off-outline"
          title="No login. No sign-up."
          body="You never create an account. There is no password, no profile, and no Google or Apple sign-in required to use Unlink."
        />
        <PromiseRow
          icon="cellphone-lock"
          title="100% local storage"
          body="Your blocks, schedules, focus history, and usage data are stored only on this device. We have no server that receives or holds them."
        />
        <PromiseRow
          icon="email-check-outline"
          title="Email only when you ask"
          body="The only thing that ever leaves your phone is an email — sent only for optional verification you initiate. Email is delivered through Resend, our single email provider. Nothing else is transmitted."
        />
        <PromiseRow
          icon="code-tags"
          title="Open source"
          body="Unlink's code is open for anyone to inspect. You don't have to take our word for it — you can read exactly what the app does."
        />

        {/* Reassurance box */}
        <View className="bg-white/5 border border-white/10 p-5 mb-2 mt-2">
          <View className="flex-row items-center mb-3">
            <MaterialCommunityIcons name="shield-check" size={18} color="#72fe88" />
            <Text className="text-[#72fe88] font-headline font-black text-[10px] uppercase tracking-widest ml-2">
              NO ADS · NO TRACKERS · NO SELLING DATA
            </Text>
          </View>
          <Text className="text-white/50 font-label text-[10px] leading-relaxed">
            We make money from the app itself — never from your data. Your
            attention is the thing we're protecting, not selling.
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => Linking.openURL('https://www.getunlink.com/privacy')}
          className="flex-row items-center justify-center my-6"
        >
          <MaterialCommunityIcons name="open-in-new" size={12} color="rgba(255,255,255,0.3)" style={{ marginRight: 6 }} />
          <Text className="text-white/30 font-label text-[10px] uppercase tracking-widest underline">
            Read our full Privacy Policy
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Footer CTA */}
      <View className="px-6 pb-8 pt-4 border-t border-white/5 bg-black">
        <TouchableOpacity
          onPress={onNext}
          activeOpacity={0.9}
          className="w-full bg-white py-5 items-center active:scale-[0.98]"
        >
          <Text className="text-black font-headline font-black text-sm uppercase tracking-widest">
            CONTINUE
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
