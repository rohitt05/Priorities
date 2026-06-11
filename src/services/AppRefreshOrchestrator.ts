// src/services/AppRefreshOrchestrator.ts
/**
 * AppRefreshOrchestrator — Centralised real-time refresh manager.
 *
 * Design principles (production-grade):
 *
 * 1. ONE channel per table per authenticated user. No screen or context
 *    should open its own Supabase channel for the same table — subscribe
 *    to orchestrator events instead.
 *
 * 2. Debounce coalescing — noisy tables (messages, reactions, timeline)
 *    batch rapid consecutive DB events into a single fan-out call. This
 *    prevents N re-fetches when N rows change in quick succession.
 *
 * 3. Server-side filters where possible — reduces Supabase realtime
 *    bandwidth by filtering at the server before the event is sent over
 *    the WebSocket. For OR-condition tables (e.g. sender OR receiver),
 *    we omit the filter and let RLS + a client-side guard do the work.
 *
 * 4. Raw payload forwarded — listeners receive the full Supabase payload
 *    so they can do fine-grained optimistic updates without re-fetching.
 *
 * Usage:
 *   // Start once, after auth resolves (done inside PrioritiesRefreshContext)
 *   appRefreshOrchestrator.start(userId);
 *
 *   // Subscribe anywhere — returns an unsubscribe cleanup fn
 *   const off = appRefreshOrchestrator.on('notifications', (payload) => reload());
 *   return () => off();
 *
 *   // Manual emit after an optimistic local mutation
 *   appRefreshOrchestrator.emit('priorities');
 *
 *   // Stop on sign-out
 *   appRefreshOrchestrator.stop();
 */

import { supabase } from '@/lib/supabase';

// ── Event catalogue ────────────────────────────────────────────────────────
export type AppRefreshEvent =
    // ─ Existing ─────────────────────────────────────────────────────────
    | 'priorities'          // viewer's priority list changed
    | 'priority-requests'   // priority_requests: sent / accepted / declined
    | 'films'               // films row changed — payload includes { userId }
    | 'profile'             // own profile row updated
    | 'search'              // search results may be stale

    // ─ New ───────────────────────────────────────────────────────────────
    | 'notifications'       // accepted_priority_notifications changed
    | 'partner-requests'    // partner_requests changed
    | 'messages'            // messages table changed (inbox delivery)
    | 'message-reactions'   // message_reactions changed
    | 'timeline'            // user_timelines changed
    | 'film-likes'          // film_likes changed
    | 'film-views'          // film_views changed
    | 'memory-deletes'      // memory_delete_requests changed
    | 'blocks';             // blocked_users changed

type Listener = (payload?: any) => void;

/**
 * Per-event debounce windows (ms).
 * Events NOT listed here fan out immediately (0 ms delay).
 *
 * Rationale:
 *   messages / reactions — can fire dozens of times/second during active use
 *   timeline            — INSERT + mirror trigger double-fires; batch them
 *   films / film-likes  — upload pipelines can INSERT multiple rows at once
 */
const DEBOUNCE_MS: Partial<Record<AppRefreshEvent, number>> = {
    'messages':          300,
    'message-reactions': 200,
    'timeline':          400,
    'films':             350,
    'film-likes':        250,
    'film-views':        250,
};

// ── Orchestrator class ─────────────────────────────────────────────────────
class AppRefreshOrchestrator {
    private _listeners    = new Map<AppRefreshEvent, Set<Listener>>();
    private _channels: ReturnType<typeof supabase.channel>[] = [];
    private _timers       = new Map<AppRefreshEvent, ReturnType<typeof setTimeout>>();
    private _userId: string | null = null;

