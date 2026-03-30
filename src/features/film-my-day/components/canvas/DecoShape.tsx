// src/features/film-my-day/components/canvas/DecoShape.tsx

import React from 'react';
import { View } from 'react-native';
import { DecoItem } from './canvasUtils';

interface Props {
    item: DecoItem;
}

const DecoShape = React.memo(({ item }: Props) => {
    const { x, y, w, h, color, radius, circle } = item;
    const r = circle ? w / 2 : radius;

    return (
        <View
            pointerEvents="none"
            style={{
                position: 'absolute',
                left: x - w / 2,
                top: y - h / 2,
                width: w,
                height: h,
                borderRadius: r,
                backgroundColor: color,
                opacity: 0.52,
                borderWidth: 1.5,
                borderColor: 'rgba(255,255,255,0.32)',
            }}
        />
    );
});
DecoShape.displayName = 'DecoShape';

export default DecoShape;