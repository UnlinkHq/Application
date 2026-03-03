import * as React from 'react';
import * as ReactNative from 'react-native';
import { View, Text, ScrollView, TouchableOpacity, Switch, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useCameraPermissions, CameraView } from 'expo-camera';

const MARKETPLACE_URL = 'https://unlinkhq.github.io/Extensions/marketplace.json';
const BASE_URL = 'https://unlinkhq.github.io/Extensions';

interface Extension {
  id: string;
  title: string;
  author: string;
  description: string;
  category: string;
  icon: string;
  iconType: 'Ionicons' | 'MaterialCommunityIcons' | 'FontAwesome5';
  color: string;
  pro: boolean;
  version: string;
  folder: string; // From registry
  bundleUrl?: string; // Derived
}

const RemoteExtension = ({ extensionId, script }: { extensionId: string; script: string }) => {
  const [Component, setComponent] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [debugLog, setDebugLog] = React.useState<string[]>([]);

  React.useEffect(() => {
    // Determine the global var name injected by esbuild
    const globalName = `Extension_${extensionId.replace(/-/g, '_')}`;

    // Clear previous state if extensionId changes
    setComponent(null);
    setError(null);
    
    // A small timeout allows the UI transition animation to finish 
    // before we block the JS thread compiling the remote extension.
    const timer = setTimeout(() => {
      try {
          const ScreenBreak = (globalThis as any).ScreenBreak;

          const flattenedReact: any = { ...React };
          flattenedReact.useState = React.useState;
          flattenedReact.useEffect = React.useEffect;
          flattenedReact.useMemo = React.useMemo;
          flattenedReact.useCallback = React.useCallback;
          flattenedReact.useRef = React.useRef;
          
          const flattenedRN: any = { ...ReactNative };
          
          const customRequire = (name: string) => {
            if (name === 'react') return flattenedReact;
            if (name === 'react-native') return flattenedRN;
            return (globalThis as any)[name];
          };
          
          const logs = [
            `🛡️ SHIELD ACTIVE`,
            `React.useState type: ${typeof flattenedReact.useState}`
          ];

          (globalThis as any).React = flattenedReact;
          (globalThis as any).ReactNative = flattenedRN;

          const executableScript = script + '; return ' + globalName + ';';

          const RemoteComp = new Function('React', 'ReactNative', 'ScreenBreak', 'require', 'global', executableScript)(
            flattenedReact, 
            flattenedRN,
            ScreenBreak,
            customRequire,
            globalThis
          );

          if (RemoteComp) {
              let ActualComponent = RemoteComp;
              if (RemoteComp.default) {
                  ActualComponent = RemoteComp.default;
              } else if (typeof RemoteComp === 'object') {
                  const firstFunction = Object.values(RemoteComp).find(val => typeof val === 'function');
                  if (firstFunction) {
                      ActualComponent = firstFunction;
                  }
              }
              if (typeof ActualComponent !== 'function') {
                throw new Error(`Resolved component is of type ${typeof ActualComponent}, expected function.`);
              }
              
              setDebugLog(logs);
              setComponent(() => ActualComponent);
          } else {
              throw new Error(`Bundle loaded but component ${globalName} not found`);
          }
      } catch (e: any) {
        console.error('❌ Remote Load Error:', e);
        setError(e.toString());
      }
    }, 50); // 50ms delay for UI smoothness

    return () => clearTimeout(timer);
  }, [extensionId, script]);

  if (error) return (
    <View className="p-4 bg-red-50 rounded-xl border border-red-100">
        <Text className="text-red-500 font-bold mb-1">Extension Error</Text>
        <Text className="text-red-400 text-xs mb-3">{error}</Text>
        <View className="bg-black/5 p-2 rounded-lg">
          <Text className="text-xs font-bold text-gray-700 mb-1">Visual Debugger trace:</Text>
          {debugLog.map((log, i) => (
            <Text key={i} className="text-[10px] text-gray-600 font-mono">{log}</Text>
          ))}
        </View>
    </View>
  );
  if (!Component) return (
    <View className="p-8 items-center justify-center">
        <ActivityIndicator color="#ec4899" />
        <Text className="text-gray-400 mt-2 text-xs">Loading Remote Component...</Text>
        <View className="mt-6 w-full bg-gray-100 p-3 rounded-xl border border-gray-200">
          <Text className="text-xs font-bold text-gray-500 mb-1">System Verification Shield:</Text>
          {debugLog.map((log, i) => (
            <Text key={i} className="text-[10px] text-gray-400 font-mono">{log}</Text>
          ))}
        </View>
    </View>
  );

  return <Component />;
};

