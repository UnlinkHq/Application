import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { UToggle } from '../ui/UToggle';

export const ScheduleBuilder = () => {
  const [isScheduleEnabled, setIsScheduleEnabled] = useState(false);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [days, setDays] = useState(['M', 'T', 'W', 'T', 'F']);

  const allDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const toggleDay = (index: number) => {
     // This logic is a bit simplified for the mock
     // In a real app we'd map indices to days properly
     // Here I'm just toggling visual state for now
  };

  return (
    <View className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 my-4">
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-lg font-bold">Planned Schedule</Text>
        <UToggle value={isScheduleEnabled} onValueChange={setIsScheduleEnabled} />
      </View>

      {isScheduleEnabled && (
        <View>
          <View className="flex-row justify-between mb-4">
            <View>
              <Text className="text-gray-500 text-xs mb-1">START</Text>
              <TouchableOpacity className="bg-gray-100 px-4 py-2 rounded-lg">
                <Text className="text-xl font-medium">{startTime}</Text>
              </TouchableOpacity>
            </View>
            <View className="items-end">
              <Text className="text-gray-500 text-xs mb-1">END</Text>
              <TouchableOpacity className="bg-gray-100 px-4 py-2 rounded-lg">
                <Text className="text-xl font-medium">{endTime}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View className="flex-row justify-between">
            {allDays.map((day, index) => (
              <TouchableOpacity
                key={index}
                className={`w-8 h-8 items-center justify-center rounded-full ${
                  index > 0 && index < 6 ? 'bg-black' : 'bg-gray-200'
                }`}
              >
                <Text
                  className={`${
                    index > 0 && index < 6 ? 'text-white' : 'text-gray-500'
                  } font-medium`}
                >
                  {day}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
};
