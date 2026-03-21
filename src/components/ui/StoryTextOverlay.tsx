import React, { useState, useCallback, useImperativeHandle, forwardRef, useRef, useEffect } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TextInput,
    Dimensions,
    Pressable,
    KeyboardAvoidingView,
    Platform,
    Keyboard,
    TouchableOpacity,
    BackHandler,
} from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    runOnJS,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { MaterialIcons } from '@expo/vector-icons';
import { FONTS } from '@/theme/theme';
import MediaColorPicker from './MediaColorPicker';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const HORIZONTAL_MARGIN = 20;
const SLIDER_HEIGHT = 220;

export type TextAlignment = 'left' | 'center' | 'right';

export interface TextItemData {
    id: string;
    text: string;
    alignment: TextAlignment;
    scale: number;
    rotation: number;
    x: number;
    y: number;
    hasBackground: boolean;
    color: string;
    isBold?: boolean;
}

export interface StoryTextOverlayRef {
    startEditing: () => void;
    getAllTextItems: () => TextItemData[];
}

interface StoryTextOverlayProps {
    onOpenEditor?: () => void;
    onCloseEditor?: () => void;
    mediaUri?: string;
    mediaType?: 'image' | 'video';
}

// --- Individual Text Item Component ---
const StoryTextItem = ({
    item,
    onEdit
}: {
    item: TextItemData,
    onEdit: (id: string, currentScale: number, currentRotation: number, currentX: number, currentY: number, currentColor: string, isBold: boolean) => void
}) => {
    const translateX = useSharedValue(item.x);
    const translateY = useSharedValue(item.y);
    const scale = useSharedValue(item.scale);
    const rotation = useSharedValue(item.rotation);

    const savedScale = useSharedValue(item.scale);
    const savedRotation = useSharedValue(item.rotation);
    const context = useSharedValue({ x: item.x, y: item.y });

    useEffect(() => {
        scale.value = withSpring(item.scale);
        savedScale.value = item.scale;
        rotation.value = withSpring(item.rotation);
        savedRotation.value = item.rotation;
        translateX.value = withSpring(item.x);
        translateY.value = withSpring(item.y);
        context.value = { x: item.x, y: item.y };
    }, [item.scale, item.rotation, item.x, item.y]);

    const panGesture = Gesture.Pan()
        .averageTouches(true)
        .onStart(() => {
            context.value = { x: translateX.value, y: translateY.value };
        })
        .onUpdate((event) => {
            translateX.value = event.translationX + context.value.x;
            translateY.value = event.translationY + context.value.y;
        });

    const pinchGesture = Gesture.Pinch()
        .onUpdate((event) => {
            scale.value = Math.max(0.2, Math.min(savedScale.value * event.scale, 8));
        })
        .onEnd(() => {
            savedScale.value = scale.value;
        });

    const rotationGesture = Gesture.Rotation()
        .onUpdate((event) => {
            rotation.value = savedRotation.value + event.rotation;
        })
        .onEnd(() => {
            savedRotation.value = rotation.value;
        });

    const tapGesture = Gesture.Tap()
        .onEnd(() => {
            runOnJS(onEdit)(item.id, scale.value, rotation.value, translateX.value, translateY.value, item.color, item.isBold ?? true);
        });

    const gesture = Gesture.Simultaneous(panGesture, pinchGesture, rotationGesture, tapGesture);

    const outerAnimatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { rotate: `${rotation.value}rad` },
        ],
    }));

    const innerAnimatedStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: scale.value },
        ],
    }));
    
    const isWhite = item.color.toLowerCase() === '#ffffff' || item.color.toLowerCase() === '#fff';

    return (
        <GestureDetector gesture={gesture}>
            <Animated.View 
                style={[styles.textWrapper, outerAnimatedStyle, { padding: 30 }]} 
                hitSlop={{ top: 40, bottom: 40, left: 40, right: 40 }}
            >
                <Animated.View style={innerAnimatedStyle}>
                    <View style={[
                        styles.textContainer,
                        item.hasBackground && { backgroundColor: isWhite ? 'rgba(255,255,255,0.98)' : item.color }
                    ]}>
                        <Text style={[
                            styles.overlayText,
                            {
                                textAlign: item.alignment,
                                color: item.hasBackground ? (isWhite ? '#000' : '#FFF') : item.color,
                                textShadowRadius: item.hasBackground ? 0 : 8,
                                fontFamily: item.isBold ? FONTS.bold : FONTS.regular,
                                fontWeight: item.isBold ? 'bold' : 'normal',
                            }
                        ]}>
                            {item.text}
                        </Text>
                    </View>
                </Animated.View>
            </Animated.View>
        </GestureDetector>
    );
};

