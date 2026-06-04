import { Platform } from 'react-native';

export const SubscriptionConfig = {
    // Toggles whether a paid subscription is required to upload media from the camera roll (gallery).
    // Always false since the app is completely free.
    requiresPremiumForGallery: false,

    // Disable Purchases initialization (no-op)
    initializePurchases: async () => {
        // No-op since we do not use RevenueCat anymore
        console.log('RevenueCat integration disabled (App is free)');
    },

    // Always returns true so all premium gates are unlocked
    checkIsPremiumUser: async () => {
        return true;
    },

    // Premium theme settings
    theme: {
        premiumColor: '#FFD700', // Gold color for premium UI
        premiumText: 'priorities+',
    }
};
