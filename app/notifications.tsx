import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, Pressable, Animated as RNAnimated } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSharedValue, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUserId } from '@/services/authService';
import { getIncomingRequests } from '@/services/priorityService';
import { supabase } from '@/lib/supabase';
import { useBackground } from '@/contexts/BackgroundContext';
import ReceivedPriorityRequests from '@/components/ui/ReceivedPriorityRequests';
import { COLORS, FONTS } from '@/theme/theme';

export default function NotificationsScreen() {
    const router = useRouter();
    const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const { bgColor, prevBgColor, colorAnim } = useBackground();
    const requestListOpacity = useSharedValue(0);

    useEffect(() => {
        getCurrentUserId()
            .then(id => {
                setCurrentUserId(id);
                if (!id) setIsLoading(false);
            })
            .catch(err => {
                console.error(err);
                setIsLoading(false);
            });
    }, []);

    const loadIncomingRequests = async () => {
        if (!currentUserId) return;
        try {
            const requests = await getIncomingRequests(currentUserId);
            setIncomingRequests(requests);
        } catch (err) {
            console.error('Error loading requests:', err);
        } finally {
            setIsLoading(false);
            requestListOpacity.value = withTiming(1, { duration: 400 });
        }
    };

    useEffect(() => {
        if (!currentUserId) return;
        
        loadIncomingRequests();

        const channel = supabase
            .channel(`realtime_incoming_requests_notifications_${currentUserId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'priority_requests',
                    filter: `receiver_id=eq.${currentUserId}`,
                },
                () => {
                    loadIncomingRequests();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentUserId]);

    return (
        <View style={styles.container}>
            <Stack.Screen 
                options={{ 
                    headerShown: false,
                    animation: 'slide_from_left',
                    gestureEnabled: true,
                }} 
            />
            
            {/* Background layers from shared background context */}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.background }]} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: bgColor, opacity: 0.25 }]} />
            <RNAnimated.View
                style={[
                    StyleSheet.absoluteFill,
                    {
                        backgroundColor: prevBgColor,
                        opacity: colorAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.25, 0]
                        })
                    }
                ]}
            />
            
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={28} color={COLORS.primary} />
                </Pressable>
                <Text style={styles.headerTitle}>Notifications</Text>
                <View style={{ width: 44 }} />
            </View>

            {isLoading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            ) : incomingRequests.length > 0 ? (
                <View style={styles.listContainer}>
                    <ReceivedPriorityRequests
                        requests={incomingRequests}
                        opacity={requestListOpacity}
                        onRequestsChange={setIncomingRequests}
                    />
                </View>
            ) : (
                <View style={styles.center}>
                    <Ionicons name="notifications-off-outline" size={48} color={COLORS.textSecondary} style={{ marginBottom: 16, opacity: 0.5 }} />
                    <Text style={styles.emptyText}>No new notifications</Text>
                    <Text style={styles.emptySubtext}>You're all caught up!</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 60, // Safe area roughly
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
        backgroundColor: 'transparent',
        zIndex: 10,
    },
    backButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    headerTitle: {
        fontFamily: FONTS.bold,
        fontSize: 18,
        color: COLORS.primary,
    },
    listContainer: {
        flex: 1,
        position: 'relative',
        top: -60, // Counteract ReceivedPriorityRequests' absolute top: 80
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        fontFamily: FONTS.bold,
        fontSize: 18,
        color: COLORS.primary,
        marginBottom: 8,
    },
    emptySubtext: {
        fontFamily: FONTS.medium,
        fontSize: 14,
        color: COLORS.textSecondary,
    },
});
