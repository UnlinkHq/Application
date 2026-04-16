import React, { useCallback, useRef, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Platform } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetView,
  BottomSheetBackdropProps,
  BottomSheetBackgroundProps
} from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface BottomSheetWrapperProps {
  visible: boolean;
  onClose: () => void;
  onBack?: () => void;
  title?: string;
  children: React.ReactNode;
  snapPoints?: (string | number)[];
  enableDynamicSizing?: boolean;
}

const AttachedBackground = ({ style }: BottomSheetBackgroundProps) => {
  const dynamicShadow = Platform.OS === 'android' ?
    { elevation: 8 } :
    {
      shadowColor: '#FFF',
      shadowOffset: { width: 0, height: -10 },
      shadowOpacity: 0.15,
      shadowRadius: 20,
    };

  return (
    <View
      pointerEvents="none"
      style={[
        style,
        {
          backgroundColor: '#0a0a0a',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.08)',
          borderBottomWidth: 0,
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
          ...dynamicShadow
        }
      ]}
    />
  );
};



export const BottomSheetWrapper = ({
  visible,
  onClose,
  onBack,
  title,
  children,
  snapPoints = ['90%'], // Default to a safe height to not cover the notification bar
  enableDynamicSizing = false,
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
      backgroundComponent={AttachedBackground}
      handleIndicatorStyle={styles.indicator}
      stackBehavior="push"
      topInset={insets.top}
      enableDynamicSizing={enableDynamicSizing}
      bottomInset={0}
    >
      {enableDynamicSizing ? (
        <BottomSheetView style={[{ paddingHorizontal: 20, paddingBottom: insets.bottom || 20 }]}>
          {title && (
            <View style={styles.header}>
              <View className="flex-row items-center gap-3">
                {onBack && (
                  <TouchableOpacity onPress={onBack} className="p-1">
                    <Ionicons name="chevron-back" size={24} color="white" />
                  </TouchableOpacity>
                )}
                <Text className="text-white font-headline font-black text-2xl tracking-widest uppercase">
                  {title}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} className="border border-white/20 items-center justify-center" style={{ width: 32, height: 32 }}>
                <Ionicons name="close" size={20} color="white" />
              </TouchableOpacity>
            </View>
          )}

          {children}
        </BottomSheetView>
      ) : (
        <View style={[{ flex: 1, paddingHorizontal: 20, paddingBottom: insets.bottom || 20 }]}>
          {title && (
            <View style={styles.header}>
              <View className="flex-row items-center gap-3">
                {onBack && (
                  <TouchableOpacity onPress={onBack} className="p-1">
                    <Ionicons name="chevron-back" size={24} color="white" />
                  </TouchableOpacity>
                )}
                <Text className="text-white font-headline font-black text-2xl uppercase tracking-widest">
                  {title}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} className="border border-white/20 items-center justify-center" style={{ width: 32, height: 32 }}>
                <Ionicons name="close" size={20} color="white" />
              </TouchableOpacity>
            </View>
          )}

          {children}
        </View>
      )}
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  indicator: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    width: 48,
    marginTop: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 12,
  },
});
