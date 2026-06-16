import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { enableScreens } from 'react-native-screens';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LogBox, View, ActivityIndicator, Platform, AppState, Modal, Text, TouchableOpacity } from 'react-native';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';

import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts, Outfit_400Regular, Outfit_700Bold } from '@expo-google-fonts/outfit';
import { Inter_400Regular, Inter_700Bold, Inter_800ExtraBold, Inter_900Black } from '@expo-google-fonts/inter';
import { SpaceGrotesk_300Light, SpaceGrotesk_400Regular, SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';

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
import { IntentGateScreen } from './components/screens/IntentGateScreen';
import { addNativeBreakListener } from './modules/screen-time';
import { PremiumSplash } from './components/ui/PremiumSplash';
import { TemporalEngine } from './services/TemporalEngine';
import { SessionIntegrityService, IntegrityBreakResult } from './services/SessionIntegrityService';
import './global.css';

enableScreens();

// Configure Reanimated Logger to disable strict mode warnings
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

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

const NavigationTree = ({ isFirstLaunch, onCompleteOnboarding }: { isFirstLaunch: boolean, onCompleteOnboarding: () => void }) => {
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
          <Stack.Screen name="Onboarding">
            {props => <OnboardingScreen {...props} onFinish={onCompleteOnboarding} />}
          </Stack.Screen>
        )}
        <Stack.Screen name="Main" component={TabNavigator} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Agreement" component={AgreementScreen} />
        <Stack.Screen name="IntentGate" component={IntentGateScreen} options={{ gestureEnabled: false }} />
      </Stack.Navigator>
      <BreakOverlay />
    </NavigationContainer>
  );
};

export default function App() {
  const [isFirstLaunch, setIsFirstLaunch] = useState<boolean | null>(null);
  const [activeSession, setActiveSession] = useState<BlockSession | null>(null);
  const [integrityBreak, setIntegrityBreak] = useState<IntegrityBreakResult | null>(null);

  const runIntegrityCheck = async () => {
    try {
      const result = await SessionIntegrityService.checkAndConsume();
      if (result) setIntegrityBreak(result);
    } catch (e) {
      // never block the app on this
    }
  };
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
    // Start the Surgical Temporal Engine for auto-deploying schedules
    TemporalEngine.start();

    async function checkState() {
      try {
        const hasLaunched = await AsyncStorage.getItem('hasLaunched');
        const onboarded = hasLaunched === 'true';
        setIsFirstLaunch(!onboarded);

        const session = await FocusStorageService.getActiveSession();
        setActiveSession(session);
      } catch (error) {
        console.error('[App] Error checking persistence state:', error);
        setIsFirstLaunch(false); // Default to home on error for better UX
      }
    }
    checkState();
    // Detect sessions interrupted (force-stop / OEM kill) while we were away.
    runIntegrityCheck();
    const appStateSub = AppState.addEventListener('change', (next) => {
      if (next === 'active') runIntegrityCheck();
    });

    // Interval check for session changes
    const interval = setInterval(async () => {
      try {
        const session = await FocusStorageService.getActiveSession();
        setActiveSession(session);
      } catch (error) {
        console.error('[App] Session poll error:', error);
      }
    }, 15000);

    // Listen for native break requests from the coach overlay
    const subscription = addNativeBreakListener(async (event) => {
      const session = await FocusStorageService.getActiveSession();
      if (session && !session.isOnBreak) {
        const updated = await FocusStorageService.toggleBreak();
        if (updated) setActiveSession(updated);
      }
    });

    return () => {
      TemporalEngine.stop();
      subscription.remove();
      appStateSub.remove();
      clearInterval(interval);
    };
  }, []);

  const [minSplashReady, setMinSplashReady] = useState(false);

  useEffect(() => {
    // Ensure the splash is visible for at least 2.5 seconds for branding impact
    const timer = setTimeout(() => setMinSplashReady(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  if (!fontsLoaded || isFirstLaunch === null || !minSplashReady) {
    return <PremiumSplash />;
  }

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem('hasLaunched', 'true');
      setIsFirstLaunch(false);
    } catch (e) {
      console.error('Failed to save onboarding state:', e);
      setIsFirstLaunch(false); // Proceed anyway
    }
  };

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <BottomSheetModalProvider>
          <BlockingProvider>
            <SelectionProvider>
              <NavigationTree
                isFirstLaunch={Boolean(isFirstLaunch)}
                onCompleteOnboarding={completeOnboarding}
              />
              <GlobalModals />
              <Modal
                visible={!!integrityBreak}
                transparent
                animationType="fade"
                onRequestClose={() => setIntegrityBreak(null)}
              >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', paddingHorizontal: 28 }}>
                  <View style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: '#0a0a0a', padding: 28 }}>
                    <Text style={{ color: '#ff4444', fontWeight: '900', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>
                      SESSION INTERRUPTED
                    </Text>
                    <Text style={{ color: '#fff', fontWeight: '900', fontSize: 20, marginBottom: 12 }}>
                      You broke focus.
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 18, marginBottom: 8 }}>
                      "{integrityBreak?.title}" was interrupted for about {integrityBreak?.minutesSilent} min — the app was force-stopped or closed by your phone before the session finished. This counts as a break in your streak.
                    </Text>
                    {integrityBreak?.partnerNotified ? (
                      <Text style={{ color: '#72fe88', fontSize: 11, marginBottom: 8 }}>
                        Your accountability partner has been notified.
                      </Text>
                    ) : null}
                    <TouchableOpacity
                      onPress={() => setIntegrityBreak(null)}
                      style={{ marginTop: 16, backgroundColor: '#fff', paddingVertical: 16, alignItems: 'center' }}
                    >
                      <Text style={{ color: '#000', fontWeight: '900', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' }}>
                        I UNDERSTAND
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>
            </SelectionProvider>
            <StatusBar style="light" />
          </BlockingProvider>
        </BottomSheetModalProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}