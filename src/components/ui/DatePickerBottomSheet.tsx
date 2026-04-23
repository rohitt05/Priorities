import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Animated,
    Dimensions,
    Pressable,
} from 'react-native';
import DatePicker from 'react-native-date-picker';
import { BlurView } from 'expo-blur';
import { COLORS, FONTS, SPACING } from '@/theme/theme';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

interface DatePickerBottomSheetProps {
    isVisible: boolean;
    onClose: () => void;
    date: Date;
    onDateChange: (date: Date) => void;
    onConfirm: (date: Date) => void;
    title?: string;
    maximumDate?: Date;
    minimumDate?: Date;
}

export const DatePickerBottomSheet = ({
    isVisible,
    onClose,
    date,
    onDateChange,
    onConfirm,
    title = 'select birthday',
    maximumDate,
    minimumDate,
}: DatePickerBottomSheetProps) => {
    const panY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

    useEffect(() => {
        if (isVisible) {
            Animated.spring(panY, {
                toValue: 0,
                friction: 10,
                tension: 40,
                useNativeDriver: true,
            }).start();
        } else {
            Animated.timing(panY, {
                toValue: SCREEN_HEIGHT,
                duration: 250,
                useNativeDriver: true,
            }).start();
        }
    }, [isVisible, panY]);

    if (!isVisible) return null;

    return (
        <Modal transparent visible={isVisible} animationType="none">
            <View style={styles.overlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
                    <View style={styles.backdrop} />
                </Pressable>

                <Animated.View
                    style={[
                        styles.bottomSheet,
                        { transform: [{ translateY: panY }] },
                    ]}
                >
                    <View style={styles.header}>
                        <View style={styles.handle} />
                        <Text style={styles.title}>{title}</Text>
                    </View>

                    <View style={styles.pickerWrapper}>
                        <DatePicker
                            date={date}
                            onDateChange={onDateChange}
                            mode="date"
                            maximumDate={maximumDate}
                            minimumDate={minimumDate}
                            style={styles.picker}
                        />
                    </View>

                    <TouchableOpacity
                        style={styles.confirmButton}
                        onPress={() => onConfirm(date)}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.confirmText}>confirm</Text>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    bottomSheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
        paddingBottom: 40,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.05)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 25,
    },
    header: {
        alignItems: 'center',
        paddingTop: 16,
        paddingBottom: 10,
    },
    handle: {
        width: 36,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        marginBottom: 16,
    },
    title: {
        fontSize: 17,
        fontFamily: FONTS.bold,
        fontWeight: '800',
        color: COLORS.text,
        textTransform: 'lowercase',
    },
    pickerWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
        height: 240,
    },
    picker: {
        height: 220,
        width: SCREEN_WIDTH,
    },
    confirmButton: {
        marginHorizontal: SPACING.xl,
        marginTop: 10,
        height: 58,
        borderRadius: 29,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    confirmText: {
        fontSize: 16,
        fontFamily: FONTS.bold,
        fontWeight: '800',
        color: '#FFF',
        textTransform: 'lowercase',
    },
});
