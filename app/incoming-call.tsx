// app/incoming-call.tsx
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { COLORS, FONTS } from '@/theme/theme';

export default function IncomingCallScreen() {
    const router = useRouter();
    const { callerName, callerId } = useLocalSearchParams<{
        callerName: string;
        callerId: string;
    }>();

    return (
        <View style={styles.container}>
            <Text style={styles.callerName}>{callerName ?? 'Unknown'}</Text>
            <Text style={styles.subtitle}>incoming call...</Text>
            <View style={styles.actions}>
                <TouchableOpacity style={styles.declineBtn} onPress={() => router.back()}>
                    <Text style={styles.btnText}>Decline</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.acceptBtn} onPress={() => { }}>
                    <Text style={styles.btnText}>Accept</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', gap: 20 },
    callerName: { fontFamily: FONTS.bold, fontSize: 28, color: COLORS.text },
    subtitle: { fontFamily: FONTS.regular, fontSize: 16, color: COLORS.textSecondary },
    actions: { flexDirection: 'row', gap: 40, marginTop: 40 },
    declineBtn: { backgroundColor: '#FF3B30', padding: 20, borderRadius: 50 },
    acceptBtn: { backgroundColor: '#34C759', padding: 20, borderRadius: 50 },
    btnText: { fontFamily: FONTS.bold, color: '#fff', fontSize: 14 },
});