// --- Main Overlay Component ---
const StoryTextOverlay = forwardRef<StoryTextOverlayRef, StoryTextOverlayProps>(
    ({ onOpenEditor, onCloseEditor, mediaUri, mediaType }, ref) => {
        const [items, setItems] = useState<TextItemData[]>([]);
        const [editingItemId, setEditingItemId] = useState<string | null>(null);
        const [editorText, setEditorText] = useState('');
        const [editorAlignment, setEditorAlignment] = useState<TextAlignment>('center');
        const [editorScale, setEditorScale] = useState(1);
        const [editorRotation, setEditorRotation] = useState(0);
        const [editorX, setEditorX] = useState(0);
        const [editorY, setEditorY] = useState(0);
        const [hasBackground, setHasBackground] = useState(false);
        const [editorColor, setEditorColor] = useState('#FFFFFF');
        const [isBold, setIsBold] = useState(true);

        useImperativeHandle(ref, () => ({
            startEditing: () => {
                const newId = Math.random().toString(36).substring(7);
                setEditingItemId(newId);
                setEditorText('');
                setEditorAlignment('center');
                setEditorScale(1);
                setEditorRotation(0);
                setEditorX(0);
                setEditorY(0);
                setHasBackground(false);
                setEditorColor('#FFFFFF');
                setIsBold(true);
                onOpenEditor?.();
            },
            getAllTextItems: () => items,
        }));

        const handleEditItem = (id: string, s: number, r: number, x: number, y: number, color: string, bld: boolean) => {
            const item = items.find(i => i.id === id);
            if (item) {
                setEditingItemId(id);
                setEditorText(item.text);
                setEditorAlignment(item.alignment);
                setEditorScale(s);
                setEditorRotation(r);
                setEditorX(x);
                setEditorY(y);
                setHasBackground(item.hasBackground);
                setEditorColor(color || '#FFFFFF');
                setIsBold(bld ?? true);
                onOpenEditor?.();
            }
        };

        const handleDone = () => {
            if (editingItemId) {
                if (editorText.trim() === '') {
                    setItems(prev => prev.filter(i => i.id !== editingItemId));
                } else {
                    setItems(prev => {
                        const exists = prev.find(i => i.id === editingItemId);
                        if (exists) {
                            return prev.map(i => i.id === editingItemId ? {
                                ...i,
                                text: editorText,
                                alignment: editorAlignment,
                                scale: editorScale,
                                rotation: editorRotation,
                                x: editorX,
                                y: editorY,
                                hasBackground,
                                color: editorColor,
                                isBold: isBold
                            } : i);
                        } else {
                            return [...prev, {
                                id: editingItemId,
                                text: editorText,
                                alignment: editorAlignment,
                                scale: editorScale,
                                rotation: editorRotation,
                                x: editorX,
                                y: editorY,
                                hasBackground,
                                color: editorColor,
                                isBold: isBold
                            }];
                        }
                    });
                }
            }
            setEditingItemId(null);
            onCloseEditor?.();
            Keyboard.dismiss();
        };

        const toggleBackground = () => setHasBackground(!hasBackground);

        const updateScaleJS = (y: number) => {
            const p = Math.max(0, Math.min(1 - (y / SLIDER_HEIGHT), 1));
            setEditorScale(0.5 + p * 4.5);
        };

        const sliderGesture = Gesture.Pan()
            .activateAfterLongPress(0)
            .onStart((e) => {
                runOnJS(updateScaleJS)(e.y);
            })
            .onUpdate((e) => {
                runOnJS(updateScaleJS)(e.y);
            });

        // Helper for dynamic alignment-based self-alignment
        const getSelfAlignment = (align: TextAlignment) => {
            switch (align) {
                case 'left': return 'flex-start';
                case 'right': return 'flex-end';
                default: return 'center';
            }
        };

        useEffect(() => {
            const onBackPress = () => {
                if (editingItemId !== null) {
                    handleDone();
                    return true; // Prevent event from bubbling to MediaPreview's discard handler
                }
                return false; // Let it fall through
            };
            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => subscription.remove();
        }, [editingItemId, editorText, editorAlignment, editorScale, editorRotation, editorX, editorY, hasBackground, editorColor, isBold]);

        return (
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                {items.map(item => (
                    <StoryTextItem key={item.id} item={item} onEdit={handleEditItem} />
                ))}

                {editingItemId !== null && (
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={styles.editorOverlay}
                    >
                        {/* Touch capturing backdrop */}
                        <Pressable style={StyleSheet.absoluteFill} onPress={handleDone} />

                        <View style={styles.topBarContainer} pointerEvents="box-none">
                            {mediaUri && mediaType && (
                                <View style={styles.colorPickerWrapper}>
                                    <MediaColorPicker 
                                        mediaUri={mediaUri}
                                        mediaType={mediaType}
                                        selectedColor={editorColor}
                                        onColorSelect={setEditorColor}
                                    />
                                </View>
                            )}
                            <Pressable style={styles.doneButton} onPress={handleDone}>
                                <Text style={styles.doneButtonText}>Done</Text>
                            </Pressable>
                        </View>

                        <View style={styles.rightFixedSidebar} pointerEvents="box-none">
                            <View style={styles.alignmentVerticalGroup}>
                                <TouchableOpacity onPress={() => setEditorAlignment('left')} style={styles.sideAlignButton}>
                                    <MaterialIcons name="format-align-left" size={26} color={editorAlignment === 'left' ? '#FFF' : 'rgba(255,255,255,0.4)'} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setEditorAlignment('center')} style={styles.sideAlignButton}>
                                    <MaterialIcons name="format-align-center" size={26} color={editorAlignment === 'center' ? '#FFF' : 'rgba(255,255,255,0.4)'} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setEditorAlignment('right')} style={styles.sideAlignButton}>
                                    <MaterialIcons name="format-align-right" size={26} color={editorAlignment === 'right' ? '#FFF' : 'rgba(255,255,255,0.4)'} />
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity onPress={toggleBackground} style={styles.toolButton}>
                                <View style={[styles.backgroundIconStyle, hasBackground && styles.backgroundIconActive]}>
                                    <Text style={[styles.backgroundIconText, hasBackground && { color: '#000' }]}>A</Text>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => setIsBold(!isBold)} style={styles.toolButton}>
                                <View style={[styles.backgroundIconStyle, isBold && styles.backgroundIconActive]}>
                                    <Text style={[styles.backgroundIconText, isBold && { color: '#000' }, { fontWeight: 'bold' }]}>B</Text>
                                </View>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.leftFixedSidebar} pointerEvents="box-none">
                            <GestureDetector gesture={sliderGesture}>
                                <View style={styles.sliderContainer}>
                                    <View style={styles.verticalSliderTrack}>
                                        <View style={[
                                            styles.verticalSliderFill,
                                            { height: `${((editorScale - 0.5) / 4.5) * 100}%` }
                                        ]} />
                                        <View style={[
                                            styles.verticalSliderThumb,
                                            { bottom: `${((editorScale - 0.5) / 4.5) * 100}%` }
                                        ]} />
                                    </View>
                                    <MaterialIcons name="text-fields" size={20} color="#FFF" style={styles.sliderIcon} />
                                </View>
                            </GestureDetector>
                        </View>

                        <View 
                            style={[
                                styles.inputContainer, 
                                { alignItems: editorAlignment === 'left' ? 'flex-start' : editorAlignment === 'right' ? 'flex-end' : 'center' }
                            ]} 
                            pointerEvents="box-none"
                        >
                            <View style={{
                                backgroundColor: hasBackground ? (editorColor.toLowerCase() === '#ffffff' || editorColor.toLowerCase() === '#fff' ? 'rgba(255,255,255,0.98)' : editorColor) : 'transparent',
                                borderRadius: hasBackground ? 8 : 0,
                                paddingHorizontal: hasBackground ? 12 : 0,
                                paddingVertical: hasBackground ? 4 : 0,
                            }}>
                                <TextInput
                                    autoFocus
                                    multiline
                                    scrollEnabled={false}
                                    textAlign="center"
                                    textAlignVertical="center"
                                    style={[
                                        styles.textInput,
                                        {
                                            textAlign: editorAlignment,
                                            fontSize: Math.round(32 * editorScale),
                                            lineHeight: Math.round(32 * editorScale * 1.3),
                                            color: hasBackground ? (editorColor.toLowerCase() === '#ffffff' || editorColor.toLowerCase() === '#fff' ? '#000' : '#FFF') : editorColor,
                                            textShadowRadius: hasBackground ? 0 : 10,
                                            fontFamily: isBold ? FONTS.bold : FONTS.regular,
                                            fontWeight: isBold ? 'bold' : 'normal',
                                            includeFontPadding: false,
                                            paddingVertical: 0,
                                        }
                                    ]}
                                    value={editorText}
                                    onChangeText={setEditorText}
                                    placeholder="Type something..."
                                    placeholderTextColor="rgba(255,255,255,0.3)"
                                    selectionColor="#FFF"
                                />
                            </View>
                        </View>

                    </KeyboardAvoidingView>
                )}
            </View>
        );
    }
);

