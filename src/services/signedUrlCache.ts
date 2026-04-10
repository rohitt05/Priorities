// src/services/signedUrlCache.ts


// In-memory cache: "bucket::path" → { url, expiresAt }
export const cache = new Map<string, { url: string; expiresAt: number }>();

/**
 * Extracts a stable cache key from any URL format:
 * - Signed URL  → "bucket::path"
 * - Public URL  → the URL itself (never changes)
 * - Raw path    → the path as-is
 */
export function extractCacheKey(uri: string): string | null {
    if (!uri) return null;

    if (uri.includes('/storage/v1/object/sign/')) {
        const match = uri.match(/\/storage\/v1\/object\/sign\/([^/]+)\/(.+?)(\?|$)/);
        if (match) return `${match[1]}/${match[2]}`;
    }

    // Public URL or raw path — use as-is
    return uri;
}

// In signedUrlCache.ts — add these logs temporarily

export function getCachedUrl(key: string): string | null {
    const entry = cache.get(key);
    if (!entry) {
        console.log('[SignedUrlCache] MISS →', key); 
        return null;
    }
    if (Date.now() > entry.expiresAt) {
        cache.delete(key);
        console.log('[SignedUrlCache] EXPIRED →', key);
        return null;
    }
    console.log('[SignedUrlCache] HIT ✅ →', key);
    return entry.url;
}

/**
 * Stores a signed URL in cache.
 * Default TTL is 55 minutes (signed URLs expire after 60 min, so 5 min buffer).
 */
export function setCachedUrl(key: string, url: string, ttlMs = 55 * 60 * 1000): void {
    console.log('[SignedUrlCache] SET key:', key);
    cache.set(key, { url, expiresAt: Date.now() + ttlMs });
}

/**
 * Clears all cached entries (e.g., on logout).
 */
export function clearUrlCache(): void {
    console.warn('[Cache] CLEARED');
    cache.clear();
}