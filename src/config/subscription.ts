export const SubscriptionConfig = {
    // Toggles whether a paid subscription is required to upload media from the camera roll (gallery).
    // Set to true to enforce premium paywalls (like Locket Gold).
    requiresPremiumForGallery: true,

    // Simulate user state (in a real app, this would be fetched from backend/revenuecat)
    isPremiumUser: false,

    // Premium theme settings
    theme: {
        premiumColor: '#FFD700', // Gold color for premium UI
        premiumText: 'priorities+',
    }
};
