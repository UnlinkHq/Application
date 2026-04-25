import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import SignatureService from '../../services/SignatureService';
import * as Haptics from 'expo-haptics';

interface SignatureDeploymentModalProps {
    visible: boolean;
    qrData: string | null;
    onSuccess: (assetId: string) => void;
    onCancel: () => void;
    title?: string;
}

export const SignatureDeploymentModal = ({
    visible,
    qrData,
    onSuccess,
    onCancel,
    title = "PROTOCOL_SIGNATURE"
}: SignatureDeploymentModalProps) => {
    const qrRef = useRef<any>(null);
    const [isSaving, setIsSaving] = useState(false);

    const handleConfirm = async () => {
        if (!qrRef.current) return;
        
        setIsSaving(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        qrRef.current.toDataURL((data: string) => {
            SignatureService.saveSignatureToGallery(data).then(assetId => {
                if (assetId) {
                    onSuccess(assetId);
                } else {
                    setIsSaving(false);
                }
            }).catch(e => {
                console.error('Save failed:', e);
                setIsSaving(false);
            });
        });
    };

    if (!visible) return null;

    return (
        <Animated.View
            entering={FadeIn}
            style={StyleSheet.absoluteFill}
            className="bg-black/95 items-center justify-center px-8 z-50"
        >
            <View className="w-full bg-[#0a0a0a] border border-white/20 p-8 items-center">
                {/* Header Section */}
                <View className="flex-row items-center justify-between w-full mb-6">
                    <View className="flex-1">
                        <Text className="text-white font-headline font-black text-xl uppercase tracking-widest">{title}</Text>
                        <Text className="text-[#72fe88] font-label text-[10px] uppercase tracking-widest font-bold mt-1">
                            AUTOMATIC GALLERY STORAGE ACTIVE
                        </Text>
                    </View>
                    <TouchableOpacity onPress={onCancel} className="p-2">
                        <Ionicons name="close" size={24} color="rgba(255,255,255,0.4)" />
                    </TouchableOpacity>
                </View>

                {/* QR Core */}
                <View className="w-64 h-64 bg-white p-4 mb-6 items-center justify-center">
                    {qrData && (
                        <QRCode
                            value={qrData}
                            size={220}
                            color="black"
                            backgroundColor="white"
                            logo={require('../../assets/icon.png')}
                            logoSize={50}
                            logoBackgroundColor="white"
                            logoBorderRadius={10}
                            getRef={(c) => (qrRef.current = c)}
                        />
                    )}
                </View>

                {/* Information Callout */}
                <View className="bg-white/5 border border-white/10 p-5 mb-8 flex-row items-center">
                    <Ionicons name="warning-outline" size={20} color="#FFD700" style={{ marginRight: 16 }} />
                    <View className="flex-1">
                        <Text className="text-white font-headline font-black text-[10px] uppercase mb-1">STRICT_REQUIREMENT</Text>
                        <Text className="text-white/60 font-label text-[9px] uppercase tracking-wider leading-4">
                            This signature is required for future protocol modifications. If lost, the session cannot be terminated early.
                        </Text>
                    </View>
                </View>

                {/* Actions */}
                <TouchableOpacity
                    onPress={handleConfirm}
                    disabled={isSaving}
                    className={`w-full h-16 ${isSaving ? 'bg-white/20' : 'bg-white'} items-center justify-center`}
                >
                    <Text className="text-black font-headline font-black text-xs uppercase tracking-widest">
                        {isSaving ? 'ENCRYPTING_SIG...' : 'SAVE_AND_DEPLOY'}
                    </Text>
                </TouchableOpacity>
                
                <TouchableOpacity onPress={onCancel} className="mt-4 p-2">
                    <Text className="text-white/20 font-label text-[10px] uppercase tracking-widest">Abort deployment</Text>
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
};
