import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { 
  getEngineHealth, 
  requestOverlayPermission, 
  requestAccessibilityPermission, 
  openAppInfoSettings, 
  requestUsageStatsPermission, 
  requestBatteryOptimizationExemption 
} from '../../modules/screen-time';
import { FocusStorageService } from '../../services/FocusStorageService';

export const PermissionBanner = () => {
  const [health, setHealth] = useState({
    overlay: true,
    accessibility: true,
    usage: true,
    batteryExempt: true,
    isEnforcing: true
  });
  const [loading, setLoading] = useState(true);
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);
  const [isReaming, setIsReaming] = useState(false);
  const slideAnim = React.useRef(new Animated.Value(-200)).current;

  const checkHealth = useCallback(async () => {
    try {
      const currentHealth = await getEngineHealth();
      setHealth(currentHealth);

      const allGranted = currentHealth.overlay && 
                         currentHealth.accessibility && 
                         currentHealth.usage && 
                         currentHealth.batteryExempt;
      
      Animated.spring(slideAnim, {
        toValue: allGranted ? -200 : 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    } catch (error) {
      console.error('Health check failed:', error);
    } finally {
      setLoading(false);
    }
  }, [slideAnim]);

  useEffect(() => {
    const timer = setInterval(checkHealth, 3000);
    checkHealth();
    return () => clearInterval(timer);
  }, [checkHealth]);

  const handleFixAccessibility = () => {
    requestAccessibilityPermission();
    Alert.alert(
      "Android 13/14 Troubleshooting",
      "If the switch is 'Grayed Out':\n1. Go to App Info (Settings -> Apps -> Unlink)\n2. Tap the 3 dots in the top right\n3. Tap 'Allow Restricted Settings'\n4. Return here and try again.",
      [
        { text: "Open App Info", onPress: () => openAppInfoSettings() },
        { text: "Got it", style: "cancel" }
      ]
    );
  };

  const handleRearm = async () => {
    setIsReaming(true);
    try {
      const activeSession = await FocusStorageService.getActiveSession();
      if (activeSession) {
        await FocusStorageService.startSession(activeSession);
        Alert.alert("Success", "Enforcement engine has been manually re-armed.");
      } else {
        Alert.alert("No Session", "Start a session first to arm the engine.");
      }
    } catch (e) {
      Alert.alert("Error", "Failed to re-arm engine.");
    } finally {
      setIsReaming(false);
      checkHealth();
    }
  };

  const isAllGood = health.overlay && health.accessibility && health.usage && health.batteryExempt;
  if (isAllGood && !loading) return null;

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="alert-circle" color="#FF3B30" size={24} />
          </View>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>ENGINE_CRITICAL_FAILURE</Text>
            <Text style={styles.subtitle}>Background persistence is compromised</Text>
          </View>
        </View>

        <View style={styles.issuesList}>
          {!health.overlay && (
            <TouchableOpacity style={styles.issueItem} onPress={() => requestOverlayPermission()}>
              <Ionicons name="layers-outline" color="#FF3B30" size={16} />
              <Text style={styles.issueText}>Allow "Appear on Top"</Text>
              <Ionicons name="chevron-forward" color="#8E8E93" size={18} />
            </TouchableOpacity>
          )}
          {!health.accessibility && (
            <TouchableOpacity style={styles.issueItem} onPress={handleFixAccessibility}>
              <Ionicons name="eye-outline" color="#FF3B30" size={16} />
              <Text style={styles.issueText}>Enable Accessibility Service</Text>
              <Ionicons name="chevron-forward" color="#8E8E93" size={18} />
            </TouchableOpacity>
          )}
           {!health.usage && (
            <TouchableOpacity style={styles.issueItem} onPress={() => requestUsageStatsPermission()}>
              <Ionicons name="stats-chart-outline" color="#FF3B30" size={16} />
              <Text style={styles.issueText}>Grant Usage Access (Safety Net)</Text>
              <Ionicons name="chevron-forward" color="#8E8E93" size={18} />
            </TouchableOpacity>
          )}
          {!health.batteryExempt && (
            <TouchableOpacity style={[styles.issueItem, styles.batteryHighlight]} onPress={() => requestBatteryOptimizationExemption()}>
              <Ionicons name="battery-dead-outline" color="#FF9500" size={16} />
              <Text style={[styles.issueText, { color: '#FF9500' }]}>Exempt from Battery Optimization</Text>
              <Ionicons name="chevron-forward" color="#FF9500" size={18} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity 
          style={styles.rearmBtn}
          onPress={handleRearm}
          disabled={isReaming}
        >
          {isReaming ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="refresh" color="#FFF" size={14} />}
          <Text style={styles.rearmText}>RE-ARM ENFORCEMENT ENGINE</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.troubleshootBtn}
          onPress={() => setShowTroubleshoot(!showTroubleshoot)}
        >
          <Ionicons name="information-circle-outline" color="#666" size={16} />
          <Text style={styles.troubleshootText}>Toggles grayed out? Tap for fix</Text>
        </TouchableOpacity>

        {showTroubleshoot && (
          <View style={styles.troubleshootPanel}>
            <Text style={styles.step}>1. Long-press Unlink icon → App Info</Text>
            <Text style={styles.step}>2. Tap ':' (top right) → 'Allow restricted settings'</Text>
            <Text style={styles.step}>3. Tap 'App battery usage' → Select 'Unrestricted'</Text>
            <Text style={styles.step}>4. Come back and enable Accessibility</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    zIndex: 1000,
  },
  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.44,
    shadowRadius: 10.32,
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    color: '#FF3B30',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 2,
    fontWeight: '800',
  },
  subtitle: {
    color: '#8E8E93',
    fontSize: 12,
    marginTop: 2,
  },
  issuesList: {
    gap: 8,
  },
  issueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2C2E',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  issueText: {
    flex: 1,
    color: '#E5E5EA',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 10,
  },
  batteryHighlight: {
    borderColor: 'rgba(255, 149, 0, 0.3)',
    borderWidth: 1,
    backgroundColor: 'rgba(255, 149, 0, 0.05)',
  },
  rearmBtn: {
    backgroundColor: '#34C759',
    marginTop: 16,
    height: 44,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  rearmText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  troubleshootBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 4,
  },
  troubleshootText: {
    color: '#666',
    fontSize: 11,
    marginLeft: 6,
    textDecorationLine: 'underline',
  },
  troubleshootPanel: {
    marginTop: 12,
    backgroundColor: '#000',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#FFD60A',
  },
  step: {
    color: '#8E8E93',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 4,
  }
});
