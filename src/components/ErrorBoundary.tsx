import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '@/theme/theme';

interface State {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends React.Component<
    { children: React.ReactNode },
    State
> {
    state: State = { hasError: false };

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        // Replace with Sentry / Crashlytics when you integrate one
        console.error('[ErrorBoundary] Uncaught error:', error.message);
        console.error('[ErrorBoundary] Component stack:', info.componentStack);
    }

    private handleRetry = () => {
        this.setState({ hasError: false, error: undefined });
    };

    render() {
        if (this.state.hasError) {
            return (
                <View style={styles.container}>
                    <Text style={styles.emoji}>⚠️</Text>
                    <Text style={styles.title}>something went wrong</Text>
                    <Text style={styles.subtitle} numberOfLines={3}>
                        {this.state.error?.message ?? 'an unexpected error occurred.'}
                    </Text>
                    <TouchableOpacity style={styles.button} onPress={this.handleRetry} activeOpacity={0.8}>
                        <Text style={styles.buttonText}>try again</Text>
                    </TouchableOpacity>
                </View>
            );
        }
        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
    },
    emoji: {
        fontSize: 48,
        marginBottom: 20,
    },
    title: {
        fontSize: 20,
        fontFamily: FONTS.bold,
        fontWeight: '800',
        color: COLORS.text,
        textTransform: 'lowercase',
        marginBottom: 10,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        fontFamily: FONTS.regular,
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 32,
        textTransform: 'lowercase',
    },
    button: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 999,
    },
    buttonText: {
        fontSize: 15,
        fontFamily: FONTS.bold,
        fontWeight: '700',
        color: '#fff',
        textTransform: 'lowercase',
    },
});
