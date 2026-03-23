import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

export const InstagramSandbox = ({ 
  vipList, 
  onComplete,
  onClose
}: { 
  vipList: string[], 
  onComplete: () => void,
  onClose: () => void 
}) => {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    // Failsafe: if the webview gets stuck loading due to a blocked intent redirect, clear the spinner after 6s
    let timer: NodeJS.Timeout;
    if (isLoading) {
      timer = setTimeout(() => setIsLoading(false), 6000);
    }
    return () => clearTimeout(timer);
  }, [isLoading]);

  // The CSS Sniper: This hides the navigation bars on Instagram's mobile site
  const INJECTED_JAVASCRIPT = `
    setTimeout(function() {
      // Hide standard navigation elements
      var navElements = document.querySelectorAll('nav, [role="navigation"]');
      for (var i = 0; i < navElements.length; i++) {
        navElements[i].style.display = 'none !important';
      }
      
      // Hide 'Open in App' banners
      var banners = document.querySelectorAll('div[class*="banner"]');
      for (var i = 0; i < banners.length; i++) {
        banners[i].style.display = 'none !important';
      }
      
      // Force body to not show overflow if they try to pull down to refresh
      document.body.style.overscrollBehavior = 'none';
    }, 500); // 500ms delay to ensure DOM is loaded before firing
    true; // Required by React Native WebView
  `;

  const handleNextVip = () => {
    if (currentIndex < vipList.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // Array is finished. Trigger State 3 (isCaughtUp) in your main UI.
      onComplete();
    }
  };

  const currentVipUrl = `https://www.instagram.com/stories/${vipList[currentIndex].replace('@', '')}/`;

  // Pre-emptively check for the unauthenticated splash screen and redirect to login
  const AUTO_LOGIN_REDIRECT_JS = `
    (function() {
      // If we see "See [user]'s story before it disappears" or "Open Instagram" button, we are not logged in.
      var splashButtons = document.querySelectorAll('button, a');
      var isSplash = false;
      for (var i = 0; i < splashButtons.length; i++) {
        if (splashButtons[i].innerText.includes('Instagram') || splashButtons[i].innerText.includes('Sign Up')) {
          isSplash = true;
          break;
        }
      }
      
      if (isSplash || document.body.innerText.includes('story before it disappears')) {
        window.location.href = 'https://www.instagram.com/accounts/login/';
      }
    })();
    true;
  `;

  const handleNavStateChange = (newNavState: any) => {
    const { url, loading } = newNavState;
    
    // Clear loading spinner when navigation technically finishes 
    if (!loading) {
      setIsLoading(false);
    }

    if (url.includes('instagram.com/accounts/login')) {
      // User is on the login page
      setIsLoggingIn(true);
    } else if (url.includes('instagram.com/stories') && !loading) {
      // Check if we are stuck on the "preview" splash screen (not logged in)
      // Instagram often shows this splash screen if not logged in.
      // We can check if the URL still contains the story but the DOM shows login prompts.
      // Alternatively, we can inject JS to check if the user is logged in.
      
      webViewRef.current?.injectJavaScript(`
        (function() {
          var loginBtn = document.querySelector('a[href*="/accounts/login"]');
          var signupBtn = document.querySelector('a[href*="/accounts/emailsignup"]');
          if (loginBtn || signupBtn) {
            window.location.href = 'https://www.instagram.com/accounts/login/';
          }
        })();
        true;
      `);
      setIsLoggingIn(false);
    } else if (isLoggingIn && !url.includes('accounts/login')) {
      // User just finished logging in and got redirected (often to the feed).
      // Force them immediately to the VIP's story!
      setIsLoggingIn(false);
      setIsLoading(true);
      if (webViewRef.current) {
         webViewRef.current.injectJavaScript(`window.location.href = '${currentVipUrl}'; true;`);
      }
    }
  };

  const onShouldStartLoadWithRequest = (request: any) => {
    // Prevent Instagram from redirecting to the native app via Deep Links
    if (request.url.startsWith('intent://') || request.url.startsWith('instagram://') || request.url.startsWith('market://')) {
      return false; // Block the redirect
    }
    return true; // Allow http/https normally
  };

  return (
    <View style={sandboxStyles.container}>
      {/* The Native Overlay: This sits ON TOP of the webview so they can skip to the next VIP */}
      <View style={[sandboxStyles.nativeHeader, { paddingTop: insets.top, height: 60 + insets.top }]}>
        <TouchableOpacity style={sandboxStyles.closeIconButton} onPress={onClose}>
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>

        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={sandboxStyles.headerText}>
            {isLoggingIn ? "Login Required" : `Viewing: ${vipList[currentIndex]}`}
          </Text>
        </View>

        {!isLoggingIn ? (
          <TouchableOpacity style={sandboxStyles.nextButton} onPress={handleNextVip}>
            <Text style={sandboxStyles.nextButtonText}>Next</Text>
            <Ionicons name="chevron-forward" size={16} color="#000" style={{ marginLeft: 2 }} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 65 }} /> /* Balance the header */
        )}
      </View>

      <View style={{ flex: 1 }}>
        <WebView
          ref={webViewRef}
          source={{ uri: currentVipUrl }}
          injectedJavaScript={INJECTED_JAVASCRIPT + AUTO_LOGIN_REDIRECT_JS}
          sharedCookiesEnabled={true} // CRITICAL: Keeps them logged in on iOS
          thirdPartyCookiesEnabled={true} // CRITICAL: Keeps them logged in on Android
          domStorageEnabled={true} // CRITICAL: Enables persistent session storage for React Native WebView!
          javaScriptEnabled={true} // Always needed for complex modern SPAs like Instagram
          allowsBackForwardNavigationGestures={false} // Prevents swiping back to the main feed
          bounces={false}
          onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
          onNavigationStateChange={handleNavStateChange}
          onLoadStart={() => setIsLoading(true)}
          onLoadEnd={() => setIsLoading(false)}
          onError={() => setIsLoading(false)}
          onHttpError={() => setIsLoading(false)}
          style={sandboxStyles.webview}
        />

        {/* Loading Overlay */}
        {isLoading && (
          <View style={sandboxStyles.loadingOverlay}>
            <ActivityIndicator size="large" color="#ec4899" />
            <Text style={sandboxStyles.loadingText}>Loading Feed...</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const sandboxStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingBottom: 70 }, // Responsive padding for tab bar
  nativeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#000', // Solid black for a premium look
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f1f', // Darker border
    zIndex: 20,
  },
  closeIconButton: {
    width: 44, // Standard touch target size
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { 
    color: '#fff', 
    fontSize: 15, 
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', 
    fontWeight: '700',
    letterSpacing: -0.5
  },
  nextButton: { 
    backgroundColor: '#fff', 
    paddingHorizontal: 12, 
    paddingVertical: 7, 
    borderRadius: 8, // Square-ish rounded for command center feel
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
  },
  nextButtonText: { color: '#000', fontWeight: '800', fontSize: 13, textTransform: 'uppercase' },
  webview: { flex: 1, backgroundColor: '#000' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    color: '#71717a', // zinc-500
    marginTop: 16,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase'
  }
});

