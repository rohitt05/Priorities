import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    StyleSheet,
    View,
    Text,
    Modal,
    TouchableWithoutFeedback,
    Animated,
    Dimensions,
    Platform,
    FlatList,
    Easing,
    InteractionManager,
} from 'react-native';


const { width, height } = Dimensions.get('window');


// --- 1. CONFIGURATION ---
const MODAL_WIDTH = width * 0.94;
const MODAL_HEIGHT = height * 0.70;
const PADDING = 10;
const AVAILABLE_WIDTH = MODAL_WIDTH - (PADDING * 2);
const COLUMN_COUNT = 8;
const ITEM_SIZE = AVAILABLE_WIDTH / COLUMN_COUNT;
const PARTICLE_COUNT = 15;


// --- 2. EMOJI DATA (EMOTIONS, HANDS, ROMANTIC, FOOD ONLY) ---
const SAFE_EMOJI_LIST = [
    // Emotions
    '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '🫠', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '☺️', '😚', '😙',
    '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🫣', '🤫', '🤔', '🫡', '🤐', '🤨', '😐', '😑', '😶', '🫥', '😏', '😒', '🙄', '😬',
    '🤥', '🫨', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '😵‍💫', '🤯', '🤠', '🥳', '🥸',
    '😎', '🤓', '🧐', '😕', '🫤', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '🥹', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱',
    '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️',

    // Romantic & Hearts
    '💌', '💘', '💝', '💖', '💗', '💓', '💞', '💕', '💟', '❣️', '💔', '❤️‍🔥', '❤️‍🩹', '❤️', '🩷', '🧡', '💛', '💚', '💙', '🩵', '💜', '🤎', '🖤', '🩶', '🤍', '💋', '💯', '🧿',

    // Hands & Gestures
    '👋', '🤚', '🖐️', '✋', '🖖', '🫱', '🫲', '🫳', '🫴', '🫷', '🫸', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '🫵',
    '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '🫶', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪',

    // Food & Drinks
    '🍇', '🍈', '🍉', '🍊', '🍋', '🍌', '🍍', '🥭', '🍎', '🍏', '🍐', '🍑', '🍒', '🍓', '🫐', '🥝', '🍅', '🫒', '🥥', '🥑', '🍆', '🥔', '🥕', '🌽', '🌶️', '🫑', '🥒', '🥬', '🥦', '🧄', '🧅', '🍄', '🥜', '🌰',
    '🍦', '🍧', '🍨', '🍩', '🍪', '🎂', '🍰', '🧁', '🥧', '🍫', '🍬', '🍭', '🍮', '🍯',

];


// --- 3. TYPE DEFINITIONS ---
interface EmojiItemProps {
    item: string;
    onSelect: (emoji: string) => void;
    size: number;
}

interface ParticleSystemProps {
    emoji: string;
    onComplete: () => void;
}

interface EmojiScatterOverlayProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (emoji: string) => void;
}

interface BurstState {
    active: boolean;
    emoji: string | null;
}


// --- 4. OPTIMIZED EMOJI ITEM COMPONENT ---
const EmojiItem = React.memo<EmojiItemProps>(({ item, onSelect, size }) => {
    return (
        <TouchableWithoutFeedback onPress={() => onSelect(item)}>
            <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
                <Text allowFontScaling={false} style={styles.emojiText}>{item}</Text>
            </View>
        </TouchableWithoutFeedback>
    );
}, (prev, next) => prev.item === next.item);


// --- 5. ISOLATED PARTICLE SYSTEM (FIXED CENTERING) ---
const ParticleSystem = React.memo<ParticleSystemProps>(({ emoji, onComplete }) => {
    const particles = useMemo(() => {
        return Array.from({ length: PARTICLE_COUNT }).map(() => {
            const angle = Math.random() * Math.PI * 2;
            const speed = 100 + Math.random() * 200;
            return {
                anim: new Animated.Value(0),
                endX: Math.cos(angle) * speed,
                endY: Math.sin(angle) * speed,
                scaleStart: 0.5 + Math.random() * 0.3,
                scaleEnd: 1.0 + Math.random() * 0.5,
                rotation: Math.random() * 360 + 'deg',
            };
        });
    }, []);

    useEffect(() => {
        const animations = particles.map(p =>
            Animated.timing(p.anim, {
                toValue: 1,
                duration: 600 + Math.random() * 300,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
            })
        );

        Animated.parallel(animations).start(({ finished }) => {
            if (finished) onComplete();
        });
    }, [onComplete, particles]);

    return (
        <View style={styles.particleContainer} pointerEvents="none">
            {particles.map((p, i) => {
                const translateX = p.anim.interpolate({ inputRange: [0, 1], outputRange: [0, p.endX] });
                const translateY = p.anim.interpolate({ inputRange: [0, 1], outputRange: [0, p.endY] });
                const opacity = p.anim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] });
                const scale = p.anim.interpolate({ inputRange: [0, 1], outputRange: [p.scaleStart, p.scaleEnd] });

                return (
                    <Animated.View
                        key={i}
                        style={[
                            styles.particle,
                            {
                                opacity,
                                transform: [
                                    { translateX },
                                    { translateY },
                                    { scale },
                                    { rotate: p.rotation }
                                ]
                            }
                        ]}
                    >
                        <Text style={styles.particleText}>{emoji}</Text>
                    </Animated.View>
                );
            })}
        </View>
    );
});


