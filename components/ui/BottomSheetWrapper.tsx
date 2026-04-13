import React, { useCallback, useRef, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { 
  BottomSheetModal, 
  BottomSheetBackdrop, 
  BottomSheetScrollView,
  BottomSheetBackdropProps,
  BottomSheetBackgroundProps
} from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface BottomSheetWrapperProps {
  visible: boolean;
  onClose: () => void;
  onBack?: () => void;
  title?: string;
  children: React.ReactNode;
  snapPoints?: (string | number)[];
  animatedIndex?: SharedValue<number>;
}

const CustomBackground = ({ style }: BottomSheetBackgroundProps) => (
  <View 
    pointerEvents="none"
    style={[
      style,
      {
        backgroundColor: '#000',
        borderWidth: 2,
        borderColor: '#FFF',
        // borderTopLeftRadius: 24,
        // borderTopRightRadius: 24,
        // borderBottomWidth: 30, // Let the content handle the bottom closure for better control
      }
    ]} 
  />
);

export const BottomSheetWrapper = ({ 
  visible, 
  onClose, 
  onBack,
  title, 
  children, 
  snapPoints = ['100%'], // Default to a high snap point to show full content at first
  animatedIndex
}: BottomSheetWrapperProps) => {
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      bottomSheetModalRef.current?.present();
    } else {
      bottomSheetModalRef.current?.dismiss();
    }
  }, [visible]);

  const handleSheetChanges = useCallback((index: number) => {
    if (index === -1) {
      onClose();
    }
  }, [onClose]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        opacity={0.5}
        enableTouchThrough={false}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
      />
    ),
    []
  );

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      index={0}
      snapPoints={snapPoints}
      onChange={handleSheetChanges}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundComponent={CustomBackground}
      handleIndicatorStyle={styles.indicator}
      animatedIndex={animatedIndex}
      stackBehavior="push"
    >
      <View style={[styles.contentContainer]}>
        {title && (
          <View style={styles.header}>
            <View className="flex-row items-center gap-3">
              {onBack && (
                <TouchableOpacity onPress={onBack} className="p-1">
                  <Ionicons name="chevron-back" size={24} color="white" />
                </TouchableOpacity>
              )}
              <Text className="text-white font-headline font-black text-2xl uppercase tracking-tighter">
                {title}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} className="p-1 border border-white/20">
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>
        )}
        
        <BottomSheetScrollView 
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={{ 
            flexGrow: 1, 
            paddingBottom: insets.bottom +20
          }}
        >
          {children}

          {/* Explicit Bottom Surgical Boundary */}
          <View className="h-4 border-t-2 border-white/20 mt-10 mb-4" />
        </BottomSheetScrollView>
      </View>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  indicator: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    width: 48,
    marginTop: 4,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20, 
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 12,
  },
});
