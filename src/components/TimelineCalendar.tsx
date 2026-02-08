import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { CalendarList, DateData } from 'react-native-calendars';

type Props = {
    availableDates: string[];
    selectedDate: string;
    onSelectDate: (dateKey: string) => void;
};

export default function TimelineCalendar({
    availableDates,
    selectedDate,
    onSelectDate,
}: Props) {
    const markedDates = useMemo(() => {
        const marks: Record<string, any> = {};
        availableDates.forEach(d => {
            marks[d] = { marked: true, dotColor: '#111' };
        });
        marks[selectedDate] = {
            ...(marks[selectedDate] ?? {}),
            selected: true,
            selectedColor: '#111',
            selectedTextColor: '#fff',
        };
        return marks;
    }, [availableDates, selectedDate]);

    return (
        <View style={styles.wrap}>
            <CalendarList
                horizontal
                pagingEnabled
                pastScrollRange={24}
                futureScrollRange={0}
                showScrollIndicator={false}
                onDayPress={(day: DateData) => onSelectDate(day.dateString)}
                markedDates={markedDates}
                theme={{
                    backgroundColor: 'transparent',
                    calendarBackground: 'transparent',
                    textSectionTitleColor: '#111',
                    dayTextColor: '#111',
                    todayTextColor: '#111',
                    monthTextColor: '#111',
                    textDisabledColor: 'rgba(0,0,0,0.25)',
                    arrowColor: '#111',
                }}
                style={styles.calendar}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { paddingHorizontal: 14, paddingTop: 8 },
    calendar: { borderRadius: 16 },
});
