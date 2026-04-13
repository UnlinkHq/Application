import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
export const BlocksScreen = () => {
  const navigation = useNavigation<any>();

  return (
    <View style={styles.root}>
      <View style={styles.container}>
        <SafeAreaView className="flex-1 bg-black" edges={['top']}>
          <View className="flex-1">
            {/* Header - Optical Instrument Branding */}
            <View className="h-16 flex-row items-center justify-between px-6 border-b border-white/20 bg-black">
                <View className="flex-row items-center gap-2">
                    <MaterialIcons name="link-off" size={24} color="white" />
                    <Text className="font-headline font-black text-2xl tracking-[0.1em] text-white uppercase italic">UNLINK</Text>
                </View>
                <View className="flex-row items-center gap-4">
                    <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
                        <MaterialIcons name="settings" size={20} color="white" />
                    </TouchableOpacity>
                    <TouchableOpacity>
                        <MaterialIcons name="notifications-none" size={24} color="#5d5f5f" />
                    </TouchableOpacity>
                    <View className="w-8 h-8 rounded-full border border-white/20 overflow-hidden">
                        <Image 
                            source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBUeGsbHEB8rtvHLaZZi0isp6NjjJYjjkG9WZgStcPLCpV4x7f6VkiU0LvcS7mkFKDkmJCC_dPdOdSpXat487hhko57AJqN0OW9PA9W8kHSLmj_AQ0WMApqSJ1kofXMfaBKFs_hzCf0YmqYXwaVzSMzAfvSINvlRYfXm3-f-ubC0i_tVkcyrhuD0HiBYF7pBeXl1uQ2uBsaE4ggCfi2pb8YhFnJyQBE7r9GZTh6alGDQLTaEwp5pP1pzP_nie35iYk-EQ3HTlA7gD8' }} 
                            className="w-full h-full"
                        />
                    </View>
                </View>
            </View>

            <ScrollView className="flex-1 px-6" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingBottom: 120 }}>
                <View className="items-center text-center">
                    <View className="w-32 h-32 items-center justify-center">
                        <View className="absolute inset-0 border border-white/5 rounded-full" />
                        <View className="absolute inset-4 border border-white/10 rounded-full" />
                        <MaterialIcons name="block" size={64} color="rgba(255,255,255,0.2)" />
                        <View 
                            className="absolute h-[1px] bg-white/40 w-24" 
                            style={{ transform: [{ rotate: '45deg' }] }} 
                        />
                    </View>

                    <View className="space-y-4 items-center mt-12">
                        <Text className="font-headline font-black text-4xl tracking-tighter uppercase text-white text-center">
                            No active block rules
                        </Text>
                        <Text className="font-label text-sm text-white/40 uppercase tracking-[0.2em] text-center mt-2 px-4 max-w-[280px]">
                            Use the [+] button to gain freedom from the endless scroll.
                        </Text>
                    </View>
                </View>
            </ScrollView>
          </View>
        </SafeAreaView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  container: {
    flex: 1,
  },
});
