import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Link } from 'expo-router'; // ✅ Import Link
import { COLORS } from '@/constants/theme';

const FilmMyDay = () => {
    return (
        // ✅ Navigate to the 'FilmMyDay' screen in your app folder
        <Link href="/FilmMyDay" asChild>
            <TouchableOpacity
                style={styles.container}
                activeOpacity={0.8}
            >
                <View style={styles.iconContainer}>
                    <Feather name="camera" size={24} color="#FFF" />
                </View>
            </TouchableOpacity>
        </Link>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 16,
        right: 20,
        zIndex: 50,
    },
    iconContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',

        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.30,
        shadowRadius: 4.65,
        elevation: 8,
    }
});

export default FilmMyDay;
