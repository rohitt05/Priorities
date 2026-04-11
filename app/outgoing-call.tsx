// app/outgoing-call.tsx
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { COLORS, FONTS } from '@/theme/theme';

export default function OutgoingCallScreen() {
    const router = useRouter();
    const { receiverName } = useLocalSearchParams<{ receiverName: string }>();

    return (
        <View style={styles.container}>
            <Text style={styles.name}>{receiverName ?? 'Calling...'}</Text>
            <Text style={styles.subtitle}>ringing...</Text>
            <TouchableOpacity style={styles.endBtn} onPress={() => router.back()}>
                <Text style={styles.btnText}>End</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', gap: 20 },
    name: { fontFamily: FONTS.bold, fontSize: 28, color: COLORS.text },
    subtitle: { fontFamily: FONTS.regular, fontSize: 16, color: COLORS.textSecondary },
    endBtn: { backgroundColor: '#FF3B30', padding: 20, borderRadius: 50, marginTop: 40 },
    btnText: { fontFamily: FONTS.bold, color: '#fff', fontSize: 14 },
});