export const ExtensionsScreen = () => {
  const [extensions, setExtensions] = React.useState<Extension[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeExtension, setActiveExtension] = React.useState<Extension | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [permission, requestPermission] = useCameraPermissions();
  const [showScanner, setShowScanner] = React.useState(false);

  // Filter based on search
  const filteredExtensions = React.useMemo(() => {
    if (!searchQuery.trim()) return extensions;
    return extensions.filter(e => 
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      e.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [extensions, searchQuery]);

  const fetchExtensions = async () => {
    try {
      setLoading(true);
      // Cache busting
      const response = await fetch(`${MARKETPLACE_URL}?t=${Date.now()}`);
      const data = await response.json();
      
      const extensionArray = Array.isArray(data) ? data : data.extensions || [];
      const mapped = extensionArray.map((ext: any) => ({
        ...ext,
        bundleUrl: `${BASE_URL}/bundles/${ext.folder || ext.id}.bundle.js`
      }));
      
      setExtensions(mapped);
    } catch (error) {
      console.error('Error fetching extensions:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchExtensions();
  }, []);

  const handleExtensionClick = async (ext: Extension) => {
    try {
      setLoading(true);
      const bundleUrl = `${BASE_URL}/bundles/${ext.folder || ext.id}.bundle.js?t=${Date.now()}`;
      console.log('📡 Fetching bundle:', bundleUrl);
      
      const response = await fetch(bundleUrl);
      const script = await response.text();
      
      setActiveExtension({ ...ext, bundleUrl: script });
    } catch (error) {
      console.error('Error loading extension bundle:', error);
    } finally {
      setLoading(false);
    }
  };

  if (showScanner) {
    if (!permission) return <View />;
    if (!permission.granted) {
      return (
        <RNSafeAreaView className="flex-1 bg-black items-center justify-center p-6">
          <Text className="text-center text-lg text-white mb-6">We need your permission to show the camera</Text>
          <TouchableOpacity 
            className="bg-pink-500 px-6 py-3 rounded-2xl"
            onPress={requestPermission}
          >
            <Text className="text-white font-bold">Grant Permission</Text>
          </TouchableOpacity>
        </RNSafeAreaView>
      );
    }
    return (
      <View className="flex-1 bg-black">
        <CameraView 
          className="flex-1" 
          onBarcodeScanned={({ data }) => {
            console.log('Scanned:', data);
            setShowScanner(false);
          }}
        />
        <RNSafeAreaView className="absolute top-0 left-0 right-0 p-4">
          <TouchableOpacity 
            className="bg-black/50 w-12 h-12 rounded-full items-center justify-center border border-white/20"
            onPress={() => setShowScanner(false)}
          >
            <Ionicons name="close" size={28} color="white" />
          </TouchableOpacity>
        </RNSafeAreaView>
      </View>
    );
  }

  return (
    <RNSafeAreaView className="flex-1 bg-black" edges={['top']}>
        <View className="flex-row items-center justify-between px-6 pt-6 pb-4">
          <View>
            <Text className="text-4xl font-bold text-white tracking-tight">Extensions</Text>
            <Text className="text-gray-400 text-sm mt-1">Supercharge your focus workflow</Text>
          </View>
        </View>

      <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {activeExtension ? (
          <View className="mb-8 p-5 bg-[#0f0f0f] rounded-3xl border border-gray-800 shadow-xl shadow-black">
            <View className="flex-row items-start justify-between mb-6">
                <View className="flex-row items-center flex-1 pr-4">
                    <View className="w-16 h-16 bg-[#1a1a1a] rounded-2xl items-center justify-center mr-4 border border-gray-800">
                        {activeExtension.iconType === 'Ionicons' ? (
                            <Ionicons name={activeExtension.icon as any} size={30} color="#ff006e" />
                        ) : activeExtension.iconType === 'MaterialCommunityIcons' ? (
                            <MaterialCommunityIcons name={activeExtension.icon as any} size={30} color="#ff006e" />
                        ) : (
                            <FontAwesome5 name={activeExtension.icon as any} size={26} color="#ff006e" />
                        )}
                    </View>
                    <View className="flex-1">
                        <Text className="text-2xl font-bold text-white mb-1">{activeExtension.title}</Text>
                        <Text className="text-gray-400 text-xs leading-5 pr-2">{activeExtension.description}</Text>
                    </View>
                </View>
                <TouchableOpacity onPress={() => setActiveExtension(null)} className="bg-[#1a1a1a] rounded-full w-10 h-10 items-center justify-center border border-gray-800">
                    <Ionicons name="close" size={20} color="white" />
                </TouchableOpacity>
            </View>
            
            <View className="mt-2">
              <RemoteExtension extensionId={activeExtension.id} script={activeExtension.bundleUrl!} />
            </View>
          </View>
        ) : (
          <>
            <View className="bg-[#121212] rounded-2xl flex-row items-center px-4 py-4 mb-6 border border-gray-800">
              <Ionicons name="search" size={20} color="#6b7280" />
              <TextInput 
                className="flex-1 ml-3 text-white font-medium" 
                placeholder="Search tools..." 
                placeholderTextColor="#6b7280"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <View className="mb-6">
                {loading ? (
                  <View className="p-12 items-center">
                    <ActivityIndicator color="#ff006e" size="large" />
                    <Text className="text-gray-500 mt-4 font-medium">Scanning catalog...</Text>
                  </View>
                ) : filteredExtensions.length === 0 ? (
                  <View className="p-12 items-center bg-[#121212] rounded-3xl border border-gray-800">
                    <Ionicons name="folder-open-outline" size={48} color="#374151" className="mb-4" />
                    <Text className="text-gray-400 font-medium">No extensions found</Text>
                  </View>
                ) : (
                  <View className="bg-[#121212] rounded-[32px] border border-gray-800 overflow-hidden">
                    {filteredExtensions.map((ext, index) => (
                      <TouchableOpacity 
                        key={ext.id} 
                        onPress={() => handleExtensionClick(ext)}
                        className={`flex-row items-center p-5 ${index !== filteredExtensions.length - 1 ? 'border-b border-gray-800/60' : ''}`}
                        activeOpacity={0.7}
                      >
                        <View className="w-12 h-12 bg-black rounded-xl items-center justify-center mr-4 border border-gray-800">
                          {ext.iconType === 'Ionicons' ? (
                            <Ionicons name={ext.icon as any} size={22} color="#ff006e" />
                          ) : ext.iconType === 'MaterialCommunityIcons' ? (
                            <MaterialCommunityIcons name={ext.icon as any} size={22} color="#ff006e" />
                          ) : (
                            <FontAwesome5 name={ext.icon as any} size={20} color="#ff006e" />
                          )}
                        </View>
                        <View className="flex-1 mr-4">
                          <View className="flex-row items-center mb-1">
                            <Text className="text-lg font-bold text-white mr-2">{ext.title}</Text>
                            {ext.pro && (
                              <View className="bg-pink-500/20 px-2 py-0.5 rounded-md border border-pink-500/30">
                                <Text className="text-[10px] font-bold text-pink-400 tracking-wider">PRO</Text>
                              </View>
                            )}
                          </View>
                          <Text className="text-gray-400 text-xs leading-5" numberOfLines={2}>{ext.description}</Text>
                        </View>
                        <View className="w-8 h-8 rounded-full bg-gray-800 items-center justify-center">
                          <Ionicons name="arrow-forward" size={16} color="#9ca3af" />
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
            </View>

            {/* Developer bottom row section */}
            <View className="mt-8 mb-12 border-t border-gray-800/50 pt-8">
              <View className="flex-row items-center justify-between mb-4 px-1">
                <Text className="text-gray-400 font-bold uppercase tracking-widest text-xs">Community & Tools</Text>
              </View>

              <View className="flex-row space-x-3">
                {/* Contribute Half */}
                <TouchableOpacity 
                  activeOpacity={0.8}
                  className="flex-1 rounded-3xl border border-gray-800 bg-[#0a0a0a] overflow-hidden justify-between"
                  style={{ minHeight: 140 }}
                >
                  <View className="p-4 flex-1">
                    <View className="w-10 h-10 bg-white/10 rounded-full items-center justify-center mb-3">
                      <Ionicons name="logo-github" size={20} color="white" />
                    </View>
                    <Text className="text-white font-bold leading-tight mb-1">Build Extensions</Text>
                    <Text className="text-gray-500 text-[10px] leading-snug">
                      Join our open-source repo.
                    </Text>
                  </View>
                  <View className="py-2.5 px-4 bg-gray-900 flex-row items-center justify-between border-t border-gray-800">
                    <Text className="text-pink-500 text-[10px] font-bold">GITHUB</Text>
                    <Ionicons name="arrow-forward" size={14} color="#ec4899" />
                  </View>
                </TouchableOpacity>

                {/* Scanner Half */}
                <TouchableOpacity 
                  activeOpacity={0.8}
                  onPress={() => setShowScanner(true)}
                  className="flex-1 rounded-3xl border border-gray-800 ml-2 bg-[#121212] overflow-hidden justify-between"
                  style={{ minHeight: 140 }}
                >
                  <View className="p-4 flex-1">
                    <View className="w-10 h-10 bg-gray-800 rounded-full items-center justify-center mb-3">
                      <Ionicons name="qr-code-outline" size={20} color="white" />
                    </View>
                    <Text className="text-white font-bold leading-tight mb-1">Local Dev</Text>
                    <Text className="text-gray-500 text-[10px] leading-snug">
                      Scan bundler QR code.
                    </Text>
                  </View>
                  <View className="py-2.5 px-4 bg-black flex-row items-center justify-between border-t border-gray-800">
                    <Text className="text-gray-300 text-[10px] font-bold">SCANNER</Text>
                    <Ionicons name="arrow-forward" size={14} color="#d1d5db" />
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </RNSafeAreaView>
  );
};
