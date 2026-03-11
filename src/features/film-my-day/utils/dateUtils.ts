/**
 * Formats an ISO string to a time string like "HH:MM AM/PM"
 */
export const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

/**
 * Formats an ISO string to a date string like "MMM DD"
 */
export const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};
