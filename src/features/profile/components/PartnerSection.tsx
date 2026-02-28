import React from 'react';
import { StyleSheet, Text, TouchableOpacity, Animated as RNAnimated } from 'react-native';
import { SharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { User } from '@/types/userTypes';
import FloatingPartnerIcon from '@/features/partners/components/FloatingPartnerIcon';

const AnimatedTouchableOpacity = RNAnimated.createAnimatedComponent(TouchableOpacity);

interface PartnerSectionProps {
    partnerUser: User | null;
    relationshipLabel: string;
    animatedBgColor: any;
    animatedCapsuleColor: any;
    pullY: SharedValue<number>;
    partnerContainerStyle: any;
    onAddPartner: () => void;
    onRemovePartner: () => void;
}

export const PartnerSection: React.FC<PartnerSectionProps> = ({
    partnerUser,
    relationshipLabel,
    animatedBgColor,
    animatedCapsuleColor,
    pullY,
    onAddPartner,
    onRemovePartner,
}) => {
    if (partnerUser) {
        return (
            <FloatingPartnerIcon
                partnerUser={partnerUser}
                relationshipLabel={relationshipLabel}
                animatedBgColor={animatedBgColor}
                pullY={pullY}
                onRemove={onRemovePartner}
            />
        );
    }

    return (
        <AnimatedTouchableOpacity
            activeOpacity={0.85}
            style={[styles.addPartnerCapsule, { backgroundColor: animatedCapsuleColor }]}
            onPress={() => {
                Haptics.selectionAsync();
                onAddPartner();
            }}
        >
            <Text style={styles.addPartnerText}>+ partner</Text>
        </AnimatedTouchableOpacity>
    );
};

const styles = StyleSheet.create({
    addPartnerCapsule: {
        height: 28,
        paddingHorizontal: 10,
        borderRadius: 999,
        justifyContent: 'center',
        alignItems: 'center',
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
});
