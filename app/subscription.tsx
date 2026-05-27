import React, { useEffect, useState } from 'react';
import { View, StyleSheet, SafeAreaView, Platform, StatusBar, ActivityIndicator, Alert, TouchableOpacity, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Purchases from 'react-native-purchases';
import RevenueCatUI from 'react-native-purchases-ui';
import { SubscriptionConfig } from '@/config/subscription';

export default function SubscriptionScreen() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [isPremium, setIsPremium] = useState(false);

    useEffect(() => {
        const setupRevenueCat = async () => {
            try {
                await SubscriptionConfig.initializePurchases();
                const isUserPremium = await SubscriptionConfig.checkIsPremiumUser();
                setIsPremium(isUserPremium);
            } catch (e) {
                console.error("Error setting up RevenueCat", e);
            } finally {
                setIsLoading(false);
            }
        };

        setupRevenueCat();
    }, []);

    const handlePurchaseCompleted = (customerInfo: any) => {
        if (typeof customerInfo.entitlements.active['Priorities Pro'] !== "undefined") {
            Alert.alert("Success", "Welcome to Priorities Pro!");
            setIsPremium(true);
            router.back();
        }
    };

    const handleRestoreCompleted = (customerInfo: any) => {
        if (typeof customerInfo.entitlements.active['Priorities Pro'] !== "undefined") {
            Alert.alert("Success", "Purchases restored successfully!");
            setIsPremium(true);
            router.back();
        } else {
            Alert.alert("Notice", "No active subscription found.");
        }
    };

    const openCustomerCenter = async () => {
        try {
            // Check if Customer Center is supported in this SDK version
            if (RevenueCatUI.presentCustomerCenter) {
                await RevenueCatUI.presentCustomerCenter();
            } else {
                Alert.alert("Notice", "Customer Center is not available.");
            }
        } catch (error) {
            console.error("Error opening Customer Center", error);
        }
    };

    if (isLoading) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={SubscriptionConfig.theme.premiumColor} />
            </SafeAreaView>
        );
    }

    if (isPremium) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="close" size={28} color="#FFF" />
                    </TouchableOpacity>
                </View>
                <View style={styles.premiumContent}>
                    <Ionicons name="sparkles" size={64} color={SubscriptionConfig.theme.premiumColor} />
                    <Text style={styles.premiumTitle}>You are a Pro Member!</Text>
                    <Text style={styles.premiumSubtitle}>Thank you for supporting Priorities.</Text>
                    
                    <TouchableOpacity style={styles.manageButton} onPress={openCustomerCenter}>
                        <Text style={styles.manageButtonText}>Manage Subscription</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="close" size={28} color="#FFF" />
                </TouchableOpacity>
            </View>
            <View style={styles.paywallContainer}>
                <RevenueCatUI.Paywall 
                    onPurchaseCompleted={handlePurchaseCompleted}
                    onRestoreCompleted={handleRestoreCompleted}
                />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? 40 : 10,
        zIndex: 10, // Ensure header is above paywall if needed
    },
    backButton: {
        padding: 8,
        marginLeft: -8,
        backgroundColor: 'rgba(0,0,0,0.5)', // Add background to make it visible over paywall
        borderRadius: 20,
    },
    paywallContainer: {
        flex: 1,
        marginTop: -60, // Adjust this so the paywall goes under the header or adjust as needed depending on Paywall UI
    },
    premiumContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    premiumTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#FFF',
        marginTop: 24,
        marginBottom: 8,
    },
    premiumSubtitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'center',
        marginBottom: 40,
    },
    manageButton: {
        backgroundColor: '#1A1A1A',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 215, 0, 0.3)',
    },
    manageButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
});
