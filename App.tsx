import 'react-native-gesture-handler';
import { enableScreens } from 'react-native-screens';

enableScreens();
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LogBox, View, ActivityIndicator } from 'react-native';
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

import { Ionicons } from '@expo/vector-icons';
import { BlockingProvider } from './context/BlockingContext';
import { BreakOverlay } from './components/blocking/BreakOverlay';
import { HomeScreen } from './components/screens/HomeScreen';
import { BlocksScreen } from './components/screens/BlocksScreen';
import { ExtensionsScreen } from './components/screens/ExtensionsScreen';
import { SocialsScreen } from './components/screens/SocialsScreen';
import { SettingsScreen } from './components/screens/SettingsScreen';
import { OnboardingScreen } from './components/screens/OnboardingScreen';
import { FluidTabBar } from './components/navigation/FluidTabBar';
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

function TabNavigator() {
  return (
    <Tab.Navigator
        tabBar={props => <FluidTabBar {...props} />}
        screenOptions={{
            headerShown: false,
            // Hide default background since our custom bar handles it
            tabBarStyle: { position: 'absolute' }, 
            freezeOnBlur: true,
        }}
    >
      <Tab.Screen name="Today" component={HomeScreen} />
      <Tab.Screen name="Blocks" component={BlocksScreen} />
      <Tab.Screen name="Socials" component={SocialsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [isFirstLaunch, setIsFirstLaunch] = useState<boolean | null>(null);
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
    async function checkFirstLaunch() {
      try {
        const value = await AsyncStorage.getItem('hasLaunched');
        if (value === 'true') {
          setIsFirstLaunch(false);
        } else {
          setIsFirstLaunch(true);
        }
      } catch (error) {
         console.error('Error checking first launch:', error);
         setIsFirstLaunch(false); // Default to main if error
      }
    }
    checkFirstLaunch();
  }, []);

  if (!fontsLoaded || isFirstLaunch === null) {
      return (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
              <ActivityIndicator size="large" color="#ec4899" />
          </View>
      );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <SafeAreaProvider>
          <BlockingProvider>
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
                </Stack.Navigator>
               <BreakOverlay />
            </NavigationContainer>
            <StatusBar style="auto" /> 
          </BlockingProvider>
        </SafeAreaProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}