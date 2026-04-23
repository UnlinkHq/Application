import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SoundFamiliarStepProps {
  onNext: () => void;
}

export const SoundFamiliarStep: React.FC<SoundFamiliarStepProps> = ({ onNext }) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const options = [
    { letter: 'A', text: '"Just a quick check" turned into an hour-long scroll' },
    { letter: 'B', text: 'Checked the time, now it\'s way past bedtime' },
    { letter: 'C', text: 'Battery at 20%, but couldn\'t put it down' },
    { letter: 'D', text: 'One article led to a whole afternoon of reading' }
  ];

  const handleNext = async () => {
    if (selectedIndex !== null) {
      await AsyncStorage.setItem('@unlink_pain_point', options[selectedIndex].text);
    }
    onNext();
  };

  return (
    <View className="flex-1 bg-black flex-col">

      <ScrollView className="flex-1 px-6 pt-10" showsVerticalScrollIndicator={false}>
        {/* Heading Section */}
        <View className="mb-12">
          <Text className="text-4xl font-headline font-black tracking-widest mb-2 text-white uppercase">Sound familiar?</Text>
          <Text className="font-label text-white/40 text-[10px] uppercase tracking-widest">TAP WHAT RESONATES WITH YOU</Text>
        </View>

        {/* Options Grid */}
        <View className="flex-col gap-4">
          {options.map((opt, index) => {
            const isSelected = selectedIndex === index;
            return (
              <TouchableOpacity 
                key={index} 
                activeOpacity={0.8}
                onPress={() => setSelectedIndex(index)}
                className={`flex-row items-center p-5 rounded-none active:scale-[0.98] ${
                  isSelected 
                    ? 'bg-[#2a2a2a] border-2 border-white' 
                    : 'bg-[#1b1b1b] border border-white/10'
                }`}
              >
                <View className={`w-8 h-8 items-center justify-center border mr-4 ${
                  isSelected 
                    ? 'bg-white border-white' 
                    : 'border-[#474747]'
                }`}>
                  <Text className={`font-label text-sm font-bold ${
                    isSelected ? 'text-black' : 'text-[#474747]'
                  }`}>
                    {opt.letter}
                  </Text>
                </View>
                <View className="flex-1 flex-col justify-center">
                  <Text className={`leading-tight font-body ${
                    isSelected ? 'text-white font-bold' : 'text-[#e2e2e2] font-medium'
                  }`}>
                    {opt.text}
                  </Text>
                </View>
                <View className="w-6 items-end justify-center">
                  {isSelected && (
                     <Ionicons name="checkmark-circle" size={18} color="#72fe88" />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Spacer to push content above fixed footer */}
        <View className="h-40" />
      </ScrollView>

      {/* Fixed Action Bar */}
      <View className="absolute bottom-0 left-0 right-0 p-6 pt-8 bg-black z-40 border-t border-white/10">
          <TouchableOpacity
            onPress={onNext}
            activeOpacity={0.8}
            className="w-full py-6 bg-white flex-row items-center justify-center space-x-4 active:scale-[0.98]"
          >
            <Text className="text-black font-headline font-black text-lg tracking-widest uppercase text-center mt-1">
              IT'S ME
            </Text>
            <Ionicons name="arrow-forward" size={20} color="black" />
          </TouchableOpacity>
        
      
      </View>
    </View>
  );
};
