import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect } from 'react';
import { FontAwesome6 } from '@expo/vector-icons';
import { COLORS } from '@/theme/theme';
import FloatingSearch from '@/components/ui/FloatingSearch';
import PriorityList from '@/features/partners/components/PriorityList';
import { PriorityUserWithPost } from '@/types/domain';
import { useBackground } from '@/contexts/BackgroundContext';
import FilmSwiperBlob from '@/features/film-my-day/components/FilmSwiperBlob';
import FilmMyDay from '@/features/film-my-day/components/FilmMyDayContent';
import { useRouter } from 'expo-router';
import { useSharedValue } from 'react-native-reanimated';
import { getMyPriorities } from '@/services/priorityService';
import { getCurrentUserId } from '@/services/authService';


export default function HomeScreen() {
    const router = useRouter();
    const [priorities, setPriorities] = useState<PriorityUserWithPost[]>([]);
    const [activeUser, setActiveUser] = useState<PriorityUserWithPost | null>(null);
    const scrollX = useSharedValue(0);
    const { handleColorChange } = useBackground();


    // ─── Load priorities from Supabase on mount ───────────────
    useEffect(() => {
        const loadPriorities = async () => {
            try {
                const userId = await getCurrentUserId();
                const data = await getMyPriorities(userId);
                setPriorities(data as PriorityUserWithPost[]);
            } catch (error) {
                console.error('Error loading priorities:', error);
            }
        };
        loadPriorities();
    }, []);


    const hasPriorities = priorities.length > 0;


    return (
        <View style={styles.container}>
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
            <FloatingSearch />
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
        paddingBottom: 100,
        width: '100%',
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
