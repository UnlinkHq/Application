import React, { useState, useRef, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, Dimensions, FlatList, ListRenderItem, ViewToken } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface HowItHelpsStepProps {
  onNext: () => void;
}

interface SlideItem {
    title: string;
    description: string;
    tag: string;
    icon: keyof typeof MaterialIcons.glyphMap;
}

export const HowItHelpsStep: React.FC<HowItHelpsStepProps> = ({ onNext }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const { width } = Dimensions.get('window');
  const flatListRef = useRef<FlatList>(null);
  
  const ITEM_WIDTH = width - 48; // Total horizontal padding (24 on each side)

  const slides: SlideItem[] = useMemo(() => [
    {
      title: "Break the autopilot scroll.",
      description: "ScreenBreak's Focus Challenge adds a playful pause before distractions. Intercept the habit before it consumes your morning.",
      tag: "FEATURE 01",
      icon: "motion-photos-off"
    },
    {
      title: "Know where your time goes.",
      description: "See the patterns that spark better habits: most-used apps, streaks, and trouble hours.",
      tag: "FEATURE 02",
      icon: "radar"
    },
    {
      title: "Build focus on your terms.",
      description: "Create flexible schedules that match the way you actually live and work.",
      tag: "FEATURE 03",
      icon: "tune"
    }
  ], []);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems && viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index ?? 0);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50
  }).current;

  const scrollToIndex = useCallback((index: number) => {
    if (index >= 0 && index < slides.length) {
      flatListRef.current?.scrollToIndex({ index, animated: true });
    }
  }, [slides.length]);

  const renderItem: ListRenderItem<SlideItem> = ({ item, index }) => (
    <View style={{ width: ITEM_WIDTH }} className="flex-col h-full bg-black">
        <View className="flex-col gap-10">
            {/* Icon / Decor Box */}
            <View className="w-full h-64 bg-[#0e0e0e] border border-[#474747]/20 flex items-center justify-center p-12 relative overflow-hidden">
                <View className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
                
                <MaterialIcons name={item.icon} size={140} color="white" style={{ opacity: 0.15 }} />

                {/* Power level indicator */}
                <View className="absolute bottom-10 left-10 right-10 h-1 bg-[#2a2a2a] overflow-hidden">
                    <View className="h-full bg-[#ffb4aa]" style={{ width: `${(index + 1) * (100 / slides.length)}%` }} />
                </View>
            </View>

            {/* Text Details */}
            <View className="flex-col gap-6 pr-4">
                <Text className="font-label text-xs tracking-[0.3em] uppercase text-white/40">
                    {item.tag}
                </Text>
                <Text className="font-headline text-5xl  tracking-tighter leading-[0.9] text-white">
                    {item.title}
                </Text>
                <Text className="text-xl text-[#c6c6c6] font-light leading-relaxed">
                    {item.description}
                </Text>
            </View>
        </View>
    </View>
  );

  return (
    <View className="flex-1 bg-black pt-12 pb-6 px-6">
      
      {/* Main Content Area - Explicitly clipping overflow */}
      <View style={{ width: ITEM_WIDTH }} className="flex-1 overflow-hidden">
          <FlatList
            ref={flatListRef}
            data={slides}
            renderItem={renderItem}
            keyExtractor={(_, index) => index.toString()}
            horizontal
            pagingEnabled={false}
            showsHorizontalScrollIndicator={false}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            snapToInterval={ITEM_WIDTH}
            snapToAlignment="start"
            decelerationRate="fast"
            scrollEventThrottle={16}
            getItemLayout={(_, index) => ({
                length: ITEM_WIDTH,
                offset: ITEM_WIDTH * index,
                index,
            })}
            style={{ width: ITEM_WIDTH }}
            contentContainerStyle={{ width: ITEM_WIDTH * slides.length }}
          />
      </View>

      {/* Carousel Controls & Status - Reduced bottom margin */}
      <View className="flex-row items-center justify-between mt-4 mb-4 px-2">
          <View className="flex-col gap-4">
              <View className="flex-row gap-3">
                  {slides.map((_, dotIndex) => (
                      <View 
                          key={dotIndex} 
                          className={`h-1 !w-12 ${activeIndex === dotIndex ? 'bg-white' : 'bg-white/20'}`} 
                      />
                  ))}
              </View>
              <Text className="font-label text-[10px] tracking-[0.3em] uppercase text-white/60">
                  STEP 0{activeIndex + 1} / 0{slides.length}
              </Text>
          </View>

          {/* Nav Buttons */}
          <View className="flex-row gap-4">
              <TouchableOpacity 
                onPress={() => scrollToIndex(activeIndex - 1)}
                activeOpacity={0.7}
                disabled={activeIndex === 0}
                className={`w-12 h-12 items-center justify-center border ${activeIndex === 0 ? 'border-[#474747]/10' : 'border-[#474747]/30'} bg-transparent active:bg-white`}
              >
                  <MaterialIcons name="chevron-left" size={24} color={activeIndex === 0 ? '#474747' : 'white'} />
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => scrollToIndex(activeIndex + 1)}
                activeOpacity={0.7}
                disabled={activeIndex === slides.length - 1}
                className={`w-12 h-12 items-center justify-center border ${activeIndex === slides.length - 1 ? 'border-[#474747]/10' : 'border-[#474747]/30'} bg-transparent active:bg-white`}
              >
                  <MaterialIcons name="chevron-right" size={24} color={activeIndex === slides.length - 1 ? '#474747' : 'white'} />
              </TouchableOpacity>
          </View>
      </View>

      {/* Action Block - Normalized spacing */}
      <View className="w-full">
          <TouchableOpacity 
              onPress={onNext}
              activeOpacity={0.8}
              className="w-full bg-white py-6 flex flex-row items-center justify-center rounded-none active:scale-[0.98] transition-all"
          >
              <Text className="text-black text-sm  text font-headline tracking-[0.4em] uppercase mr-2">
                  CONTINUE
              </Text>
              <MaterialIcons name="arrow-forward" size={18} color="black" />
          </TouchableOpacity>
      </View>

    </View>
  );
};
