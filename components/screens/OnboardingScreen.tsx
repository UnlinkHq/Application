import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { WelcomeStep } from './onboarding/WelcomeStep';
import { SoundFamiliarStep } from './onboarding/SoundFamiliarStep';
import { ScreenTimeGoalStep } from './onboarding/ScreenTimeGoalStep';
import { PermissionStep } from './onboarding/PermissionStep';
import { ScreenTimeReportStep } from './onboarding/ScreenTimeReportStep';
import { AppUsageStep } from './onboarding/AppUsageStep';
import { ScreenTimeComparisonStep } from './onboarding/ScreenTimeComparisonStep';
import { ReclaimTimeStep } from './onboarding/ReclaimTimeStep';
import { HowItHelpsStep } from './onboarding/HowItHelpsStep';
import { PaywallStep } from './onboarding/PaywallStep';
import { UnifiedPermissionStep } from './onboarding/UnifiedPermissionStep';
import { JourneyBeginStep } from './onboarding/JourneyBeginStep';
import { OnboardingHeader } from './onboarding/OnboardingHeader';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ScreenTimeModule from '../../modules/screen-time';

export const OnboardingScreen = () => {
  const navigation = useNavigation<any>();
  const [currentStep, setCurrentStep] = useState(0);
  const [screenTimeGoal, setScreenTimeGoal] = useState(4);

  // Performance Optimization: Pre-fetched data
  const [usageStats, setUsageStats] = useState<any>(null); // { daily: {packageName: duration}, weekHistory: [{day: string, duration: number}] }
  const [installedApps, setInstalledApps] = useState<any[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const prevStep = React.useRef(0);

  const TOTAL_STEPS = 10; 

  // Pre-fetch data earlier (Step 2) or auto-skip Step 3
  useEffect(() => {
    const checkAndPreload = async () => {
      const hasPerm = await ScreenTimeModule.hasPermission();
      const movingForward = currentStep > prevStep.current;
      
      // Auto-skip Step 3 if permission is already there AND we are moving forward
      if (currentStep === 3 && hasPerm && movingForward) {
          prefetchData();
          handleNext();
          prevStep.current = currentStep;
          return;
      }

      // Early pre-fetch if at goal step and has permission
      if (currentStep >= 2 && hasPerm && !isDataLoaded) {
        prefetchData();
      }
      
      prevStep.current = currentStep;
    };
    
    checkAndPreload();
  }, [currentStep, isDataLoaded]);

  const prefetchData = async () => {
    if (isDataLoaded) return;
    try {
      const hasPermission = await ScreenTimeModule.hasPermission();
      if (!hasPermission) return;

      const now = new Date();
      const end = now.getTime();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).getTime();

      // Fetch apps and 7-day total usage
      const [allUsage, apps] = await Promise.all([
        ScreenTimeModule.getUsageStats(start, end),
        ScreenTimeModule.getInstalledApps()
      ]);

      // Fetch daily breakdown for the chart
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const weekHistory = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const startOfDay = new Date(d.setHours(0, 0, 0, 0)).getTime();
        const endOfDay = new Date(d.setHours(23, 59, 59, 999)).getTime();
        
        const dayStats = await ScreenTimeModule.getUsageStats(startOfDay, endOfDay);
        const dayDuration = Object.values(dayStats.daily || {}).reduce((sum, val) => (sum as number) + (val as number), 0);
        
        weekHistory.push({
          day: days[new Date(startOfDay).getDay()],
          duration: (dayDuration as number) / 1000
        });
      }

      setUsageStats({
        daily: allUsage.daily || {},
        weekHistory
      });
      setInstalledApps(apps);
      setIsDataLoaded(true);
    } catch (error) {
      console.error("Error pre-fetching data:", error);
    }
  };

  const handleNext = async () => {
    if (currentStep === 2) {
      await AsyncStorage.setItem('@unlink_goal', screenTimeGoal.toString());
    }

    if (currentStep < TOTAL_STEPS - 1) {
      setCurrentStep(currentStep + 1);
    } else {
        handleFinishOnboarding();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      // If we are at Step 4 (Report) and go back, skip Step 3 (Permission Gate) and go to Step 2
      if (currentStep === 4) {
        setCurrentStep(2);
      } else {
        setCurrentStep(currentStep - 1);
      }
    }
  };

  const handleFinishOnboarding = async () => {
    await AsyncStorage.setItem('hasLaunched', 'true');
    navigation.replace('Main', { screen: 'Blocks' });
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      {currentStep > 0 && currentStep < 10 && (
        <OnboardingHeader 
          currentStep={currentStep} 
          totalSteps={TOTAL_STEPS} 
          onBack={handleBack}
          showBack={currentStep > 0}
        />
      )}
      
      <View className="flex-1">
        {currentStep === 0 && <WelcomeStep onNext={handleNext} />}
        {currentStep === 1 && <SoundFamiliarStep onNext={handleNext} />}
        {currentStep === 2 && (
          <ScreenTimeGoalStep 
              onNext={handleNext} 
              screenTimeGoal={screenTimeGoal}
              setScreenTimeGoal={setScreenTimeGoal}
          />
        )}
        {currentStep === 3 && (
          <UnifiedPermissionStep onPermissionGranted={async () => {
             prefetchData();
             handleNext();
          }} />
        )}
        {currentStep === 4 && (!isDataLoaded ? (
          <View className="flex-1 items-center justify-center bg-black">
             <Text className="text-white text-lg font-headline font-bold uppercase tracking-widest mb-4">Analyzing Data...</Text>
             <Text className="text-[#919191] font-label text-xs uppercase tracking-[0.2em] mb-8">This takes just a second</Text>
             <ActivityIndicator color="#ffffff" size="large" />
          </View>
        ) : (
          <ScreenTimeReportStep 
              onNext={handleNext} 
              screenTimeGoal={screenTimeGoal}
              preFetchedData={usageStats?.weekHistory}
          />
        ))}
        {currentStep === 5 && (
          <AppUsageStep 
            onNext={handleNext} 
            preFetchedData={usageStats}
            preFetchedApps={installedApps}
          />
        )}
        {currentStep === 6 && (
          <ScreenTimeComparisonStep 
            onNext={handleNext} 
            preFetchedData={usageStats}
          />
        )}
        {currentStep === 7 && (
          <ReclaimTimeStep 
            onNext={handleNext} 
            preFetchedData={usageStats}
            screenTimeGoal={screenTimeGoal}
          />
        )}
        {currentStep === 8 && (
          <HowItHelpsStep onNext={handleNext} />
        )}
        {currentStep === 9 && (
          <JourneyBeginStep onFinish={handleFinishOnboarding} />
        )}
      </View>
    </SafeAreaView>
  );
};