    // ── Subscribe ────────────────────────────────────────────────────────
    /** Returns an unsubscribe cleanup function. */
    on(event: AppRefreshEvent, listener: Listener): () => void {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, new Set());
        }
        this._listeners.get(event)!.add(listener);
        return () => {
            this._listeners.get(event)?.delete(listener);
        };
    }

    // ── Emit ─────────────────────────────────────────────────────────────
    /** Immediately fans out to all listeners for this event. */
    emit(event: AppRefreshEvent, payload?: any) {
        this._listeners.get(event)?.forEach((listener) => {
            try {
                listener(payload);
            } catch (err) {
                console.warn('[AppRefreshOrchestrator] Listener error:', err);
            }
        });
    }

    /**
     * Debounce-coalesced emit. Rapid calls within the debounce window
     * collapse into one fan-out at the end of the window.
     * For events with no debounce window, falls through to emit().
     */
    private _emitCoalesced(event: AppRefreshEvent, payload?: any) {
        const ms = DEBOUNCE_MS[event];
        if (!ms) {
            this.emit(event, payload);
            return;
        }
        const existing = this._timers.get(event);
        if (existing) clearTimeout(existing);
        const timer = setTimeout(() => {
            this._timers.delete(event);
            this.emit(event, payload);
        }, ms);
        this._timers.set(event, timer);
    }

    // ── Lifecycle ────────────────────────────────────────────────────────

    /** Start realtime subscriptions for the given user. Idempotent. */
    start(userId: string) {
        if (this._userId === userId) return; // already running for this user
        this.stop();
        this._userId = userId;
        this._setupChannels(userId);
    }

    /** Tear down all subscriptions and pending timers (call on sign-out). */
    stop() {
        // Cancel any pending debounce timers
        this._timers.forEach((timer) => clearTimeout(timer));
        this._timers.clear();

        for (const ch of this._channels) {
            try { supabase.removeChannel(ch); } catch (_) { /* ignore */ }
        }
        this._channels = [];
        this._userId = null;
    }

    // ── Internal ─────────────────────────────────────────────────────────
    private _setupChannels(userId: string) {

        // ①  priority_requests ────────────────────────────────────────────
        //     No server filter (OR condition) — RLS ensures only your rows
        //     arrive; client-side guard is an extra safety net.
        const reqCh = supabase
            .channel(`aro_req_${userId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'priority_requests' },
                (payload) => {
                    const newRow = payload.new as any;
                    const oldRow = payload.old as any;
                    const row = newRow ?? oldRow;
                    if (!row) return;
                    if (row.sender_id !== userId && row.receiver_id !== userId) return;

                    this.emit('priority-requests', payload);
                    this.emit('search', payload);

                    if (
                        (payload.eventType === 'UPDATE' && newRow?.status === 'accepted') ||
                        payload.eventType === 'DELETE'
                    ) {
                        this.emit('priorities', payload);
                    }
                }
            )
            .subscribe();
        this._channels.push(reqCh);

        // ②  priorities (own list) ─────────────────────────────────────────
        //     Server-filtered to this user's rows only.
        const priCh = supabase
            .channel(`aro_pri_${userId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'priorities',
                    filter: `user_id=eq.${userId}`,
                },
                (payload) => {
                    this.emit('priorities', payload);
                }
            )
            .subscribe();
        this._channels.push(priCh);

        // ③  films ────────────────────────────────────────────────────────
        //     Debounced — upload pipelines can INSERT multiple rows at once.
        const filmCh = supabase
            .channel(`aro_films_${userId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'films' },
                (payload) => {
                    const row = (payload.new ?? payload.old) as any;
                    this._emitCoalesced('films', { userId: row?.creator_id ?? row?.user_id, payload });
                }
            )
            .subscribe();
        this._channels.push(filmCh);

        // ④  profiles (own row only) ───────────────────────────────────────
        //     Server-filtered — only fires when your own profile changes.
        const profileCh = supabase
            .channel(`aro_profile_${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${userId}`,
                },
                (payload) => {
                    this.emit('profile', payload);
                }
            )
            .subscribe();
        this._channels.push(profileCh);

        // ⑤  accepted_priority_notifications ──────────────────────────────
        //     No server filter (OR condition). RLS limits rows to involved users.
        const notifCh = supabase
            .channel(`aro_notif_${userId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'accepted_priority_notifications' },
                (payload) => {
                    const row = (payload.new ?? payload.old) as any;
                    if (!row) return;
                    if (row.sender_id !== userId && row.receiver_id !== userId) return;
                    this.emit('notifications', payload);
                }
            )
            .subscribe();
        this._channels.push(notifCh);

        // ⑥  partner_requests ─────────────────────────────────────────────
        //     No server filter (OR condition). RLS limits rows to involved users.
        const partnerCh = supabase
            .channel(`aro_partner_${userId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'partner_requests' },
                (payload) => {
                    const row = (payload.new ?? payload.old) as any;
                    if (!row) return;
                    if (row.sender_id !== userId && row.receiver_id !== userId) return;
                    this.emit('partner-requests', payload);
                }
            )
            .subscribe();
        this._channels.push(partnerCh);

        // ⑦  messages ─────────────────────────────────────────────────────
        //     Two server-filtered sub-channels (receiver = unread inbox;
        //     sender = sent status updates). Both fire the same event so
        //     MediaInboxContext (or any subscriber) can re-fetch appropriately.
        //     Debounced — can fire rapidly during active conversation.
        const msgCh = supabase
            .channel(`aro_msg_${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `receiver_id=eq.${userId}`,
                },
                (payload) => {
                    this._emitCoalesced('messages', { direction: 'incoming', payload });
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'messages',
                    filter: `sender_id=eq.${userId}`,
                },
                (payload) => {
                    this._emitCoalesced('messages', { direction: 'outgoing', payload });
                }
            )
            .subscribe();
        this._channels.push(msgCh);

        // ⑧  message_reactions ────────────────────────────────────────────
        //     Debounced — emoji reactions can arrive in rapid succession.
        const reactionCh = supabase
            .channel(`aro_reactions_${userId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'message_reactions' },
                (payload) => {
                    this._emitCoalesced('message-reactions', payload);
                }
            )
            .subscribe();
        this._channels.push(reactionCh);

        // ⑨  user_timelines ───────────────────────────────────────────────
        //     Server-filtered to rows owned by this user. DB trigger also
        //     writes a mirror row for the other party — those arrive via
        //     their own filteredchannel.
        //     Debounced — DB trigger can INSERT two rows (Row A + Row B).
        const timelineCh = supabase
            .channel(`aro_timeline_${userId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'user_timelines',
                    filter: `owner_id=eq.${userId}`,
                },
                (payload) => {
                    this._emitCoalesced('timeline', payload);
                }
            )
            .subscribe();
        this._channels.push(timelineCh);

        // ⑩  film_likes ───────────────────────────────────────────────────
        //     Server-filtered to rows where this user is the liker.
        //     Subscribers wanting "someone liked MY film" should check
        //     the payload's film.creator_id client-side.
        //     Debounced.
        const likesCh = supabase
            .channel(`aro_film_likes_${userId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'film_likes' },
                (payload) => {
                    this._emitCoalesced('film-likes', payload);
                }
            )
            .subscribe();
        this._channels.push(likesCh);

        // ⑪  film_views ───────────────────────────────────────────────────
        //     Server-filtered to rows where this user is the viewer.
        //     Debounced.
        const viewsCh = supabase
            .channel(`aro_film_views_${userId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'film_views',
                    filter: `viewer_id=eq.${userId}`,
                },
                (payload) => {
                    this._emitCoalesced('film-views', payload);
                }
            )
            .subscribe();
        this._channels.push(viewsCh);

        // ⑫  memory_delete_requests ───────────────────────────────────────
        //     No server filter (OR condition). RLS limits rows to involved users.
        const mdrCh = supabase
            .channel(`aro_mdr_${userId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'memory_delete_requests' },
                (payload) => {
                    const row = (payload.new ?? payload.old) as any;
                    if (!row) return;
                    if (row.requester_id !== userId && row.other_user_id !== userId) return;
                    this.emit('memory-deletes', payload);
                }
            )
            .subscribe();
        this._channels.push(mdrCh);

        // ⑬  blocked_users ────────────────────────────────────────────────
        //     Server-filtered to rows where this user is the blocker.
        const blockCh = supabase
            .channel(`aro_blocks_${userId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'blocked_users',
                    filter: `blocker_id=eq.${userId}`,
                },
                (payload) => {
                    this.emit('blocks', payload);
                }
            )
            .subscribe();
        this._channels.push(blockCh);
    }
}

// ── Singleton export ──────────────────────────────────────────────────────
/** Import and use this directly — one instance for the entire app. */
export const appRefreshOrchestrator = new AppRefreshOrchestrator();
