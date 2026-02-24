import React, { memo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import FastUserItem from '@/features/partners/components/FastUserItem';
import { RowData } from '@/lib/gridUtils';
import { SharedValue } from 'react-native-reanimated'; // <--- IMPORT SHAREDVALUE HERE

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CONTAINER_PADDING = 20;
const CONTENT_WIDTH = SCREEN_WIDTH - CONTAINER_PADDING * 2;
const SPACING = 20;
const ROW_MARGIN_BOTTOM = 24;

interface FastUserRowProps {
    item: RowData;
    selectionMap: Record<string, SharedValue<boolean>>; // <--- USE NAMED TYPE
    onToggle: (id: string, newState: boolean) => void;
}

const FastUserRow = memo(({ item, selectionMap, onToggle }: FastUserRowProps) => {

    const renderSingle = () => {
        const user = item.users[0];
        const size = CONTENT_WIDTH * 0.75;
        // Pass the specific shared value for this user
        return <FastUserItem user={user} width={size} height={size} isSelected={selectionMap[user.id]} onToggle={onToggle} />;
    };

    const renderDouble = () => {
        const [u1, u2] = item.users;
        const itemW = (CONTENT_WIDTH - SPACING) / 2;
        return (
            <>
                <FastUserItem user={u1} width={itemW} height={itemW * 1.15} isSelected={selectionMap[u1.id]} onToggle={onToggle} style={{ marginRight: SPACING / 2 }} />
                <FastUserItem user={u2} width={itemW} height={itemW * 0.95} isSelected={selectionMap[u2.id]} onToggle={onToggle} style={{ marginLeft: SPACING / 2 }} />
            </>
        );
    };

    const renderTriple = () => {
        const [u1, u2, u3] = item.users;
        const s = (CONTENT_WIDTH - (SPACING * 2)) / 3;
        return (
            <>
                <FastUserItem user={u1} width={s} height={s} isSelected={selectionMap[u1.id]} onToggle={onToggle} style={{ marginRight: SPACING / 2 }} />
                <FastUserItem user={u2} width={s} height={s * 1.2} isSelected={selectionMap[u2.id]} onToggle={onToggle} style={{ marginHorizontal: SPACING / 2 }} />
                <FastUserItem user={u3} width={s} height={s} isSelected={selectionMap[u3.id]} onToggle={onToggle} style={{ marginLeft: SPACING / 2 }} />
            </>
        );
    };

    return (
        <View style={[styles.row, { height: item.height, marginBottom: ROW_MARGIN_BOTTOM }]}>
            {item.type === 'single' && renderSingle()}
            {item.type === 'double' && renderDouble()}
            {item.type === 'triple' && renderTriple()}
        </View>
    );
}, (prev, next) => prev.item.id === next.item.id);

const styles = StyleSheet.create({
    row: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', width: '100%' },
});

export default FastUserRow;
