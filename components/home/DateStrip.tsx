import React, { memo } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface Props {
  currentYear: number;
  currentMonth: string;
  selectedDate: number;
  onSelectDate: (date: number) => void;
  onOpenDatePicker: () => void;
}

export const DateStrip = memo(({ 
  currentYear, 
  currentMonth, 
  selectedDate, 
  onSelectDate, 
  onOpenDatePicker 
}: Props) => {
  
  const dates = [];
  const today = new Date();
  
  // Dynamic generation for MVP
  for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      dates.push({
          day: d.toLocaleString('en-US', { weekday: 'short' }).toUpperCase(), // MON, TUE...
          date: d.getDate(),
          isToday: d.getDate() === today.getDate()
      });
  }

  return (
    <View className="px-6 py-4 bg-black">
      {/* Month/Year Selection Row */}
      <View className="flex-row items-center justify-between mb-6">
        <TouchableOpacity 
          onPress={onOpenDatePicker}
          className="active:opacity-70"
        >
          <Text className="font-label text-sm tracking-[0.2em] uppercase text-[#919191]">
            {currentMonth} {currentYear}
          </Text>
        </TouchableOpacity>
        <MaterialIcons name="calendar-today" size={14} color="#919191" />
      </View>

      {/* Date Squares Row */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        className="flex-row"
        contentContainerStyle={{ gap: 16 }}
      >
        {dates.map((item, index) => {
          const isSelected = item.date === selectedDate;
          
          return (
            <TouchableOpacity 
              key={index} 
              onPress={() => onSelectDate(item.date)}
              activeOpacity={0.8}
              className={`w-12 h-16 items-center justify-center border ${
                isSelected 
                  ? 'bg-white border-white' 
                  : 'bg-transparent border-white/10 opacity-40'
              }`}
            >
              <Text className={`font-label text-[10px] ${isSelected ? 'text-black font-bold' : 'text-white'}`}>
                {item.day}
              </Text>
              <Text className={`font-headline font-bold text-lg ${isSelected ? 'text-black' : 'text-white'}`}>
                {item.date}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
});

DateStrip.displayName = 'DateStrip';
