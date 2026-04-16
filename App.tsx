import 'react-native-gesture-handler';
import { enableScreens } from 'react-native-screens';

enableScreens();
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LogBox, View, ActivityIndicator, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';

// Configure Reanimated Logger to disable strict mode warnings
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false, 
});

import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts, Outfit_400Regular, Outfit_700Bold } from '@expo-google-fonts/outfit';
import { Inter_400Regular, Inter_700Bold, Inter_800ExtraBold, Inter_900Black } from '@expo-google-fonts/inter';
import { SpaceGrotesk_300Light, SpaceGrotesk_400Regular, SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import './core/sdk/provider'; // Initialize the SDK Global

import { BlockingProvider } from './context/BlockingContext';
import { BreakOverlay } from './components/blocking/BreakOverlay';
import { HomeScreen } from './components/screens/HomeScreen';
import { BlocksScreen } from './components/screens/BlocksScreen';
import { SocialsScreen } from './components/screens/SocialsScreen';
import { SettingsScreen } from './components/screens/SettingsScreen';
import { OnboardingScreen } from './components/screens/OnboardingScreen';
import { FluidTabBar } from './components/navigation/FluidTabBar';
import { SelectionProvider } from './context/SelectionContext';
import { GlobalModals } from './components/ui/GlobalModals';
import { FocusStorageService, BlockSession } from './services/FocusStorageService';
import { FocusActiveScreen } from './components/blocks/FocusActiveScreen';
import { AgreementScreen } from './components/screens/AgreementScreen';
import './global.css';

// Build 0.81.5 has fixed safeAreaView but dependencies might still use it
LogBox.ignoreLogs([
  /SafeAreaView has been deprecated/,
  /ProgressBarAndroid has been extracted/,
  /Clipboard has been extracted/,
  /PushNotificationIOS has been extracted/
]);

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const TabNavigator = () => {
  return (
    <Tab.Navigator
        tabBar={props => <FluidTabBar {...props} />}
        screenOptions={{
            headerShown: false,
            tabBarStyle: { position: 'absolute' }, 
            freezeOnBlur: true,
        }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Blocks" component={BlocksScreen} />
      {Platform.OS === 'ios' && (
        <Tab.Screen name="Socials" component={SocialsScreen} />
      )}
    </Tab.Navigator>
  );
};

const NavigationTree = ({ isFirstLaunch }: { isFirstLaunch: boolean }) => {
  return (
    <NavigationContainer
        theme={{
            ...DefaultTheme,
            colors: {
                ...DefaultTheme.colors,
                background: 'black',
            },
        }}
    >
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            {isFirstLaunch && (
                <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            )}
            <Stack.Screen name="Main" component={TabNavigator} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="Agreement" component={AgreementScreen} />
        </Stack.Navigator>
      <BreakOverlay />
    </NavigationContainer>
  );
};

export default function App() {
  const [isFirstLaunch, setIsFirstLaunch] = useState<boolean | null>(null);
  const [activeSession, setActiveSession] = useState<BlockSession | null>(null);
  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_700Bold,
    Inter_400Regular,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
    SpaceGrotesk_300Light,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
  });

  useEffect(() => {
    async function checkState() {
      try {
        // RESET FOR TESTING: Force onboarding to restart from scratch
        await AsyncStorage.removeItem('hasLaunched');
        setIsFirstLaunch(true);
        
        const session = await FocusStorageService.getActiveSession();
        setActiveSession(session);
      } catch (error) {
         console.error('Error checking state:', error);
         setIsFirstLaunch(false);
      }
    }
    checkState();

    const interval = setInterval(async () => {
        const session = await FocusStorageService.getActiveSession();
        setActiveSession(session);
    }, 15000);
    
    return () => clearInterval(interval);
  }, []);

  if (!fontsLoaded || isFirstLaunch === null) {
      return (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
              <ActivityIndicator size="large" color="#fff" />
          </View>
      );
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <BottomSheetModalProvider>
          <BlockingProvider>
            <SelectionProvider>
              <NavigationTree isFirstLaunch={Boolean(isFirstLaunch)} />
              <GlobalModals />
            </SelectionProvider>
            <StatusBar style="light" /> 
          </BlockingProvider>
        </BottomSheetModalProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}