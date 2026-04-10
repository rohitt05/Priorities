// src/components/ui/MessageMediaItemBottomSheet.tsx
import React, { useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    Easing,
} from 'react-native-reanimated';
import { FONTS } from '@/theme/theme';

// Height grows to fit the third row
const SHEET_HEIGHT = 240;

interface MessageMediaItemBottomSheetProps {
    visible: boolean;
    onClose: () => void;
    onDownload: () => void;
    onDelete?: () => void;
    onRequestMemoryDeletion?: () => void;
    isSaving?: boolean;
    isDeleting?: boolean;
    isRequestingDeletion?: boolean;
    canRequestDeletion?: boolean;
}

export default function MessageMediaItemBottomSheet({
    visible,
    onClose,
    onDownload,
    onDelete,
    onRequestMemoryDeletion,
    isSaving = false,
    isDeleting = false,
    isRequestingDeletion = false,
    canRequestDeletion = false,
}: MessageMediaItemBottomSheetProps) {
    const insets = useSafeAreaInsets();
    const translateY = useSharedValue(SHEET_HEIGHT);
    const bgOpacity = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            bgOpacity.value = withTiming(1, { duration: 240 });
            translateY.value = withTiming(0, {
                duration: 280,
                easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            });
        } else {
            bgOpacity.value = withTiming(0, { duration: 200 });
            translateY.value = withTiming(SHEET_HEIGHT, {
                duration: 240,
                easing: Easing.bezier(0.4, 0, 1, 1),
            });
        }
    }, [visible]);

    const sheetStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const overlayStyle = useAnimatedStyle(() => ({
        opacity: bgOpacity.value,
        pointerEvents: visible ? 'auto' : 'none',
    } as any));

    if (!visible) return null;

    const busy = isSaving || isDeleting || isRequestingDeletion;

    return (
        <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, overlayStyle]}>
            {/* Backdrop — tap to dismiss */}
            <Pressable
                style={StyleSheet.absoluteFill}
                onPress={busy ? undefined : onClose}
            />

            {/* Sheet */}
            <Animated.View
                style={[
                    styles.sheet,
                    { paddingBottom: Math.max(insets.bottom, 28) },
                    sheetStyle,
                ]}
            >
                {/* Handle pill */}
                <View style={styles.handle} />

                {/* Save to Camera Roll */}
                <TouchableOpacity
                    style={[styles.row, busy && styles.rowDisabled]}
                    onPress={() => {
                        if (!busy) {
                            onClose();
                            setTimeout(() => onDownload(), 300);
                        }
                    }}
                    disabled={busy}
                    activeOpacity={0.55}
                >
                    <Text style={styles.rowText}>
                        {isSaving ? 'Saving…' : 'Save to Camera Roll'}
                    </Text>
                </TouchableOpacity>

                <View style={styles.separator} />

                {/* Request Memory Deletion — always use request logic now */}
                {onRequestMemoryDeletion && (
                    <>
                        <TouchableOpacity
                            style={[styles.row, busy && styles.rowDisabled]}
                            onPress={() => {
                                if (!busy && onRequestMemoryDeletion) {
                                    onClose();
                                    setTimeout(() => onRequestMemoryDeletion(), 300);
                                }
                            }}
                            disabled={busy}
                            activeOpacity={0.55}
                        >
                            <Text style={[styles.rowText, styles.requestText]}>
                                {isRequestingDeletion ? 'Sending Request…' : 'Request Memory Deletion'}
                            </Text>
                        </TouchableOpacity>
                    </>
                )}
            </Animated.View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        zIndex: 2000,
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingTop: 10,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 16,
    },
    handle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(0,0,0,0.15)',
        alignSelf: 'center',
        marginBottom: 6,
    },
    row: {
        paddingVertical: 18,
        paddingHorizontal: 24,
        justifyContent: 'center',
    },
    rowDisabled: {
        opacity: 0.4,
    },
    rowText: {
        fontFamily: FONTS.regular,
        fontSize: 17,
        color: '#1C1C1E',
        textAlign: 'center',
        letterSpacing: -0.2,
    },
    requestText: {
        color: '#FF9500',   // Orange — intentional: destructive request, not irreversible yet
        fontFamily: FONTS.bold,
    },
    dangerText: {
        color: '#FF3B30',
        fontFamily: FONTS.bold,
    },
    separator: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: 'rgba(0,0,0,0.12)',
    },
});
