import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
// FIXED IMPORT PATH
import { BaseMediaProps } from '@/types/mediaTypes';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function NoteViewer({ mediaItem }: BaseMediaProps) {
    return (
        <View style={styles.container}>
            <BlurView intensity={60} tint="dark" style={styles.blur}>
                <View style={styles.content}>
                    <Ionicons name="document-text" size={48} color="#fff" style={{ marginBottom: 20 }} />
                    <Text style={styles.noteText}>{mediaItem.text}</Text>
                    {mediaItem.timestamp && <Text style={styles.timestamp}>{mediaItem.timestamp}</Text>}
                </View>
            </BlurView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { width: SCREEN_WIDTH * 0.85, minHeight: 300, borderRadius: 20, overflow: 'hidden' },
    blur: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content: { padding: 40, alignItems: 'center' },
    noteText: { fontSize: 22, fontWeight: '600', color: '#fff', textAlign: 'center' },
    timestamp: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 20 }
});