import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
// FIXED IMPORT PATH
import { BaseMediaProps, formatTime } from '@/types/mediaTypes';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function CallInfoViewer({ mediaItem }: BaseMediaProps) {
    const isVoice = mediaItem.type === 'voice_call';
    return (
        <View style={styles.container}>
            <LinearGradient colors={isVoice ? ['#F8BBD0', '#F48FB1'] : ['#E1BEE7', '#CE93D8']} style={styles.gradient}>
                <Ionicons name={isVoice ? 'call' : 'videocam'} size={80} color="#fff" />
                <Text style={styles.title}>{isVoice ? 'Voice Call' : 'Video Call'}</Text>
                <Text style={styles.text}>Duration: {formatTime(mediaItem.durationSec || 0)}</Text>
                <Text style={styles.text}>{mediaItem.sender === 'me' ? 'Outgoing' : 'Incoming'}</Text>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { width: SCREEN_WIDTH * 0.85, height: 350, borderRadius: 20, overflow: 'hidden' },
    gradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    title: { fontSize: 28, fontWeight: '700', color: '#fff', marginVertical: 20 },
    text: { fontSize: 18, color: '#fff', marginBottom: 10 }
});