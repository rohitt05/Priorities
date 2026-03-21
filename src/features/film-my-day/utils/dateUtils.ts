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

/**
 * Formats an ISO string to a relative time string like "25 min ago" or "1 hr ago"
 */
export const formatRelativeTime = (isoString: string) => {
    const now = new Date();
    const date = new Date(isoString);
    const diffInMs = now.getTime() - date.getTime();
    
    const diffInSec = Math.floor(diffInMs / 1000);
    const diffInMin = Math.floor(diffInSec / 60);
    const diffInHrs = Math.floor(diffInMin / 60);
    const diffInDays = Math.floor(diffInHrs / 24);

    if (diffInMin < 1) return 'now';
    if (diffInMin < 60) return `${diffInMin} min ago`;
    if (diffInHrs < 24) return `${diffInHrs} hr ago`;
    if (diffInDays === 1) return 'yesterday';
    return `${diffInDays} days ago`;
};
