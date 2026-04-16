import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface QRUnlockModalProps {
    visible: boolean;
    onClose: () => void;
    expectedData: string;
    onSuccess: () => void;
}

export const QRUnlockModal = ({
    visible,
    onClose,
    expectedData,
    onSuccess
}: QRUnlockModalProps) => {
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);

    if (!permission) {
        return <View />;
    }

    if (!permission.granted) {
        return (
            <Modal visible={visible} animationType="slide">
                <View className="flex-1 bg-black items-center justify-center px-10">
                    <Ionicons name="camera-outline" size={48} color="white" style={{ opacity: 0.2 }} />
                    <Text className="text-white font-headline font-black text-lg uppercase tracking-widest mt-6 text-center">
                        Camera Access Required
                    </Text>
                    <Text className="text-white/40 font-label text-[10px] text-center mt-2 uppercase leading-4">
                        We need camera permission to scan your protocol QR code and verify your identity.
                    </Text>
                    <TouchableOpacity
                        onPress={requestPermission}
                        className="mt-10 h-14 bg-white px-8 items-center justify-center"
                    >
                        <Text className="text-black font-headline font-black text-xs uppercase tracking-widest">Grant Permission</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onClose} className="mt-4">
                        <Text className="text-white/20 font-label text-[10px] uppercase underline">Cancel</Text>
                    </TouchableOpacity>
                </View>
            </Modal>
        );
    }

    const handleBarcodeScanned = ({ data }: { data: string }) => {
        if (scanned) return;
        setScanned(true);

        if (data === expectedData) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onSuccess();
        } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert(
                "INVALID_SIGNATURE",
                "THE_SCANNED_QR_CODE_DOES_NOT_MATCH_THIS_SESSION_PROTOCOL.",
                [{ text: "TRY_AGAIN", onPress: () => setScanned(false) }]
            );
        }
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
            <View className="flex-1 bg-black">
                <CameraView
                    style={StyleSheet.absoluteFill}
                    facing="back"
                    onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
                    barcodeScannerSettings={{
                        barcodeTypes: ["qr"],
                    }}
                />

                {/* Overlays */}
                <View className="flex-1 items-center justify-center">
                    {/* Scanner Frame */}
                    <View className="w-64 h-64 border-2 border-white/20 items-center justify-center">
                        {/* Corners */}
                        <View className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-white" />
                        <View className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-white" />
                        <View className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-white" />
                        <View className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-white" />
                        
                        <View className="w-full h-0.5 bg-white/30" />
                    </View>

                    <Text className="text-white font-headline font-black text-xs uppercase tracking-[0.3em] mt-8 bg-black/60 px-4 py-2">
                        Scanning Protocol Signature...
                    </Text>
                </View>

                {/* Header/Close */}
                <View className="absolute top-12 left-6 right-6 flex-row justify-between items-center">
                    <Text className="text-white font-headline font-black text-lg tracking-[0.2em]">UNLINK_SCAN</Text>
                    <TouchableOpacity 
                        onPress={onClose}
                        className="w-10 h-10 bg-black items-center justify-center border border-white/20"
                    >
                        <Ionicons name="close" size={24} color="white" />
                    </TouchableOpacity>
                </View>

                {/* Bottom Instruction */}
                <View className="absolute bottom-20 left-10 right-10">
                    <Text className="text-white/60 font-label text-[10px] text-center uppercase leading-5">
                        Align your generated QR code within the frame above to terminate the focus session.
                    </Text>
                </View>
            </View>
        </Modal>
    );
};
