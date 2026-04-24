// src/features/profile/components/PartnerSection.tsx

import React, { useEffect, useState } from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    Animated as RNAnimated,
    View,
} from 'react-native';
import * as Haptics from 'expo-haptics'; // enums only
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { getIncomingPartnerRequests } from '@/services/partnerService';

const AnimatedTouchableOpacity = RNAnimated.createAnimatedComponent(TouchableOpacity);

interface PartnerSectionProps {
    animatedCapsuleColor: any;
    onAddPartner: () => void;
}

export const PartnerSection: React.FC<PartnerSectionProps> = ({
    animatedCapsuleColor,
    onAddPartner,
}) => {
    const [hasPendingRequest, setHasPendingRequest] = useState(false);
    const { triggerSelectionHaptic } = useHapticFeedback();

    // Poll for incoming requests whenever this capsule is visible
    useEffect(() => {
        let cancelled = false;

        const check = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const uuid = session?.user?.id;
                if (!uuid || cancelled) return;
                const reqs = await getIncomingPartnerRequests(uuid);
                if (!cancelled) setHasPendingRequest(reqs.length > 0);
            } catch {
                // silently ignore
            }
        };

        check();
        return () => { cancelled = true; };
    }, []);

    return (
        <AnimatedTouchableOpacity
            activeOpacity={0.85}
            style={[styles.addPartnerCapsule, { backgroundColor: animatedCapsuleColor }]}
            onPress={() => {
                triggerSelectionHaptic();
                onAddPartner();
            }}
        >
            <Text style={styles.addPartnerText}>+ partner</Text>

            {hasPendingRequest && (
                <View style={styles.bellContainer}>
                    <Ionicons name="notifications" size={11} color="rgba(0,0,0,0.7)" />
                    <View style={styles.bellDot} />
                </View>
            )}
        </AnimatedTouchableOpacity>
    );
};

const styles = StyleSheet.create({
    addPartnerCapsule: {
        height: 28,
        paddingHorizontal: 10,
        borderRadius: 999,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 5,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 3,
    },
    addPartnerText: {
        fontSize: 10,
        fontWeight: '700',
        color: 'rgba(0,0,0,0.75)',
        letterSpacing: 0.2,
        textTransform: 'lowercase',
    },
    bellContainer: {
        position: 'relative',
        width: 14,
        height: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    bellDot: {
        position: 'absolute',
        top: -1,
        right: -2,
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#FF4757',
        borderWidth: 1,
        borderColor: '#FFFFFF',
    },
});