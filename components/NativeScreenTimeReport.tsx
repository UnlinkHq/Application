import { requireNativeViewManager } from 'expo-modules-core';
import { ViewProps } from 'react-native';

interface NativeScreenTimeReportProps extends ViewProps {
  // Add props here if needed, e.g. filter duration
}

export const NativeScreenTimeReport = requireNativeViewManager<NativeScreenTimeReportProps>('ScreenTime');
