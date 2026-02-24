import React, { memo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { SelectableUserItem } from '@/features/partners/components/SelectableUserItem'; // Use new wrapper
import { RowData } from '@/lib/gridUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CONTAINER_PADDING = 20;
const CONTENT_WIDTH = SCREEN_WIDTH - CONTAINER_PADDING * 2;
const SPACING = 20;
const ROW_MARGIN_BOTTOM = 24;

interface UserRowProps {
    item: RowData;
}

const UserRow = memo(({ item }: UserRowProps) => {

    const renderSingle = () => {
        const user = item.users[0];
        const size = CONTENT_WIDTH * 0.75;
        return <SelectableUserItem user={user} width={size} height={size} />;
    };

    const renderDouble = () => {
        const [u1, u2] = item.users;
        const itemW = (CONTENT_WIDTH - SPACING) / 2;
        return (
            <>
                <SelectableUserItem user={u1} width={itemW} height={itemW * 1.15} style={{ marginRight: SPACING / 2 }} />
                <SelectableUserItem user={u2} width={itemW} height={itemW * 0.95} style={{ marginLeft: SPACING / 2 }} />
            </>
        );
    };

    const renderTriple = () => {
        const [u1, u2, u3] = item.users;
        const s = (CONTENT_WIDTH - (SPACING * 2)) / 3;
        return (
            <>
                <SelectableUserItem user={u1} width={s} height={s} style={{ marginRight: SPACING / 2 }} />
                <SelectableUserItem user={u2} width={s} height={s * 1.2} style={{ marginHorizontal: SPACING / 2 }} />
                <SelectableUserItem user={u3} width={s} height={s} style={{ marginLeft: SPACING / 2 }} />
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
}, (prev, next) => prev.item.id === next.item.id); // Only re-render if row ID changes (basically never)

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%'
    },
});

export default UserRow;
