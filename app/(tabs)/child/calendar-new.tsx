import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '@/lib/supabase';

interface CalendarEvent {
  id: string;
  start_time: string;
  activity_name: string;
  child_id: string;
}

interface CustodySchedule {
  id: string;
  days_of_week: number[];
  parent_name: string;
  color: string;
}

interface CalendarProps {
  childName: string;
  childId: string;
  onConfirm: (selectedDates: Date[]) => void;
  onCancel: () => void;
}

export default function Calendar({ childName, childId, onConfirm, onCancel }: CalendarProps) {
  const colorScheme = useColorScheme();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [custodySchedules, setCustodySchedules] = useState<CustodySchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [addEventModalVisible, setAddEventModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [newEventName, setNewEventName] = useState('');

  useEffect(() => {
    loadData();
  }, [childId, currentMonth]);

  const loadData = async () => {
    await Promise.all([fetchEvents(), fetchCustodySchedules()]);
    setLoading(false);
  };

  const fetchEvents = async () => {
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);

      const { data, error } = await supabase
        .from('calendar_events')
        .select('id, start_time, activity_name, child_id')
        .eq('child_id', childId)
        .gte('start_time', firstDay.toISOString())
        .lte('start_time', lastDay.toISOString());

      if (error) {
        console.error('Error fetching events:', error);
        return;
      }

      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const fetchCustodySchedules = async () => {
    try {
      const { data, error } = await supabase
        .from('custody_schedules')
        .select('id, days_of_week, parent_name, color')
        .eq('child_id', childId);

      if (error) {
        console.error('Error fetching custody schedules:', error);
        return;
      }

      setCustodySchedules(data || []);
    } catch (error) {
      console.error('Error fetching custody schedules:', error);
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: Array<{ date: Date; isCurrentMonth: boolean }> = [];

    // Add previous month's days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    const prevMonthDays = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1;
    for (let i = prevMonthDays; i > 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i + 1),
        isCurrentMonth: false
      });
    }

    // Add current month's days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true
      });
    }

    // Add next month's days
    const remainingDays = 42 - days.length; // 6 rows * 7 days
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false
      });
    }

    return days;
  };

  const getEventsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return events.filter(event => {
      const eventDate = new Date(event.start_time).toISOString().split('T')[0];
      return eventDate === dateStr;
    });
  };

  const getCustodyForDate = (date: Date) => {
    const dayOfWeek = (date.getDay() + 6) % 7; // Convert Sunday=0 to Monday=0
    return custodySchedules.find(schedule => 
      schedule.days_of_week.includes(dayOfWeek)
    );
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setCurrentMonth(newMonth);
  };

  const handleAddEvent = async () => {
    if (!selectedDate || !newEventName.trim()) {
      Alert.alert('Error', 'Please enter an event name');
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user?.id) return;

      const { error } = await supabase
        .from('calendar_events')
        .insert({
          child_id: childId,
          user_id: userData.user.id,
          start_time: new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 9, 0).toISOString(),
          end_time: new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 17, 0).toISOString(),
          event_type: 'scheduled',
          activity_name: newEventName,
          location: '',
          notes: ''
        });

      if (error) {
        console.error('Error adding event:', error);
        Alert.alert('Error', 'Failed to add event');
        return;
      }

      setAddEventModalVisible(false);
      setNewEventName('');
      setSelectedDate(null);
      await fetchEvents();
    } catch (error) {
      console.error('Error adding event:', error);
      Alert.alert('Error', 'Failed to add event');
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const days = getDaysInMonth(currentMonth);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: Colors[colorScheme ?? 'light'].text }]}>
            Loading calendar...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: Colors[colorScheme ?? 'light'].border }]}>
        <TouchableOpacity onPress={onCancel} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: Colors[colorScheme ?? 'light'].tint }]}>‹ Back</Text>
        </TouchableOpacity>
        <View style={styles.monthControls}>
          <TouchableOpacity onPress={() => navigateMonth('prev')} style={styles.navButton}>
            <Text style={[styles.navButtonText, { color: Colors[colorScheme ?? 'light'].tint }]}>‹</Text>
          </TouchableOpacity>
          <Text style={[styles.monthText, { color: Colors[colorScheme ?? 'light'].text }]}>
            {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </Text>
          <TouchableOpacity onPress={() => navigateMonth('next')} style={styles.navButton}>
            <Text style={[styles.navButtonText, { color: Colors[colorScheme ?? 'light'].tint }]}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Calendar Grid */}
      <View style={styles.calendarWrapper}>
        {/* Day Names */}
        <View style={[styles.dayNamesRow, { borderBottomColor: Colors[colorScheme ?? 'light'].border }]}>
          {dayNames.map(day => (
            <View key={day} style={styles.dayNameCell}>
              <Text style={[styles.dayNameText, { color: Colors[colorScheme ?? 'light'].text }]}>{day}</Text>
            </View>
          ))}
        </View>

        {/* Calendar Days */}
        <ScrollView style={styles.calendarScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.calendarGrid}>
            {Array.from({ length: 6 }).map((_, weekIndex) => (
              <View key={weekIndex} style={styles.weekRow}>
                {days.slice(weekIndex * 7, (weekIndex + 1) * 7).map((dayObj, dayIndex) => {
                  const dayEvents = getEventsForDate(dayObj.date);
                  const custody = getCustodyForDate(dayObj.date);
                  const isToday = dayObj.date.toDateString() === new Date().toDateString();

                  return (
                    <TouchableOpacity
                      key={`${weekIndex}-${dayIndex}`}
                      style={[
                        styles.dayCell,
                        { borderColor: Colors[colorScheme ?? 'light'].border },
                        !dayObj.isCurrentMonth && styles.otherMonthDay
                      ]}
                      onPress={() => {
                        setSelectedDate(dayObj.date);
                        setAddEventModalVisible(true);
                      }}
                    >
                      {/* Custody Bar */}
                      {custody && (
                        <View style={[styles.custodyBar, { backgroundColor: custody.color }]} />
                      )}

                      {/* Date Number */}
                      <View style={[
                        styles.dateNumberContainer,
                        isToday && { backgroundColor: Colors[colorScheme ?? 'light'].tint }
                      ]}>
                        <Text style={[
                          styles.dateNumber,
                          { color: dayObj.isCurrentMonth ? Colors[colorScheme ?? 'light'].text : Colors[colorScheme ?? 'light'].textLight },
                          isToday && styles.todayText
                        ]}>
                          {dayObj.date.getDate()}
                        </Text>
                      </View>

                      {/* Events */}
                      <View style={styles.eventsContainer}>
                        {dayEvents.slice(0, 3).map((event, idx) => (
                          <View
                            key={event.id}
                            style={[styles.eventDot, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]}
                          >
                            <Text style={styles.eventText} numberOfLines={1}>
                              {event.activity_name}
                            </Text>
                          </View>
                        ))}
                        {dayEvents.length > 3 && (
                          <Text style={[styles.moreEvents, { color: Colors[colorScheme ?? 'light'].textLight }]}>
                            +{dayEvents.length - 3} more
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Add Event Modal */}
      <Modal
        visible={addEventModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAddEventModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: Colors[colorScheme ?? 'light'].cardBackground }]}>
            <Text style={[styles.modalTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
              Add Event
            </Text>
            <Text style={[styles.modalDate, { color: Colors[colorScheme ?? 'light'].textLight }]}>
              {selectedDate?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </Text>
            <TextInput
              style={[styles.modalInput, {
                backgroundColor: Colors[colorScheme ?? 'light'].inputBackground,
                color: Colors[colorScheme ?? 'light'].text,
                borderColor: Colors[colorScheme ?? 'light'].border
              }]}
              value={newEventName}
              onChangeText={setNewEventName}
              placeholder="Event name"
              placeholderTextColor={Colors[colorScheme ?? 'light'].textLight}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { borderColor: Colors[colorScheme ?? 'light'].border }]}
                onPress={() => {
                  setAddEventModalVisible(false);
                  setNewEventName('');
                  setSelectedDate(null);
                }}
              >
                <Text style={[styles.modalButtonText, { color: Colors[colorScheme ?? 'light'].text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.addButton, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]}
                onPress={handleAddEvent}
              >
                <Text style={[styles.modalButtonText, styles.addButtonText]}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  monthControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  navButton: {
    padding: 8,
  },
  navButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  monthText: {
    fontSize: 18,
    fontWeight: '600',
    minWidth: 180,
    textAlign: 'center',
  },
  calendarWrapper: {
    flex: 1,
    paddingHorizontal: 8,
  },
  dayNamesRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingVertical: 8,
  },
  dayNameCell: {
    flex: 1,
    alignItems: 'center',
  },
  dayNameText: {
    fontSize: 12,
    fontWeight: '600',
  },
  calendarScroll: {
    flex: 1,
  },
  calendarGrid: {
    flex: 1,
  },
  weekRow: {
    flexDirection: 'row',
    height: 100,
  },
  dayCell: {
    flex: 1,
    borderWidth: 0.5,
    padding: 4,
    position: 'relative',
  },
  otherMonthDay: {
    opacity: 0.3,
  },
  custodyBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  dateNumberContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  dateNumber: {
    fontSize: 14,
    fontWeight: '600',
  },
  todayText: {
    color: '#fff',
  },
  eventsContainer: {
    flex: 1,
    gap: 2,
  },
  eventDot: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
  },
  eventText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '500',
  },
  moreEvents: {
    fontSize: 9,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    borderRadius: 12,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  modalDate: {
    fontSize: 14,
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  addButton: {
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  addButtonText: {
    color: '#fff',
  },
});
