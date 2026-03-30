// src/hooks/useFilmLike.ts
import { useState, useEffect, useCallback } from 'react';
import { filmService } from '@/services/filmService';
import { supabase } from '@/lib/supabase';

export const useFilmLike = (filmId: string, creatorId: string) => {
    const [isLiked, setIsLiked] = useState(false);
    const [likesCount, setLikesCount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);

    // Get current user once
    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            setUserId(data.user?.id ?? null);
        });
    }, []);

    // Fetch initial state when filmId or userId changes
    useEffect(() => {
        if (!filmId || !userId) return;

        let cancelled = false;

        const fetchInitial = async () => {
            try {
                const [liked, count] = await Promise.all([
                    filmService.getLikeStatus(filmId, userId),
                    filmService.getLikesCount(filmId),
                ]);
                if (!cancelled) {
                    setIsLiked(liked);
                    setLikesCount(count);
                }
            } catch (e) {
                console.warn('[useFilmLike] fetch error:', e);
            }
        };

        fetchInitial();
        return () => { cancelled = true; };
    }, [filmId, userId]);

    const toggleLike = useCallback(async () => {
        if (!userId || isLoading) return;

        // RLS rule: can't like your own film
        if (userId === creatorId) return;

        // Optimistic update
        const prevLiked = isLiked;
        const prevCount = likesCount;
        setIsLiked(!prevLiked);
        setLikesCount(c => prevLiked ? c - 1 : c + 1);
        setIsLoading(true);

        try {
            await filmService.toggleLike(filmId, userId, prevLiked);
        } catch (e) {
            // Rollback on error
            console.warn('[useFilmLike] toggle error:', e);
            setIsLiked(prevLiked);
            setLikesCount(prevCount);
        } finally {
            setIsLoading(false);
        }
    }, [filmId, userId, creatorId, isLiked, likesCount, isLoading]);

    return { isLiked, likesCount, toggleLike, isLoading };
};