const styles = StyleSheet.create({
    editorOverlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 9999,
        backgroundColor: 'rgba(0,0,0,0.85)',
    },
    editorBackdrop: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    topBarContainer: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 45 : 25,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        zIndex: 1000,
    },
    toolButton: {
        padding: 10,
    },
    backgroundIconStyle: {
        width: 32,
        height: 32,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: '#FFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    backgroundIconActive: {
        backgroundColor: '#FFF',
    },
    backgroundIconText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '900',
    },
    rightFixedSidebar: {
        position: 'absolute',
        right: 10,
        top: 0,
        bottom: 0,
        width: 50,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        gap: 15,
    },
    leftFixedSidebar: {
        position: 'absolute',
        left: 10,
        top: 0,
        bottom: 0,
        width: 50,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        gap: 25,
    },
    alignmentVerticalGroup: {
        gap: 15,
        alignItems: 'center',
    },
    sideAlignButton: {
        padding: 8,
    },
    sliderContainer: {
        height: 240,
        alignItems: 'center',
        justifyContent: 'flex-end',
    },
    verticalSliderTrack: {
        width: 6,
        height: 200,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 3,
        position: 'relative',
    },
    verticalSliderFill: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FFF',
        borderRadius: 3,
    },
    verticalSliderThumb: {
        position: 'absolute',
        left: -8,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#FFF',
        borderWidth: 2,
        borderColor: '#000',
        marginBottom: -11,
    },
    sliderIcon: {
        marginTop: 15,
    },
    inputContainer: {
        flex: 1,
        paddingHorizontal: HORIZONTAL_MARGIN,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textInput: {
        color: '#FFF',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 10,
        maxHeight: SCREEN_HEIGHT * 0.6,
        paddingVertical: 10,
        minWidth: 50, // Avoid collapsing entirely
    },
    textInputBackground: {
        backgroundColor: '#FFF',
        color: '#000',
        borderRadius: 8,
        paddingHorizontal: 12,
        textShadowRadius: 0,
    },
    doneButton: {
        paddingVertical: 8,
        paddingHorizontal: 18,
        borderRadius: 25,
        backgroundColor: 'rgba(255,255,255,0.25)',
    },
    doneButtonText: {
        color: '#FFF',
        fontSize: 17,
        fontFamily: FONTS.bold,
    },
    textWrapper: {
        position: 'absolute',
        top: '40%',
        alignSelf: 'center',
        justifyContent: 'center',
        alignItems: 'center',
        maxWidth: SCREEN_WIDTH - 20,
    },
    textContainer: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    textBackground: {
        backgroundColor: 'rgba(255,255,255,0.98)',
    },
    overlayText: {
        color: '#FFF',
        fontSize: 32,
        fontFamily: FONTS.bold,
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 8,
    },
    colorPickerWrapper: {
        flex: 1,
        marginRight: 15,
        alignItems: 'center',
    },
});

export default StoryTextOverlay;
