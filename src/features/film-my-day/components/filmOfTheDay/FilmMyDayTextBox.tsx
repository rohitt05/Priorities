import React from 'react';
import {
    View,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    Platform,
    KeyboardAvoidingView,
    Dimensions,
    Pressable,
    Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '@/theme/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface FilmMyDayTextBoxProps {
    value: string;
    onChangeText: (text: string) => void;
    onClose: () => void;
    placeholder?: string;
}

const FilmMyDayTextBox: React.FC<FilmMyDayTextBoxProps> = ({
    value,
    onChangeText,
    onClose,
    placeholder = "say something...",
}) => {
    const handleBackdropPress = () => {
        if (value.trim().length === 0) {
            onClose();
        } else {
            Keyboard.dismiss();
        }
    };

    return (
        <View style={styles.outerContainer}>
            {/* Backdrop to capture touches */}
            <Pressable style={styles.backdrop} onPress={handleBackdropPress} />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardAvoidingView}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : -20}
            >
                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.7)']}
                    style={styles.gradientContainer}
                >
                    <TextInput
                        style={styles.input}
                        value={value}
                        onChangeText={onChangeText}
                        placeholder={placeholder}
                        placeholderTextColor="rgba(255, 255, 255, 0.4)"
                        multiline={false}
                        autoFocus
                        selectionColor={COLORS.primary}
                        returnKeyType="done"
                        blurOnSubmit={true}
                        onSubmitEditing={Keyboard.dismiss}
                        textAlign="center"
                    />
                </LinearGradient>
            </KeyboardAvoidingView>
        </View>
    );
};

const styles = StyleSheet.create({
    outerContainer: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1000,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    keyboardAvoidingView: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    gradientContainer: {
        width: SCREEN_WIDTH,
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: Platform.OS === 'ios' ? 45 : 30,
    },
    input: {
        width: '100%',
        color: '#FFF',
        fontSize: 24,
        fontWeight: '700',
        height: 60,
        textAlign: 'center',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
});

export default FilmMyDayTextBox;
