import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
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
            {isLoggingIn ? "LOGIN REQUIRED" : `VIEWING: ${vipList[currentIndex]}`}
          </Text>
        </View>

        {!isLoggingIn ? (
          <TouchableOpacity style={sandboxStyles.nextButton} onPress={handleNextVip}>
            <Text style={sandboxStyles.nextButtonText}>NEXT</Text>
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
    const [showSandbox, setShowSandbox] = useState(false);
    
    // Mock data for the gateway list
    const gateways = [
        { id: 'instagram', name: 'Instagram', status: 'UNFILTERED ACCESS', icon: 'logo-instagram', color: '#ffb4aa', library: 'Ionicons' },
    ];

    if (showSandbox) {
        return (
            <InstagramSandbox 
                vipList={['@naval', '@sama', '@jack', '@elonmusk']} 
                onComplete={() => setShowSandbox(false)} 
                onClose={() => setShowSandbox(false)} 
            />
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-black" edges={['top']}>
            <View className="flex-1">
                {/* TopAppBar */}
                <View className="h-16 flex-row items-center justify-between px-6 border-b border-white/10 bg-black">
                    <View className="flex-row items-center gap-2">
                        <MaterialIcons name="sensors" size={24} color="white" />
                        <Text className="font-headline font-black text-2xl tracking-[0.2em] text-white">UNLINK</Text>
                    </View>
                    <View className="flex-row items-center gap-4">
                        <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
                            <MaterialIcons name="settings" size={20} color="white" />
                        </TouchableOpacity>
                        <TouchableOpacity className="p-1">
                            <MaterialIcons name="person" size={24} color="white" />
                        </TouchableOpacity>
                    </View>
                </View>

                <ScrollView 
                    className="flex-1 px-6" 
                    contentContainerStyle={{ paddingTop: 32, paddingBottom: 240 }}
                >
                    {/* Header Section */}
                    <View className="mb-12">
                        <View className="flex-row items-end justify-between mb-4">
                            <Text className="font-headline text-4xl tracking-widest leading-[1] text-white uppercase">
                                DISTRACTION{"\n"}GATEWAYS
                            </Text>
                            <View className="w-6 h-[1px] bg-white/40 mb-2" style={{ transform: [{ rotate: '-45deg' }] }} />
                        </View>
                        <Text className="font-label text-[10px] text-white/40">
                            Be a part of something bigger
                        </Text>
                    </View>

                    {/* Socials List */}
                    <View className="space-y-4">
                        {gateways.map((gate) => (
                            <TouchableOpacity 
                                key={gate.id}
                                activeOpacity={0.8}
                                onPress={() => gate.id === 'instagram' ? setShowSandbox(true) : null}
                                className="flex-row items-center justify-between p-6 bg-[#1b1b1b] border-l-2 border-transparent"
                            >
                                <View className="flex-row items-center gap-6">
                                    <View className="w-12 h-12 bg-black items-center justify-center border border-white/10">
                                        {gate.icon === 'logo-instagram' ? (
                                            <Ionicons name="logo-instagram" size={24} color="white" />
                                        ) : (
                                            <MaterialIcons name={gate.icon as any} size={24} color="white" />
                                        )}
                                    </View>
                                    <View>
                                        <Text className="font-headline font-bold text-lg uppercase tracking-tight text-white">{gate.name}</Text>
                                        <Text className="font-label text-[10px] tracking-[0.15em]" style={{ color: gate.color }}>
                                            {gate.status}
                                        </Text>
                                    </View>
                                </View>
                                <MaterialIcons name="more-vert" size={24} color="#5d5f5f" />
                            </TouchableOpacity>
                        ))}
                    </View>

                 

                </ScrollView>
            </View>
        </SafeAreaView>
    );
};
