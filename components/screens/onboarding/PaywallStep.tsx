import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';

interface PaywallStepProps {
  onNext: () => void;
}

export const PaywallStep: React.FC<PaywallStepProps> = ({ onNext }) => {
  const [selectedPlan, setSelectedPlan] = useState<'yearly' | 'monthly'>('yearly');
  const { height } = Dimensions.get('window');

  const timelineItems = [
    {
      icon: <Ionicons name="checkmark-circle" size={24} color="#bbe73c" />,
      title: "Get your Focus Diagnosis",
      description: "Kickstart your journey to better focus.",
      isCompleted: true
    },
    {
      icon: <Ionicons name="lock-closed" size={20} color="white" />,
      title: "Today: Improve Your Focus",
      description: "Start blocking distractions, track your screen time, and build better habits.",
      isLocked: true
    },
    {
      icon: <Ionicons name="notifications" size={20} color="white" />,
      title: "Day 6: See the Difference",
      description: "We'll send you a personalized report to showcase your progress.",
      isLocked: true
    },
    {
      icon: <Ionicons name="star" size={20} color="white" />,
      title: "Day 7: Trial Ends",
      isLocked: true
    }
  ];

  return (
    <View className="flex-1 bg-black px-6">
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <View className="py-4">
          <View className="flex-row justify-between items-center mb-10">
            <Text className="text-white/40 text-[10px] font-headline font-black uppercase tracking-widest">RESTORE</Text>
            <TouchableOpacity className="border border-white/10 p-2">
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>

          <Text className="text-4xl font-headline font-black text-white mb-12 tracking-widest uppercase">
            START YOUR FREE TRIAL AND RECLAIM YOUR REALITY
          </Text>

          {/* Timeline */}
          <View className="px-4 mb-10">
            {timelineItems.map((item, index) => (
              <View key={index} className="flex-row items-start mb-8 relative">
                {/* Vertical Line */}
                {index < timelineItems.length - 1 && (
                  <View 
                    className="absolute left-[15px] top-[30px] w-[2px] bg-gray-800"
                    style={{ 
                        height: 50,
                        backgroundColor: item.isCompleted ? '#bbe73c' : '#333'
                    }}
                  />
                )}
                
                <View
                  className={`w-8 h-8 items-center justify-center z-10 border ${item.isCompleted ? 'bg-white border-white' : 'bg-black border-white/20'}`}
                >
                  {item.isCompleted ? <Ionicons name="checkmark" size={20} color="black" /> : React.cloneElement(item.icon as any, { color: 'rgba(255,255,255,0.4)', size: 16 })}
                </View>

                <View className="ml-4 flex-1">
                  <Text className="text-white font-headline font-black text-xs tracking-widest mb-1 uppercase">
                    {item.title}
                  </Text>
                  {item.description && (
                    <Text className="text-white/40 font-label text-[10px]">
                      {item.description}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>

          {/* Plan Options */}
          <View className="space-y-4 mb-6">
            {/* Yearly Plan */}
            <TouchableOpacity
              onPress={() => setSelectedPlan('yearly')}
              className={`p-6 border-2 relative ${selectedPlan === 'yearly' ? 'border-white bg-[#1c1c1e]' : 'border-white/10 bg-black'}`}
            >
              <View className="absolute -top-4 -right-2 bg-white px-3 py-1">
                <Text className="text-black text-[10px] font-headline font-black uppercase tracking-widest">₹ 124.92/MONTH</Text>
              </View>
              <View className="flex-row justify-between items-center">
                <View>
                  <Text className="text-white font-headline font-black text-xl tracking-widest uppercase">12 MONTHS</Text>
                  <Text className="text-white/40 font-label text-[10px] mt-1">7-day free trial</Text>
                </View>
                <Text className="text-white font-headline font-black text-xl tracking-widest uppercase">₹ 1,499/YR</Text>
              </View>
            </TouchableOpacity>

            {/* Monthly Plan */}
            <TouchableOpacity
              onPress={() => setSelectedPlan('monthly')}
              className={`p-6 border-2 ${selectedPlan === 'monthly' ? 'border-white bg-[#1c1c1e]' : 'border-white/10 bg-black'}`}
            >
              <View className="flex-row justify-between items-center">
                <View>
                  <Text className="text-white font-headline font-black text-xl tracking-widest uppercase">MONTHLY</Text>
                  <Text className="text-white/40 font-label text-[10px] mt-1">Renews monthly</Text>
                </View>
                <Text className="text-white font-headline font-black text-xl tracking-widest uppercase">₹ 299/MO</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Footer */}
      <View className="pb-8 pt-4">
        <TouchableOpacity
          onPress={onNext}
          activeOpacity={0.8}
          className="w-full bg-white py-6 items-center active:scale-95"
        >
          <Text className="text-black font-headline font-black text-2xl tracking-widest uppercase">
            CONTINUE
          </Text>
        </TouchableOpacity>
        <Text className="text-white/20 font-label text-[10px] text-center mt-4 px-4 line-clamp-2 uppercase tracking-widest">
            7-DAY FREE TRIAL, THEN ₹ 1,499/YEAR. AUTO-RENEWS UNTIL CANCELED.
        </Text>
      </View>
    </View>
  );
};
