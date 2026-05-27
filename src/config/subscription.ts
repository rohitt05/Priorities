import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';

const REVENUECAT_API_KEY = 'test_KkmdpcumllaqHLIgRKdBawqjrva';

export const SubscriptionConfig = {
    // Toggles whether a paid subscription is required to upload media from the camera roll (gallery).
    // Set to true to enforce premium paywalls (like Locket Gold).
    requiresPremiumForGallery: true,

    // Initialize Purchases if not already done
    initializePurchases: async () => {
        try {
            const isConfigured = await Purchases.isConfigured();
            if (!isConfigured) {
                Purchases.configure({ apiKey: REVENUECAT_API_KEY });
                console.log('RevenueCat Purchases configured successfully');
            }
        } catch (e) {
            console.error('Failed to configure RevenueCat Purchases', e);
        }
    },

    // Live check from RevenueCat
    checkIsPremiumUser: async () => {
        try {
            await SubscriptionConfig.initializePurchases();
            const customerInfo = await Purchases.getCustomerInfo();
            // Assuming your entitlement identifier in RevenueCat is 'Priorities Pro'
            return typeof customerInfo.entitlements.active['Priorities Pro'] !== 'undefined';
        } catch (e) {
            console.error('Error fetching customer info', e);
            return false;
        }
    },

    // Premium theme settings
    theme: {
        premiumColor: '#FFD700', // Gold color for premium UI
        premiumText: 'priorities+',
    }
};
