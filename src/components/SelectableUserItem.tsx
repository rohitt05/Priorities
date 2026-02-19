import React, { useEffect, useState, memo } from 'react';
import { DrawnArrowItem } from '@/components/DrawnArrowItem';
import { useSelection } from '@/context/SelectionContext';
import * as Haptics from 'expo-haptics';
import { User } from '@/utils/gridUtils';

interface SelectableUserItemProps {
    user: User;
    width: number;
    height: number;
    style?: any;
}

// This wrapper listens to selection updates for ONE specific user
export const SelectableUserItem = memo(({ user, width, height, style }: SelectableUserItemProps) => {
    const { toggle, subscribe, isSelected } = useSelection();
    // Local state only for this single item
    const [selected, setSelected] = useState(() => isSelected(user.id));

    useEffect(() => {
        return subscribe(user.id, (newState) => {
            setSelected(newState);
        });
    }, [user.id, subscribe]);

    const handlePress = () => {
        toggle(user.id);
        Haptics.selectionAsync();
    };

    return (
        <DrawnArrowItem
            user={user}
            isSelected={selected}
            onPress={handlePress}
            width={width}
            height={height}
            style={style}
        />
    );
});
