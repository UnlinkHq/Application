import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { Alert } from 'react-native';

const SignatureService = {
    /**
     * Saves a base64 encoded image (QR Code) to the user's gallery.
     * Required for QR_CODE strictness protocol.
     */
    saveSignatureToGallery: async (base64Data: string): Promise<string | null> => {
        try {
            // 1. Request Media Library Permissions
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert(
                    'PERMISSION_REQUIRED',
                    'UNLINK REQUIRES GALLERY ACCESS TO SECURE YOUR PROTOCOL SIGNATURE. WITHOUT THIS, THE SESSION CANNOT BE DEPLOYED.'
                );
                return null;
            }

            // 2. Define temporary file path
            const directory = FileSystem.cacheDirectory || FileSystem.documentDirectory;
            if (!directory) throw new Error('FILESYSTEM_UNAVAILABLE');

            const filename = `UNLINK_PROTOCOL_SIG_${Date.now()}.png`;
            const fileUri = `${directory}${directory.endsWith('/') ? '' : '/'}${filename}`;

            // 3. Write base64 data to temporary file
            // Remove the header if present
            const base64Content = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;

            await FileSystem.writeAsStringAsync(fileUri, base64Content, {
                encoding: FileSystem.EncodingType.Base64,
            });

            // 4. Save file to Media Library
            const asset = await MediaLibrary.createAssetAsync(fileUri);
            
            // 5. Cleanup temporary file
            await FileSystem.deleteAsync(fileUri, { idempotent: true });

            console.log(`--- [SIGNATURE_SERVICE] PROTOCOL_SAVED: ${asset.id} ---`);
            return asset.id;
        } catch (error) {
            console.error('--- [SIGNATURE_SERVICE] DEPLOYMENT_FAILURE ---', error);
            Alert.alert('DEPLOYMENT_ERROR', 'FAILED TO SECURE PROTOCOL SIGNATURE. PLEASE RETRY.');
            return null;
        }
    }
};

export default SignatureService;