export const SocialsScreen = () => {
  const navigation = useNavigation<any>();

  // Use local state as requested to manage our 3 UI states
  const [isEmpty, setIsEmpty] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [isCaughtUp, setIsCaughtUp] = useState(false);
  const [showWebView, setShowWebView] = useState(false);

  // VIP Setup State
  const [vips, setVips] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');

  // Lock Timer State (e.g. 10 seconds for testing instead of 12 hours)
  // For production, this would be 12 * 60 * 60
  const [timeLeft, setTimeLeft] = useState(5); // 5 seconds for easy testing

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLocked && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isLocked, timeLeft]);

  // Format seconds to HH:MM:SS
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleAddVip = () => {
    const trimmed = inputValue.trim();
    if (trimmed && vips.length < 5 && !vips.includes(trimmed)) {
      setVips([...vips, trimmed.startsWith('@') ? trimmed : `@${trimmed}`]);
      setInputValue('');
    }
  };

  const handleRemoveVip = (vipToRemove: string) => {
    setVips(vips.filter(v => v !== vipToRemove));
  };

  const handleLockIn = () => {
    if (vips.length > 0) {
      setIsEmpty(false);
      setIsLocked(true);
      // setTimeLeft(12 * 60 * 60); // 12 hours for real usage
      setTimeLeft(0); // 0 for testing per user request
    }
  };

  const handleOpenWebView = () => {
    // Show the Web View Sandbox
    setShowWebView(true);
  };
  
  const handleWebViewComplete = () => {
    setShowWebView(false);
    setIsLocked(false);
    setIsCaughtUp(true);
  };

  const handleWebViewClose = () => {
    // Abandon session back to State 2 (timer active)
    setShowWebView(false);
  };

  const handleExit = () => {
    // Reset back to locked state with new timer
    setIsCaughtUp(false);
    setIsLocked(true);
    setTimeLeft(12 * 60 * 60); // Reset to 12 hours in production
    
    // Navigate back to main dashboard
    navigation.navigate('Today');
  };

  // ---------------------------------------------------------------------------
  // STATE 1: VIP Setup
  // ---------------------------------------------------------------------------
  if (isEmpty) {
    return (
      <SafeAreaView className="flex-1 bg-black" edges={['top']}>
        {/* Added pb-32 to fix the overlapping lock-in button with the tab bar */}
        <View className="flex-1 px-6 pt-10 pb-32">
          <Text className="text-white text-3xl font-bold mb-2 tracking-tight">
            Who actually matters?
          </Text>
          <Text className="text-zinc-400 text-base mb-8">
            Add up to 5 accounts. We block the rest.
          </Text>

          {/* Input Area */}
          <View className="flex-row mb-6">
            <TextInput
              className="flex-1 border border-zinc-800 bg-zinc-900 rounded-lg p-4 text-white text-lg mr-3"
              placeholder="@username"
              placeholderTextColor="#52525B"
              value={inputValue}
              onChangeText={setInputValue}
              autoCapitalize="none"
              autoCorrect={false}
              editable={vips.length < 5}
            />
            <TouchableOpacity 
              className={`justify-center px-6 rounded-lg border ${vips.length >= 5 || !inputValue.trim() ? 'border-zinc-800 opacity-50' : 'border-zinc-300'}`}
              onPress={handleAddVip}
              disabled={vips.length >= 5 || !inputValue.trim()}
            >
              <Text className="text-white font-semibold">Add</Text>
            </TouchableOpacity>
          </View>

          {/* VIP List */}
          <ScrollView className="flex-1">
            <View className="flex-row flex-wrap gap-3">
              {vips.map((vip) => (
                <View key={vip} className="flex-row items-center bg-zinc-900 border border-zinc-800 rounded-full py-2 px-4">
                  <Text className="text-white font-medium mr-2">{vip}</Text>
                  <TouchableOpacity onPress={() => handleRemoveVip(vip)}>
                    <Ionicons name="close-circle" size={18} color="#71717A" />
                  </TouchableOpacity>
                </View>
              ))}
              {vips.length === 0 && (
                <Text className="text-zinc-600 italic">No VIPs added yet.</Text>
              )}
            </View>
          </ScrollView>

          {/* Lock In Button */}
          <View className="pb-10 pt-4">
            <TouchableOpacity 
              className={`py-4 rounded-xl items-center ${vips.length > 0 ? 'bg-white' : 'bg-zinc-800 opacity-50'}`}
              onPress={handleLockIn}
              disabled={vips.length === 0}
            >
              <Text className={`font-bold text-lg ${vips.length > 0 ? 'text-black' : 'text-zinc-500'}`}>
                Lock In VIPs
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------------------------------
  // STATE 2: The Daily Check-In (Locked)
  // ---------------------------------------------------------------------------
  if (isLocked) {
    if (showWebView) {
      return (
        <InstagramSandbox 
          vipList={vips} 
          onComplete={handleWebViewComplete} 
          onClose={handleWebViewClose} 
        />
      );
    }

    const isReady = true; // Always ready for testing as requested

    return (
      <SafeAreaView className="flex-1 bg-black" edges={['top']}>
        <View className="flex-1 px-6 pt-10 pb-32 items-center justify-center">
          
          <Text className="text-white text-2xl font-bold mt-8 mb-4">
            Daily Socials Ready.
          </Text>

          <View className="flex-row flex-wrap justify-center my-6 gap-2">
            {vips.map((vip) => (
              <View key={vip} className="bg-zinc-900 border border-zinc-800 rounded-full py-2 px-4">
                <Text className="text-zinc-300">{vip}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity 
            className="w-full py-4 rounded-xl items-center bg-white"
            onPress={handleOpenWebView}
          >
            <Text className="font-bold text-lg text-black">
              View Daily Update
            </Text>
          </TouchableOpacity>
          
        </View>
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------------------------------
  // STATE 3: The "Caught Up" State
  // ---------------------------------------------------------------------------
  if (isCaughtUp) {
    return (
      <SafeAreaView className="flex-1 bg-black" edges={['top']}>
        <View className="flex-1 px-6 pb-32 items-center justify-center">
          
          <View className="w-24 h-24 rounded-full bg-zinc-900 items-center justify-center mb-8 border border-zinc-800">
            <Ionicons name="checkmark" size={48} color="#fff" />
          </View>
          
          <Text className="text-white text-3xl font-bold text-center mb-4 tracking-tight">
            You didn't miss anything.
          </Text>
          <Text className="text-zinc-400 text-lg text-center mb-12 px-4">
            The world is not sleeping, but your feed is. Get back to work.
          </Text>

          <TouchableOpacity 
            className="w-full bg-white py-4 rounded-xl items-center"
            onPress={handleExit}
          >
            <Text className="text-black font-bold text-lg">
              Exit
            </Text>
          </TouchableOpacity>
          
        </View>
      </SafeAreaView>
    );
  }

  return null;
};