// --- 6. MAIN COMPONENT ---
const EmojiScatterOverlay: React.FC<EmojiScatterOverlayProps> = ({ visible, onClose, onSelect }) => {
    const slideUpAnim = useRef(new Animated.Value(0)).current;
    const [burstState, setBurstState] = useState<BurstState>({ active: false, emoji: null });

    useEffect(() => {
        if (visible) {
            setBurstState({ active: false, emoji: null });

            Animated.spring(slideUpAnim, {
                toValue: 1,
                friction: 8,
                tension: 60,
                useNativeDriver: true
            }).start();
        } else {
            slideUpAnim.setValue(0);
        }
    }, [visible, slideUpAnim]);

    const handleEmojiPress = useCallback((emoji: string) => {
        // Immediately start exit animation
        Animated.timing(slideUpAnim, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
        }).start();

        // Trigger burst after interaction clears
        InteractionManager.runAfterInteractions(() => {
            setBurstState({ active: true, emoji });
        });
    }, [slideUpAnim]);

    const onBurstComplete = useCallback(() => {
        if (burstState.emoji) {
            onSelect(burstState.emoji);
            onClose();
        }
    }, [burstState.emoji, onSelect, onClose]);

    const getItemLayout = useCallback((_: any, index: number) => ({
        length: ITEM_SIZE,
        offset: ITEM_SIZE * Math.floor(index / COLUMN_COUNT),
        index,
    }), []);

    const renderItem = useCallback(({ item }: { item: string }) => {
        return <EmojiItem item={item} onSelect={handleEmojiPress} size={ITEM_SIZE} />;
    }, [handleEmojiPress]);

    if (!visible && !burstState.active) return null;

    return (
        <Modal
            transparent
            visible={visible || burstState.active}
            animationType="none"
            onRequestClose={onClose}
            hardwareAccelerated={true}
        >
            <View style={styles.overlayBackdrop}>
                {!burstState.active && (
                    <TouchableWithoutFeedback onPress={onClose}>
                        <View style={StyleSheet.absoluteFill} />
                    </TouchableWithoutFeedback>
                )}

                <Animated.View
                    style={[
                        styles.glassContainer,
                        {
                            opacity: slideUpAnim,
                            transform: [
                                { translateY: slideUpAnim.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) },
                                { scale: slideUpAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }
                            ]
                        }
                    ]}
                    pointerEvents={burstState.active ? 'none' : 'auto'}
                >
                    <FlatList
                        data={SAFE_EMOJI_LIST}
                        keyExtractor={(item) => item}
                        renderItem={renderItem}
                        numColumns={COLUMN_COUNT}

                        initialNumToRender={20}
                        maxToRenderPerBatch={20}
                        windowSize={5}
                        removeClippedSubviews={true}
                        getItemLayout={getItemLayout}

                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                    />
                </Animated.View>

                <Animated.View style={[styles.capsuleContainer, { opacity: slideUpAnim }]}>
                    <Text style={styles.capsuleText}>Pick a reaction</Text>
                </Animated.View>

                {/* BURST LAYER - POSITIONED AT SCREEN CENTER */}
                {burstState.active && burstState.emoji && (
                    <View style={styles.burstCenter} pointerEvents="none">
                        <ParticleSystem
                            emoji={burstState.emoji}
                            onComplete={onBurstComplete}
                        />
                    </View>
                )}
            </View>
        </Modal>
    );
};


// --- 7. STYLES ---
const styles = StyleSheet.create({
    overlayBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 40,
    },
    glassContainer: {
        width: MODAL_WIDTH,
        height: MODAL_HEIGHT,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 32,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        overflow: 'hidden',
    },
    listContent: {
        padding: PADDING,
        paddingBottom: 40,
    },
    emojiText: {
        fontSize: 26,
        color: '#000',
    },
    capsuleContainer: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 60 : 40,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 25,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
        backgroundColor: 'rgba(20,20,20,0.6)',
    },
    capsuleText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 16,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    burstCenter: {
        position: 'absolute',
        width: width,
        height: height,
        top: 0,
        left: 0,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
    },
    particleContainer: {
        width: 200,
        height: 200,
        alignItems: 'center',
        justifyContent: 'center',
    },
    particle: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
    },
    particleText: {
        fontSize: 40,
    }
});


export default EmojiScatterOverlay;
