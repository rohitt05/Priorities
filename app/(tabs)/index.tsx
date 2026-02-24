import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect, useMemo } from 'react';
import { FontAwesome6 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '@/theme/theme';
import FloatingSearch from '@/components/ui/FloatingSearch';
import PriorityList from '@/features/partners/components/PriorityList';
import { PriorityUser, PriorityUserWithPost } from '@/types/userTypes';
import { useBackground } from '@/contexts/BackgroundContext';
import usersData from '@/data/users.json';
import FilmSwiperBlob from '@/features/film-my-day/components/FilmSwiperBlob';
import FilmMyDay from '@/features/film-my-day/components/FilmMyDayContent';
import { useRouter } from 'expo-router';
import { useSharedValue } from 'react-native-reanimated';

const PRIORITIES_KEY = '@priorities_list';

export default function HomeScreen() {
    const router = useRouter();
    const [priorities, setPriorities] = useState<PriorityUserWithPost[]>([]);
    const [activeUser, setActiveUser] = useState<PriorityUserWithPost | null>(null);
    const scrollX = useSharedValue(0);
    const { handleColorChange } = useBackground();

    // Load priorities on mount
    useEffect(() => {
        const loadPriorities = async () => {
            try {
                const saved = await AsyncStorage.getItem(PRIORITIES_KEY);
                if (saved) {
                    const parsed = JSON.parse(saved) as PriorityUser[];
                    const data = Array.isArray(usersData) ? usersData : (usersData as any).default || [];
                    const synced = parsed.map(savedUser => {
                        const latestUser = data.find((u: any) => u.uniqueUserId === savedUser.uniqueUserId);
                        return latestUser ? { ...savedUser, ...latestUser } : savedUser;
                    });
                    setPriorities(synced);
                }
            } catch (error) {
                console.error('Error loading priorities:', error);
            }
        };
        loadPriorities();
    }, []);

    // Save priorities
    useEffect(() => {
        if (priorities.length > 0) {
            AsyncStorage.setItem(PRIORITIES_KEY, JSON.stringify(priorities)).catch(console.error);
        }
    }, [priorities]);

    const handleAddPriority = (user: PriorityUser) => {
        if (!priorities.find(p => p.id === user.id)) {
            setPriorities(prev => [user, ...prev]);
        }
    };

    const hasPriorities = priorities.length > 0;

    return (
        <View style={styles.container}>
            {/* Main Content Area */}
            <View style={styles.mainContent}>
                <PriorityList
                    priorities={priorities}
                    onColorChange={handleColorChange}
                    onActiveUserChange={setActiveUser}
                    scrollX={scrollX}
                />
            </View>

            {hasPriorities && (
                <FilmSwiperBlob
                    activeUser={activeUser}
                    scrollX={scrollX}
                    onReveal={() => {
                        if (activeUser) {
                            router.push({
                                pathname: '/UserFilms',
                                params: {
                                    userId: (activeUser as any).uniqueUserId || activeUser.id,
                                    userName: activeUser.name,
                                    dominantColor: activeUser.dominantColor
                                }
                            });
                        }
                    }}
                />
            )}

            {!hasPriorities && (
                <View style={styles.pointerContainer}>
                    <FontAwesome6
                        name="hand-point-right"
                        size={32}
                        color={COLORS.primary}
                        style={styles.pointerIcon}
                    />
                </View>
            )}
            <FilmMyDay />
            <FloatingSearch onAddPriority={handleAddPriority} />

            <StatusBar style="auto" />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    mainContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: 100, // Standard padding
    },
    pointerContainer: {
        position: 'absolute',
        bottom: 120,
        right: 80,
        alignItems: 'center',
        opacity: 0.3,
        pointerEvents: 'none',
    },
    pointerIcon: {
        transform: [{ rotate: '45deg' }],
        opacity: 0.8,
    },
});
