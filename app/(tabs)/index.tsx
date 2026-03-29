import { StyleSheet, View, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect } from 'react';
import { COLORS, FONTS, FONT_SIZES } from '@/theme/theme';
import FloatingSearch from '@/components/ui/FloatingSearch';
import PriorityList from '@/features/partners/components/PriorityList';
import { PriorityUserWithPost } from '@/types/domain';
import { useBackground } from '@/contexts/BackgroundContext';
import FilmSwiperBlob from '@/features/film-my-day/components/FilmSwiperBlob';
import FilmMyDay from '@/features/film-my-day/components/FilmMyDayContent';
import { useRouter } from 'expo-router';
import { useSharedValue } from 'react-native-reanimated';
import { getMyPriorities, getOutgoingPendingRequests } from '@/services/priorityService';
import { getCurrentUserId } from '@/services/authService';
import { usePrioritiesRefresh } from '@/contexts/PrioritiesRefreshContext';
import { FontAwesome6 } from '@expo/vector-icons';


export default function HomeScreen() {
    const router = useRouter();
    const [priorities, setPriorities] = useState<PriorityUserWithPost[]>([]);
    const [activeUser, setActiveUser] = useState<PriorityUserWithPost | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const scrollX = useSharedValue(0);
    const { handleColorChange } = useBackground();
    const { refreshKey } = usePrioritiesRefresh();


    useEffect(() => {
        const loadPriorities = async () => {
            try {
                const userId = await getCurrentUserId();

                const real = await getMyPriorities(userId);
                const pending = await getOutgoingPendingRequests(userId);

                // pending is already mapped — no .profiles key exists
                const pendingUsers: PriorityUserWithPost[] = pending.map((req: any) => ({
                    id: req.id,
                    uniqueUserId: req.uniqueUserId,
                    name: req.name,
                    profilePicture: req.profilePicture,
                    dominantColor: req.dominantColor ?? COLORS.primary,
                    isPending: true,
                }));

                const realIds = new Set((real as any[]).map((r: any) => r.id));
                const filteredPending = pendingUsers.filter(p => !realIds.has(p.id));

                setPriorities([...(real as PriorityUserWithPost[]), ...filteredPending]);
            } catch (error) {
                console.error('Error loading priorities:', error);
            } finally {
                setIsLoaded(true);
            }
        };
        loadPriorities();
    }, [refreshKey]);


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
                                    userId: activeUser.id,           // ← UUID, not uniqueUserId
                                    userName: activeUser.name,
                                    dominantColor: activeUser.dominantColor,
                                }
                            });
                        }
                    }}
                />
            )}

            {isLoaded && !hasPriorities && (
                <View style={styles.emptyContainer} pointerEvents="none">
                    <Text style={styles.emptyTitle}>Add people who matter</Text>
                    <Text style={styles.emptySubtitle}>
                        Tap on the search icon below{'\n'}to add your priorities
                    </Text>
                </View>
            )}

            {isLoaded && !hasPriorities && (
                <View style={styles.pointerContainer} pointerEvents="none">
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
    emptyContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 100,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
    },
    emptyTitle: {
        fontFamily: FONTS.bold,
        fontSize: 20,
        color: COLORS.text,
        textAlign: 'center',
        letterSpacing: -0.4,
        opacity: 0.85,
    },
    emptySubtitle: {
        fontFamily: FONTS.bold,
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        opacity: 0.6,
    },
    pointerContainer: {
        position: 'absolute',
        bottom: 70,
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