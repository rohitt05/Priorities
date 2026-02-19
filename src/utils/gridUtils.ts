import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CONTAINER_PADDING = 20;
const CONTENT_WIDTH = SCREEN_WIDTH - CONTAINER_PADDING * 2;
const SPACING = 20;
const ROW_MARGIN_BOTTOM = 24;
const BG_OPACITY = 0.15;

export interface User {
    id: string; uniqueUserId: string; name: string;
    profilePicture: string; birthday: string; dominantColor: string;
}

export interface RowData {
    id: string;
    type: 'single' | 'double' | 'triple';
    users: User[];
    height: number;
}

const hexToRgba = (hex: string, alpha: number) => {
    const fullHex = hex.length === 4 ? '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3] : hex;
    if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(fullHex)) {
        const r = parseInt(fullHex.slice(1, 3), 16);
        const g = parseInt(fullHex.slice(3, 5), 16);
        const b = parseInt(fullHex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return `rgba(255, 255, 255, ${alpha})`;
};

export const calculateGridData = (userList: User[]) => {
    const _rows: RowData[] = [];
    const _colorInput: number[] = [];
    const _colorOutput: string[] = [];

    let i = 0;
    let currentY = 0;

    // Start white buffer
    _colorInput.push(-1000);
    _colorOutput.push('rgba(255,255,255,1)');

    while (i < userList.length) {
        const patternStep = i % 8;
        const uniqueId = `row-${i}`;
        let rowHeight = 0;
        let rowUsers: User[] = [];
        let rowType: RowData['type'] = 'single';

        if ((patternStep === 0 || patternStep === 5) && userList[i]) {
            rowType = 'single';
            rowUsers = [userList[i]];
            rowHeight = CONTENT_WIDTH * 0.75;
            i += 1;
        }
        else if ((patternStep === 1 || patternStep === 4 || patternStep === 6) && userList[i] && userList[i + 1]) {
            rowType = 'double';
            rowUsers = [userList[i], userList[i + 1]];
            rowHeight = ((CONTENT_WIDTH - SPACING) / 2) * 1.15;
            i += 2;
        }
        else if (userList[i] && userList[i + 1] && userList[i + 2]) {
            rowType = 'triple';
            rowUsers = [userList[i], userList[i + 1], userList[i + 2]];
            rowHeight = ((CONTENT_WIDTH - (SPACING * 2)) / 3) * 1.2;
            i += 3;
        }
        else if (userList[i]) {
            rowType = 'single';
            rowUsers = [userList[i]];
            rowHeight = CONTENT_WIDTH * 0.5;
            i += 1;
        } else { break; }

        _rows.push({ id: uniqueId, type: rowType, users: rowUsers, height: rowHeight });

        // Interpolation point
        _colorInput.push(currentY);
        _colorOutput.push(hexToRgba(rowUsers[0].dominantColor, BG_OPACITY));

        currentY += rowHeight + ROW_MARGIN_BOTTOM;
    }

    // End buffer
    _colorInput.push(currentY + 1000);
    _colorOutput.push(_colorOutput[_colorOutput.length - 1]);

    return { rows: _rows, colorInputRange: _colorInput, colorOutputRange: _colorOutput };
};
