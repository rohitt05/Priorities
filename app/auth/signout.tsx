import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { signOut } from '@/services/authService';
import { router } from 'expo-router';

export default function SignOutScreen() {
    useEffect(() => {
        const doSignOut = async () => {
            try {
                await signOut();
            } finally {
                router.replace('/auth/signin');
            }
        };
        doSignOut();
    }, []);

    return (
        <View style={styles.container}>
            <Text style={styles.text}>Signing out...</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
    text: { fontSize: 18, color: '#333' }
});
