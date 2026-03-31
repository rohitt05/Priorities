// src/features/film-my-day/components/filmCountdown.ts
//
// Countdown logic for film bubbles.
// Each film expires 24 hrs after it was posted.
// Returns a live label like "19 hrs left", "1 hr left", "< 1 hr left", "Expired".

import { useEffect, useState } from 'react';

const FILM_LIFETIME_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Pure function — call this anywhere you need a one-shot label.
 */
export function getCountdownLabel(createdAtIso: string): string {
    const postedAt = new Date(createdAtIso).getTime();
    const expiresAt = postedAt + FILM_LIFETIME_MS;
    const remaining = expiresAt - Date.now();

    if (remaining <= 0) return 'Expired';

    const totalMins = Math.floor(remaining / 60000);
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;

    if (hrs >= 1) {
        // e.g. "19 hrs left", "1 hr left"
        return `${hrs} ${hrs === 1 ? 'hr' : 'hrs'} left`;
    }
    if (mins >= 1) {
        // e.g. "45 mins left", "1 min left"
        return `${mins} ${mins === 1 ? 'min' : 'mins'} left`;
    }
    return '< 1 min left';
}

/**
 * Hook — returns a live countdown label that updates every minute.
 * Pass the film's createdAt ISO string.
 */
export function useFilmCountdown(createdAtIso: string): string {
    const [label, setLabel] = useState(() => getCountdownLabel(createdAtIso));

    useEffect(() => {
        // Update immediately in case state was stale
        setLabel(getCountdownLabel(createdAtIso));

        const interval = setInterval(() => {
            const next = getCountdownLabel(createdAtIso);
            setLabel(next);
            // Stop ticking once expired
            if (next === 'Expired') clearInterval(interval);
        }, 60_000); // refresh every minute

        return () => clearInterval(interval);
    }, [createdAtIso]);

    return label;
}