import { View, Text, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { COLORS, FONTS } from '@/theme/theme';
import { acceptCall, declineCall } from '@/services/callService';
import { useState } from 'react';
import * as Haptics from 'expo-haptics';
import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';

export default function IncomingCallScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        callerName: string;
        callerId: string;
        callerPic: string;
        sessionId: string;
        roomName: string;
        callType: 'voice' | 'video';
    }>();

    const [isProcessing, setIsProcessing] = useState(false);

    const handleDecline = async () => {
        setIsProcessing(true);
        try {
            await declineCall(params.sessionId);
            router.back();
        } catch (err) {
            console.error('Decline error:', err);
            router.back();
        }
    };

    const handleAccept = async () => {
        setIsProcessing(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        try {
            // Check permissions before accepting
            const cameraStatus = await Camera.requestCameraPermissionsAsync();
            const audioStatus = await Audio.requestPermissionsAsync();

            if (!cameraStatus.granted || !audioStatus.granted) {
                Alert.alert(
                    "Permissions Required",
                    "Please enable camera and microphone access to accept the call.",
                    [{ text: "OK", onPress: () => setIsProcessing(false) }]
                );
                return;
            }

            const { token, livekitUrl } = await acceptCall(params.roomName, params.sessionId);
            // Navigate to the active call screen (which handles LiveKit)
            router.replace({
                pathname: '/call-room' as any,
                params: {
                    ...params,
                    token,
                    livekitUrl,
                    isCaller: 'false'
                }
            });
        } catch (err) {
            console.error('Accept error:', err);
            setIsProcessing(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.callerName}>{params.callerName ?? 'Someone'}</Text>
                <Text style={styles.subtitle}>is calling you ({params.callType})...</Text>
            </View>

            <View style={styles.actions}>
                <TouchableOpacity
                    style={[styles.declineBtn, isProcessing && styles.disabled]}
                    onPress={handleDecline}
                    disabled={isProcessing}
                >
                    <Text style={styles.btnText}>Decline</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.acceptBtn, isProcessing && styles.disabled]}
                    onPress={handleAccept}
                    disabled={isProcessing}
                >
                    <Text style={styles.btnText}>Accept</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 120
    },
    header: {
        alignItems: 'center',
        gap: 12
    },
    callerName: { fontFamily: FONTS.bold, fontSize: 32, color: COLORS.text, textAlign: 'center' },
    subtitle: { fontFamily: FONTS.regular, fontSize: 16, color: COLORS.textSecondary, textAlign: 'center' },
    actions: {
        flexDirection: 'row',
        gap: 30,
        width: '100%',
        justifyContent: 'center',
        paddingHorizontal: 40
    },
    declineBtn: {
        backgroundColor: '#FF3B30',
        width: 130,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
    },
    acceptBtn: {
        backgroundColor: '#34C759',
        width: 130,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
    },
    btnText: { fontFamily: FONTS.bold, color: '#fff', fontSize: 16, textTransform: 'uppercase' },
    disabled: { opacity: 0.5 }
});