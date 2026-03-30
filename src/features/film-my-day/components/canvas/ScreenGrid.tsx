// src/features/film-my-day/components/canvas/ScreenGrid.tsx

import React from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { rgba } from './canvasUtils';

const { width: SW, height: SH } = Dimensions.get('window');
const CELL = 22;

const ScreenGrid = React.memo(() => {
    const lc = rgba('#433D35', 0.13);
    const cols = Math.ceil(SW / CELL) + 1;
    const rows = Math.ceil(SH / CELL) + 1;
    const lines: React.ReactNode[] = [];
    for (let r = 0; r <= rows; r++)
        lines.push(<Line key={`h${r}`} x1={0} y1={r * CELL} x2={SW} y2={r * CELL} stroke={lc} strokeWidth={1.2} />);
    for (let c = 0; c <= cols; c++)
        lines.push(<Line key={`v${c}`} x1={c * CELL} y1={0} x2={c * CELL} y2={SH} stroke={lc} strokeWidth={1.2} />);
    return (
        <Svg width={SW} height={SH} style={StyleSheet.absoluteFill} pointerEvents="none">
            {lines}
        </Svg>
    );
});
ScreenGrid.displayName = 'ScreenGrid';

export default ScreenGrid;