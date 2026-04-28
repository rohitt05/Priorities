// src/services/timelineNotifyBridge.ts
//
// Breaks the circular-import problem between MediaInboxContext and
// UserTimelineContext. Neither context imports the other.
//
// Usage:
//   UserTimelineContext  → setTimelineInsertHandler(fn)
//   MediaInboxContext    → notifyTimelineInsert(otherAuthUserId)

type Handler = (otherAuthUserId: string) => void;

let handler: Handler | null = null;

/** Called once by UserTimelineProvider on mount. */
export const setTimelineInsertHandler = (fn: Handler) => {
    handler = fn;
};

/** Called by MediaInboxContext after a successful user_timelines insert. */
export const notifyTimelineInsert = (otherAuthUserId: string) => {
    handler?.(otherAuthUserId);
};
