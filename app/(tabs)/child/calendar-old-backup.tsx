import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '@/lib/supabase';

interface CalendarEvent {
  id: string;
  start_time: string;
  end_time: string;
  event_type: string;
  notes: string;
  activity_name: string;
  child_id: string;
}

interface CustodySchedule {
  id: string;
  days_of_week: number[];
  parent_name: string;
  parent_type: string;
  color: string;
  child_id: string;
}

interface CalendarProps {
  childName: string;
  childId: string;
  onConfirm: (selectedDates: Date[]) => void;
  onCancel: () => void;
}

export default function Calendar({ childName, childId, onConfirm, onCancel }: CalendarProps) {
  const colorScheme = useColorScheme();
  const [selectedDates, setSelectedDates] = useState<Map<string, { date: Date; activities: string[] }>>(new Map());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [recurringEvents, setRecurringEvents] = useState<RecurringEvent[]>([]);
  const [selectedActivity, setSelectedActivity] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [modalActivity, setModalActivity] = useState<{date: Date, activities: string[]} | null>(null);
  const [editingActivity, setEditingActivity] = useState(false);
  const [editActivityValue, setEditActivityValue] = useState('');
  const [editingActivityIndex, setEditingActivityIndex] = useState<number | null>(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createModalDate, setCreateModalDate] = useState<Date | null>(null);
  const [createActivityValue, setCreateActivityValue] = useState('');
  const [recurringModalVisible, setRecurringModalVisible] = useState(false);
  const [fabMenuVisible, setFabMenuVisible] = useState(false);
  const [parents, setParents] = useState<Array<{
    user_id: string;
    email: string;
    display_name?: string;
    first_name?: string;
    last_name?: string;
  }>>([]);
  const [custodySchedule, setCustodySchedule] = useState<{[key: string]: {
    days: number[];
    name: string;
    color: string;
    userId: string;
  }}>({});

  useEffect(() => {
    fetchParents();
    fetchExistingEvents();
    fetchRecurringEvents();
  }, [childId]);

  useEffect(() => {
    fetchExistingEvents();
  }, [currentMonth]);

  useEffect(() => {
    // Re-initialize custody schedule when parents are loaded
    if (parents.length > 0) {
      fetchRecurringEvents();
    }
  }, [parents]);

  const fetchParents = async () => {
    try {
      // Fetch all user_children links for this child
      const { data: userChildrenData, error: userChildrenError } = await supabase
        .from('user_children')
        .select('user_id')
        .eq('child_id', childId);

      if (userChildrenError) {
        console.error('Error fetching user_children:', userChildrenError);
        return;
      }

      if (!userChildrenData || userChildrenData.length === 0) {
        setParents([]);
        return;
      }

      // Get the user IDs
      const userIds = userChildrenData.map(uc => uc.user_id);

      // Fetch user profiles for those user IDs
      const { data: profilesData, error: profilesError} = await supabase
        .from('user_profiles')
        .select('user_id, email, display_name, first_name, last_name')
        .in('user_id', userIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
      } else {
        setParents(profilesData || []);
      }
    } catch (error) {
      console.error('Error fetching parents:', error);
    }
  };

  const fetchRecurringEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('custody_schedules')
        .select('*')
        .eq('child_id', childId);

      if (error) {
        console.error('Error fetching custody schedules:', error);
        return;
      }

      setRecurringEvents(data || []);
      
      // Initialize custody schedule from parents and existing data
      // Wait for parents to be loaded if they're not yet
      if (parents.length === 0) {
        // Will be initialized when parents are loaded
        return;
      }
      
      const newCustodySchedule: {[key: string]: {
        days: number[];
        name: string;
        color: string;
        userId: string;
      }} = {};
      
      // Create a schedule entry for each parent with colors
      const colors = ['#ea4335', '#4285f4', '#34a853', '#fbbc04', '#ff6d00', '#46bdc6'];
      parents.forEach((parent, index) => {
        const parentKey = parent.user_id;
        newCustodySchedule[parentKey] = {
          days: [],
          name: parent.display_name || parent.first_name || parent.email,
          color: colors[index % colors.length],
          userId: parent.user_id
        };
      });
      
      // Update with existing schedule data
      if (data) {
        data.forEach(schedule => {
          const parentKey = schedule.parent_type; // This is actually the user_id in new structure
          if (newCustodySchedule[parentKey]) {
            newCustodySchedule[parentKey].days = schedule.days_of_week || [];
          }
        });
      }
      
      setCustodySchedule(newCustodySchedule);
    } catch (error) {
      console.error('Error fetching custody schedules:', error);
    }
  };

  const fetchExistingEvents = async () => {
    try {
      setLoading(true);
      
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      
      firstDay.setHours(0, 0, 0, 0);
      lastDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('child_id', childId)
        .gte('start_time', firstDay.toISOString())
        .lte('start_time', lastDay.toISOString());

      if (error) {
        console.error('Error fetching calendar events:', error);
        return;
      }

      setEvents(data);
      
      const newSelectedDates = new Map<string, { date: Date; activities: string[] }>();
      data.forEach(event => {
        const eventDate = new Date(event.start_time);
        const dateKey = eventDate.toISOString().split('T')[0];
        const dateValue = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
        
        if (newSelectedDates.has(dateKey)) {
          // Add to existing activities array
          const existing = newSelectedDates.get(dateKey)!;
          existing.activities.push(event.activity_name || '');
        } else {
          // Create new entry
          newSelectedDates.set(dateKey, {
            date: dateValue,
            activities: [event.activity_name || '']
          });
        }
      });

      setSelectedDates(newSelectedDates);
    } catch (error) {
      console.error('Error fetching calendar events:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    
    // Adjust for Monday start (0 = Sunday, 1 = Monday, etc.)
    // Convert Sunday (0) to 6, Monday (1) to 0, etc.
    const startingDayOfWeek = (firstDay.getDay() + 6) % 7;

    const weeks = [];
    let currentDate = new Date(firstDay);
    
    // Go back to the Monday of the week containing the first day
    currentDate.setDate(currentDate.getDate() - startingDayOfWeek);
    
    // Generate exactly 6 weeks (42 days)
    for (let weekIndex = 0; weekIndex < 6; weekIndex++) {
      const currentWeek = [];
      
      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const dateForCell = new Date(currentDate);
        const isCurrentMonth = dateForCell.getMonth() === month;
        
        currentWeek.push({ 
          date: dateForCell, 
          isCurrentMonth: isCurrentMonth 
        });
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      weeks.push(currentWeek);
    }
    
    return weeks;
  };

  const getWeekNumber = (date: Date) => {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  };

  const getRecurringEventForDate = (date: Date) => {
    const dayOfWeek = (date.getDay() + 6) % 7; // Convert to Monday = 0
    return recurringEvents.find(event => event.days_of_week.includes(dayOfWeek));
  };

  const getCustodyBarStyle = (date: Date, recurringEvent: RecurringEvent | undefined) => {
    if (!recurringEvent) return null;

    const dayOfWeek = (date.getDay() + 6) % 7;
    const sortedDays = [...recurringEvent.days_of_week].sort();
    const currentDayIndex = sortedDays.indexOf(dayOfWeek);
    
    if (currentDayIndex === -1) return null;

    // Check if this day is part of a consecutive sequence
    const isFirstInSequence = currentDayIndex === 0 || sortedDays[currentDayIndex - 1] !== dayOfWeek - 1;
    const isLastInSequence = currentDayIndex === sortedDays.length - 1 || sortedDays[currentDayIndex + 1] !== dayOfWeek + 1;
    
    return {
      borderTopLeftRadius: isFirstInSequence ? 2 : 0,
      borderBottomLeftRadius: isFirstInSequence ? 2 : 0,
      borderTopRightRadius: isLastInSequence ? 2 : 0,
      borderBottomRightRadius: isLastInSequence ? 2 : 0,
    };
  };

  const saveCustodySchedule = async () => {
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user?.id) return;

      // Delete existing custody schedules for this child
      await supabase
        .from('custody_schedules')
        .delete()
        .eq('child_id', childId);

      // Insert new schedules for each parent if they have days assigned
      const schedulesToInsert: Array<{
        child_id: string;
        user_id: string;
        days_of_week: number[];
        parent_name: string;
        parent_type: string;
        color: string;
      }> = [];
      
      Object.entries(custodySchedule).forEach(([userId, schedule]) => {
        if (schedule.days.length > 0) {
          schedulesToInsert.push({
            child_id: childId,
            user_id: userData.user.id,
            days_of_week: schedule.days,
            parent_name: schedule.name,
            parent_type: userId, // Store user_id as parent_type for lookup
            color: schedule.color
          });
        }
      });

      if (schedulesToInsert.length > 0) {
        const { error } = await supabase
          .from('custody_schedules')
          .insert(schedulesToInsert);

        if (error) {
          console.error('Error saving custody schedule:', error);
          Alert.alert('Error', 'Failed to save custody schedule.');
          return;
        }
      }

      await fetchRecurringEvents();
      setRecurringModalVisible(false);
    } catch (error) {
      console.error('Error saving custody schedule:', error);
      Alert.alert('Error', 'Failed to save custody schedule.');
    }
  };

  const isDateSelected = (dateObj: { date: Date; isCurrentMonth: boolean } | null) => {
    if (!dateObj) return false;
    return selectedDates.has(dateObj.date.toISOString().split('T')[0]);
  };

  // Add event directly when selecting a date
  const toggleDateSelection = (date: Date | null) => {
    if (!date) return;
    const dateKey = date.toISOString().split('T')[0];
    const isSelected = selectedDates.has(dateKey);
    if (isSelected) {
      // Remove event from database and UI
      setSelectedDates(prev => {
        const newSelected = new Map(prev);
        newSelected.delete(dateKey);
        return newSelected;
      });
      // Remove from database
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
      const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
      supabase
        .from('calendar_events')
        .delete()
        .eq('child_id', childId)
        .gte('start_time', startOfDay.toISOString())
        .lte('start_time', endOfDay.toISOString());
    } else {
      Alert.prompt(
        'Activity Name',
        'Enter a name for this activity:',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'OK',
            onPress: async (activityName) => {
              setSelectedDates(prev => {
                const newSelected = new Map(prev);
                const existing = newSelected.get(dateKey);
                if (existing) {
                  existing.activities.push(activityName || '');
                } else {
                  newSelected.set(dateKey, { date, activities: [activityName || ''] });
                }
                return newSelected;
              });
              // Add to database immediately
              const { data: userData, error: userError } = await supabase.auth.getUser();
              if (userError || !userData?.user?.id) return;
              const userId = userData.user.id;
              await supabase.from('calendar_events').insert({
                child_id: childId,
                user_id: userId,
                start_time: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0).toISOString(),
                end_time: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 17, 0).toISOString(),
                event_type: 'scheduled',
                activity_name: activityName,
                location: '',
                notes: `${activityName} scheduled for ${childName}`
              });
            }
          }
        ],
        'plain-text',
        '',
        'default'
      );
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    if (direction === 'prev') {
      newMonth.setMonth(currentMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(currentMonth.getMonth() + 1);
    }
    setCurrentMonth(newMonth);
  };

  const handleConfirm = async () => {
    if (selectedDates.size === 0) {
      Alert.alert('No dates selected', 'Please select at least one date before confirming.');
      return;
    }

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user?.id) {
        Alert.alert('Error', 'Failed to get user information.');
        return;
      }

      const userId = userData.user.id;

      const dateStrings = Array.from(selectedDates.values()).map(({ date }) => {
        const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
        const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
        return { start: startOfDay.toISOString(), end: endOfDay.toISOString() };
      });

      for (const dateRange of dateStrings) {
        await supabase
          .from('calendar_events')
          .delete()
          .eq('child_id', childId)
          .gte('start_time', dateRange.start)
          .lte('start_time', dateRange.end);
      }

      const events = Array.from(selectedDates.values()).flatMap(({ date, activities }) => 
        activities.map(activity => ({
          child_id: childId,
          user_id: userId,
          start_time: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0).toISOString(),
          end_time: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 17, 0).toISOString(),
          event_type: 'scheduled',
          activity_name: activity,
          location: '',
          notes: `${activity} scheduled for ${childName}`
        }))
      );

      const { error } = await supabase
        .from('calendar_events')
        .insert(events);

      if (error) {
        console.error('Error saving calendar events:', error);
        Alert.alert('Error', 'Failed to save calendar events.');
        return;
      }

      onConfirm(Array.from(selectedDates.values()).map(item => item.date));
    } catch (error) {
      console.error('Error saving calendar events:', error);
      Alert.alert('Error', 'Failed to save calendar events.');
    }
  };

  // Save edited activity
  async function handleSaveActivityEdit(activityIndex: number) {
    if (!modalActivity || editingActivityIndex !== activityIndex) return;
    
    const oldActivity = modalActivity.activities[activityIndex];
    const startOfDay = new Date(modalActivity.date.getFullYear(), modalActivity.date.getMonth(), modalActivity.date.getDate(), 0, 0, 0);
    const endOfDay = new Date(modalActivity.date.getFullYear(), modalActivity.date.getMonth(), modalActivity.date.getDate(), 23, 59, 59);
    
    // Update in database - find the specific event and update it
    const { error } = await supabase
      .from('calendar_events')
      .update({ activity_name: editActivityValue, notes: `${editActivityValue} scheduled for ${childName}` })
      .eq('child_id', childId)
      .eq('activity_name', oldActivity)
      .gte('start_time', startOfDay.toISOString())
      .lte('start_time', endOfDay.toISOString());
    
    if (!error) {
      // Update UI state
      setSelectedDates(prev => {
        const newSelected = new Map(prev);
        const dateKey = modalActivity.date.toISOString().split('T')[0];
        const existing = newSelected.get(dateKey);
        if (existing) {
          existing.activities[activityIndex] = editActivityValue;
        }
        return newSelected;
      });
      
      // Update modal state
      const updatedActivities = [...modalActivity.activities];
      updatedActivities[activityIndex] = editActivityValue;
      setModalActivity({ ...modalActivity, activities: updatedActivities });
      
      setEditingActivityIndex(null);
      setEditActivityValue('');
    }
  }

  // Remove individual activity from DB and UI
  async function handleRemoveActivity(activityIndex: number) {
    if (!modalActivity) return;
    
    const activityToRemove = modalActivity.activities[activityIndex];
    const startOfDay = new Date(modalActivity.date.getFullYear(), modalActivity.date.getMonth(), modalActivity.date.getDate(), 0, 0, 0);
    const endOfDay = new Date(modalActivity.date.getFullYear(), modalActivity.date.getMonth(), modalActivity.date.getDate(), 23, 59, 59);
    
    // Remove from database
    await supabase
      .from('calendar_events')
      .delete()
      .eq('child_id', childId)
      .eq('activity_name', activityToRemove)
      .gte('start_time', startOfDay.toISOString())
      .lte('start_time', endOfDay.toISOString());
    
    // Update UI state
    setSelectedDates(prev => {
      const newSelected = new Map(prev);
      const dateKey = modalActivity.date.toISOString().split('T')[0];
      const existing = newSelected.get(dateKey);
      if (existing) {
        existing.activities.splice(activityIndex, 1);
        if (existing.activities.length === 0) {
          newSelected.delete(dateKey);
        }
      }
      return newSelected;
    });
    
    // Update modal state
    const updatedActivities = [...modalActivity.activities];
    updatedActivities.splice(activityIndex, 1);
    
    if (updatedActivities.length === 0) {
      // Close modal if no activities left
      setModalVisible(false);
      setEditingActivity(false);
    } else {
      setModalActivity({ ...modalActivity, activities: updatedActivities });
    }
    
    setEditingActivityIndex(null);
    setEditActivityValue('');
  }

  // Show modal with activity info when pressing a selected date
  const handleShowActivityModal = (date: Date) => {
    const dateKey = date.toISOString().split('T')[0];
    const selectedInfo = selectedDates.get(dateKey);
    if (selectedInfo) {
      setModalActivity(selectedInfo);
      setModalVisible(true);
    } else {
      setCreateModalDate(date);
      setCreateActivityValue('');
      setCreateModalVisible(true);
    }
  };

  // Save new activity from create modal
  async function handleSaveCreateActivity() {
    if (!createModalDate || !createActivityValue.trim()) return;
    const date = createModalDate;
    const dateKey = date.toISOString().split('T')[0];
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user?.id) return;
    const userId = userData.user.id;
    await supabase.from('calendar_events').insert({
      child_id: childId,
      user_id: userId,
      start_time: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0).toISOString(),
      end_time: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 17, 0).toISOString(),
      event_type: 'scheduled',
      activity_name: createActivityValue,
      location: '',
      notes: `${createActivityValue} scheduled for ${childName}`
    });
    setSelectedDates(prev => {
      const newSelected = new Map(prev);
      const existing = newSelected.get(dateKey);
      if (existing) {
        existing.activities.push(createActivityValue);
      } else {
        newSelected.set(dateKey, { date, activities: [createActivityValue] });
      }
      return newSelected;
    });
    setCreateModalVisible(false);
    setCreateModalDate(null);
    setCreateActivityValue('');
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['M', 'T', 'W', 'Th', 'F', 'Sa', 'Su'];

  const weeks = getDaysInMonth(currentMonth);

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
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: Colors[colorScheme ?? 'light'].tint }]}>‹ Back</Text>
        </TouchableOpacity>
        <View style={styles.monthContainer}>
          <Text style={[styles.monthText, { color: Colors[colorScheme ?? 'light'].text }]}>
            {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </Text>
          <TouchableOpacity onPress={() => navigateMonth('prev')} style={styles.monthNavLeft}>
            <Text style={[styles.monthNavText, { color: Colors[colorScheme ?? 'light'].tint }]}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigateMonth('next')} style={styles.monthNavRight}>
            <Text style={[styles.monthNavText, { color: Colors[colorScheme ?? 'light'].tint }]}>›</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity 
          style={[styles.headerAddButton, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]}
          onPress={() => setFabMenuVisible(!fabMenuVisible)}
        >
          <Text style={styles.headerAddButtonText}>+</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.content}>
        <View style={styles.calendarSection}>
          <View style={styles.calendarContainer}>
            <View style={styles.dayNamesRow}>
              <View style={styles.weekNumberSpacer}></View>
              {dayNames.map(dayName => (
                <Text key={dayName} style={[styles.dayName, { color: Colors[colorScheme ?? 'light'].text }]}>
                  {dayName}
                </Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {weeks.map((week, weekIndex) => (
                <View key={weekIndex} style={styles.weekRow}>
                  <View style={styles.weekNumberContainer}>
                    <Text style={[styles.weekNumber, { color: Colors[colorScheme ?? 'light'].tint }]}>
                      {getWeekNumber(week[0].date)}
                    </Text>
                  </View>
                  {week.map((dateObj, dayIndex) => {
                    const dateKey = dateObj.date.toISOString().split('T')[0];
                    const selectedInfo = selectedDates.get(dateKey);
                    const isCurrentMonth = dateObj.isCurrentMonth;
                    const recurringEvent = getRecurringEventForDate(dateObj.date);
                    const custodyBarStyle = getCustodyBarStyle(dateObj.date, recurringEvent);
                    
                    return (
                      <TouchableOpacity
                        key={dayIndex}
                        style={[
                          styles.dayCell,
                          !isCurrentMonth && styles.otherMonthDay
                        ]}
                        onPress={() => handleShowActivityModal(dateObj.date)}
                      >
                        <View style={styles.dayCellContent}>
                          {recurringEvent && (
                            <View style={[
                              styles.recurringIndicator, 
                              { backgroundColor: recurringEvent.color },
                              custodyBarStyle
                            ]} />
                          )}
                          <Text
                            style={[
                              styles.dayText,
                              !isCurrentMonth && styles.otherMonthText,
                              { color: Colors[colorScheme ?? 'light'].text }
                            ]}
                          >
                            {dateObj.date.getDate()}
                          </Text>
                          {selectedInfo?.activities && selectedInfo.activities.length > 0 && (
                            <View style={styles.eventContainer}>
                              {selectedInfo.activities.slice(0, 3).map((activity, index) => (
                                <View key={index} style={[
                                  styles.eventBadge,
                                  { backgroundColor: Colors[colorScheme ?? 'light'].tint }
                                ]}>
                                  <Text
                                    style={[
                                      styles.eventBadgeText,
                                      { color: Colors[colorScheme ?? 'light'].calendarSelectedText || '#fff' }
                                    ]}
                                    numberOfLines={1}
                                  >
                                    {activity}
                                  </Text>
                                </View>
                              ))}
                              {selectedInfo.activities.length > 3 && (
                                <View style={[
                                  styles.eventBadge,
                                  { backgroundColor: '#666' }
                                ]}>
                                  <Text style={styles.eventBadgeText}>
                                    +{selectedInfo.activities.length - 3}
                                  </Text>
                                </View>
                              )}
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>
      
      {/* Activity Info Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => { 
          setModalVisible(false); 
          setEditingActivity(false); 
          setEditingActivityIndex(null);
          setEditActivityValue('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContentBox, { backgroundColor: Colors[colorScheme ?? 'light'].cardBackground }]}>
            <Text style={[styles.modalTitle, { color: Colors[colorScheme ?? 'light'].text }]}>Activity Details</Text>
            {modalActivity && (
              <>
                <Text style={[styles.modalLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Date:</Text>
                <Text style={[styles.modalValue, { color: Colors[colorScheme ?? 'light'].text }]}>{modalActivity.date.toLocaleDateString()}</Text>
                <Text style={[styles.modalLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Activities:</Text>
                {editingActivity ? (
                  <View style={styles.activitiesEditContainer}>
                    {modalActivity.activities.map((activity, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.activityEditItem,
                          { 
                            backgroundColor: editingActivityIndex === index ? Colors[colorScheme ?? 'light'].inputBackground : Colors[colorScheme ?? 'light'].cardBackground,
                            borderColor: editingActivityIndex === index ? Colors[colorScheme ?? 'light'].tint : Colors[colorScheme ?? 'light'].border
                          }
                        ]}
                        onPress={() => {
                          setEditingActivityIndex(index);
                          setEditActivityValue(activity);
                        }}
                      >
                        {editingActivityIndex === index ? (
                          <View style={styles.activityEditRow}>
                            <TextInput
                              style={[styles.activityEditInput, {
                                backgroundColor: Colors[colorScheme ?? 'light'].inputBackground,
                                color: Colors[colorScheme ?? 'light'].text,
                                borderColor: Colors[colorScheme ?? 'light'].border
                              }]}
                              value={editActivityValue}
                              onChangeText={setEditActivityValue}
                              autoFocus={true}
                            />
                            <TouchableOpacity
                              style={styles.saveActivityButton}
                              onPress={() => handleSaveActivityEdit(index)}
                            >
                              <Text style={styles.saveActivityButtonText}>✓</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.removeActivityButton}
                              onPress={() => handleRemoveActivity(index)}
                            >
                              <Text style={styles.removeActivityButtonText}>✗</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <Text style={[styles.activityEditText, { color: Colors[colorScheme ?? 'light'].text }]}>• {activity}</Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  modalActivity.activities.map((activity, index) => (
                    <Text key={index} style={[styles.modalValue, { color: Colors[colorScheme ?? 'light'].text }]}>• {activity}</Text>
                  ))
                )}
              </>
            )}
            <View style={{ flexDirection: 'row', marginTop: 20, justifyContent: 'center', alignItems: 'center' }}>
              {editingActivity ? (
                <>
                  <TouchableOpacity style={[styles.modalActionButton, {
                    backgroundColor: Colors[colorScheme ?? 'light'].buttonBackground,
                    borderColor: Colors[colorScheme ?? 'light'].tint,
                    borderWidth: 2,
                    shadowColor: Colors[colorScheme ?? 'light'].tint,
                    shadowOpacity: 0.15,
                    shadowRadius: 4,
                    elevation: 2
                  }]} onPress={() => { 
                    setEditingActivity(false); 
                    setEditingActivityIndex(null);
                  }}>
                    <Text style={[styles.modalActionButtonText, { color: Colors[colorScheme ?? 'light'].buttonText }]}>Done</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity style={[styles.modalActionButton, {
                    backgroundColor: Colors[colorScheme ?? 'light'].buttonBackground,
                    borderColor: Colors[colorScheme ?? 'light'].tint,
                    borderWidth: 2,
                    shadowColor: Colors[colorScheme ?? 'light'].tint,
                    shadowOpacity: 0.15,
                    shadowRadius: 4,
                    elevation: 2
                  }]} onPress={() => setEditingActivity(true)}>
                    <Text style={[styles.modalActionButtonText, { color: Colors[colorScheme ?? 'light'].buttonText }]}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalCloseButton, {
                    marginLeft: 10,
                    backgroundColor: Colors[colorScheme ?? 'light'].buttonBackground,
                    borderColor: Colors[colorScheme ?? 'light'].tint,
                    borderWidth: 2,
                    shadowColor: Colors[colorScheme ?? 'light'].tint,
                    shadowOpacity: 0.15,
                    shadowRadius: 4,
                    elevation: 2
                  }]} onPress={() => { 
                    setModalVisible(false); 
                    setEditingActivity(false); 
                    setEditingActivityIndex(null);
                    setEditActivityValue('');
                  }}>
                    <Text style={[styles.modalActionButtonText, { color: Colors[colorScheme ?? 'light'].buttonText }]}>Close</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>
      {/* Create Activity Modal */}
      <Modal
        visible={createModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContentBox, { backgroundColor: Colors[colorScheme ?? 'light'].cardBackground }]}>
            <Text style={[styles.modalTitle, { color: Colors[colorScheme ?? 'light'].text }]}>Create Activity</Text>
            <Text style={[styles.modalLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Date:</Text>
            <Text style={[styles.modalValue, { color: Colors[colorScheme ?? 'light'].text }]}>{createModalDate?.toLocaleDateString()}</Text>
            <Text style={[styles.modalLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Activity Name:</Text>
            <TextInput
              style={[styles.modalInput, { 
                backgroundColor: Colors[colorScheme ?? 'light'].inputBackground,
                color: Colors[colorScheme ?? 'light'].text,
                borderColor: Colors[colorScheme ?? 'light'].border
              }]}
              value={createActivityValue}
              onChangeText={setCreateActivityValue}
              placeholder="Enter activity name"
              placeholderTextColor={Colors[colorScheme ?? 'light'].textLight}
              // Do not autoFocus to avoid keyboard/cursor issues on iPhone
              autoFocus={false}
            />
            <View style={{ flexDirection: 'row', marginTop: 20, justifyContent: 'center', alignItems: 'center' }}>
              <TouchableOpacity style={[styles.modalActionButton, {
                backgroundColor: Colors[colorScheme ?? 'light'].buttonBackground,
                borderColor: Colors[colorScheme ?? 'light'].tint,
                borderWidth: 2,
                shadowColor: Colors[colorScheme ?? 'light'].tint,
                shadowOpacity: 0.15,
                shadowRadius: 4,
                elevation: 2
              }]} onPress={handleSaveCreateActivity}>
                <Text style={[styles.modalActionButtonText, { color: Colors[colorScheme ?? 'light'].buttonText }]}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalCloseButton, {
                marginLeft: 10,
                backgroundColor: Colors[colorScheme ?? 'light'].buttonBackground,
                borderColor: Colors[colorScheme ?? 'light'].tint,
                borderWidth: 2,
                shadowColor: Colors[colorScheme ?? 'light'].tint,
                shadowOpacity: 0.15,
                shadowRadius: 4,
                elevation: 2
              }]} onPress={() => setCreateModalVisible(false)}>
                <Text style={[styles.modalActionButtonText, { color: Colors[colorScheme ?? 'light'].buttonText }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Custody Schedule Modal */}
      <Modal
        visible={recurringModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRecurringModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContentBox, { width: '90%', maxHeight: '80%', backgroundColor: Colors[colorScheme ?? 'light'].cardBackground }]}>
            <Text style={[styles.modalTitle, { color: Colors[colorScheme ?? 'light'].text }]}>Edit Custody Schedule</Text>
            
            {/* Scrollable content for multiple parents */}
            <View style={{ width: '100%', maxHeight: 400 }}>
              {Object.entries(custodySchedule).map(([userId, schedule]) => (
                <View key={userId} style={styles.parentSection}>
                  <Text style={[styles.parentSectionTitle, { color: schedule.color }]}>{schedule.name}'s Days</Text>
                  <View style={styles.dayPickerRow}>
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
                      <TouchableOpacity
                        key={`${userId}-${day}`}
                        style={[
                          styles.dayPickerButton,
                          { 
                            backgroundColor: schedule.days.includes(index) ? schedule.color : Colors[colorScheme ?? 'light'].inputBackground,
                            borderColor: schedule.days.includes(index) ? schedule.color : Colors[colorScheme ?? 'light'].border
                          }
                        ]}
                        onPress={() => {
                          const updatedDays = schedule.days.includes(index)
                            ? schedule.days.filter((d: number) => d !== index)
                            : [...schedule.days, index];
                          setCustodySchedule(prev => ({ 
                            ...prev, 
                            [userId]: { ...prev[userId], days: updatedDays }
                          }));
                        }}
                      >
                        <Text style={[
                          styles.dayPickerText,
                          { color: schedule.days.includes(index) ? '#fff' : Colors[colorScheme ?? 'light'].text }
                        ]}>
                          {day}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </View>

            <View style={{ flexDirection: 'row', marginTop: 20, justifyContent: 'center', alignItems: 'center' }}>
              <TouchableOpacity style={[styles.modalActionButton, {
                backgroundColor: Colors[colorScheme ?? 'light'].buttonBackground,
                borderColor: Colors[colorScheme ?? 'light'].tint,
                borderWidth: 2,
                shadowColor: Colors[colorScheme ?? 'light'].tint,
                shadowOpacity: 0.15,
                shadowRadius: 4,
                elevation: 2
              }]} onPress={saveCustodySchedule}>
                <Text style={[styles.modalActionButtonText, { color: Colors[colorScheme ?? 'light'].buttonText }]}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalCloseButton, {
                marginLeft: 10,
                backgroundColor: Colors[colorScheme ?? 'light'].buttonBackground,
                borderColor: Colors[colorScheme ?? 'light'].tint,
                borderWidth: 2,
                shadowColor: Colors[colorScheme ?? 'light'].tint,
                shadowOpacity: 0.15,
                shadowRadius: 4,
                elevation: 2
              }]} onPress={() => setRecurringModalVisible(false)}>
                <Text style={[styles.modalActionButtonText, { color: Colors[colorScheme ?? 'light'].buttonText }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* FAB Menu Overlay */}
      {fabMenuVisible && (
        <TouchableOpacity 
          style={styles.fabMenuOverlay}
          onPress={() => setFabMenuVisible(false)}
          activeOpacity={1}
        />
      )}

      {/* FAB Menu */}
      {fabMenuVisible && (
        <View style={[styles.fabMenu, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
          <TouchableOpacity 
            style={[styles.fabMenuItem, { backgroundColor: Colors[colorScheme ?? 'light'].buttonBackground }]}
            onPress={() => {
              setFabMenuVisible(false);
              setRecurringModalVisible(true);
            }}
          >
            <Text style={[styles.fabMenuItemText, { color: Colors[colorScheme ?? 'light'].text }]}>Edit Custody Schedule</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 0, // Remove padding for full screen
    paddingTop: 50, // Reduced top padding
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center', // Center the calendar content vertically
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  content: {
    flex: 1,
    flexDirection: 'column',
  },
  calendarSection: {
    flex: 1, // Take all available space in content area
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
    opacity: 0.7,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    paddingHorizontal: 20, // Add horizontal padding back to header
  },
  headerAddButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAddButtonText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
  monthContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  monthNavLeft: {
    position: 'absolute',
    left: 0,
    top: -5,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  monthNavRight: {
    position: 'absolute',
    right: 0,
    top: -5,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  monthNavText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  childName: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
  backButton: {
    padding: 10,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 20, // Add horizontal padding
  },
  navButton: {
    padding: 10,
  },
  navButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  monthText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  dayNamesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    height: 40,
    paddingHorizontal: 0,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    height: 75,
  },
  weekNumberContainer: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
  },
  weekNumberSpacer: {
    width: 30, // Same width as weekNumberContainer to maintain alignment
  },
  weekNumber: {
    fontSize: 10, // Reduced from 12 to 10
    fontWeight: 'bold',
  },
  dayName: {
    fontSize: 12, // Reduced from 14 to 12
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1, // Use flex instead of fixed width
    paddingVertical: 6, // Reduced padding
  },
  calendarContainer: {
    borderRadius: 8,
    margin: 4,
    marginBottom: 0,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    flex: 1,
    overflow: 'hidden',
  },
  calendarGrid: {
    flexDirection: 'column',
    flex: 1,
  },
  dayCell: {
    flex: 1,
    height: 75,
    justifyContent: 'flex-start',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
    paddingTop: 4,
    position: 'relative',
  },
  emptyDay: {
    backgroundColor: 'transparent',
  },
  selectedDay: {
    borderRadius: 0, 
  },
  dayText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 0,
    textAlign: 'center',
  },
  otherMonthDay: {
    borderWidth: 0,
    opacity: 0.4, // Reduced opacity to make other month dates less prominent
  },
  otherMonthText: {
    opacity: 0.5, // Reduced opacity for better visual separation
  },
  selectedDayText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  dayCellContent: {
    alignItems: 'center',
    width: '100%',
    height: '100%',
    justifyContent: 'flex-start',
    paddingTop: 8,
  },
  recurringIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    opacity: 0.9,
    zIndex: 1,
  },
  recurringText: {
    fontSize: 9, // Increased from 8 for better readability
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  activityText: {
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
    width: '100%',
    paddingHorizontal: 2,
  },
  eventBadge: {
    backgroundColor: '#4285f4',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginTop: 2,
    minWidth: 20,
    maxWidth: '90%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventContainer: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 2,
  },
  eventBadgeText: {
    fontSize: 8,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  selectedActivityText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContentBox: {
    borderRadius: 12,
    padding: 24,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 8,
    color: '#333',
  },
  modalValue: {
    fontSize: 16,
    marginBottom: 8,
    color: '#333',
  },
  modalCloseButton: {
    backgroundColor: '#eee',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  modalActionButton: {
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  modalActionButtonText: {
    fontWeight: 'bold',
    color: '#333',
    fontSize: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 8,
    fontSize: 16,
    marginBottom: 8,
    width: 200,
    textAlign: 'center',
  },
  dayPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    marginBottom: 16,
    width: '100%',
    gap: 8,
  },
  dayPickerButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    minWidth: 42,
    alignItems: 'center',
  },
  dayPickerButtonSelected: {
    backgroundColor: '#4285f4',
    borderColor: '#4285f4',
  },
  dayPickerText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  dayPickerTextSelected: {
    color: '#fff',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  timeInput: {
    width: 80,
    textAlign: 'center',
  },
  timeToText: {
    marginHorizontal: 10,
    fontSize: 16,
    fontWeight: 'bold',
  },
  colorPickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    width: '100%',
  },
  colorPickerButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorPickerButtonSelected: {
    borderColor: '#333',
    borderWidth: 3,
  },
  parentTypeRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    width: '100%',
  },
  parentTypeButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ccc',
    backgroundColor: '#f8f9fa',
    flex: 0.45,
  },
  parentTypeButtonSelected: {
    backgroundColor: '#4285f4',
    borderColor: '#4285f4',
  },
  parentTypeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  parentTypeTextSelected: {
    color: '#fff',
  },
  fabMenu: {
    position: 'absolute',
    top: 120,
    right: 20,
    borderRadius: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    paddingVertical: 8,
    minWidth: 200,
    zIndex: 999,
  },
  fabMenuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginVertical: 2,
    marginHorizontal: 8,
  },
  fabMenuItemText: {
    fontSize: 16,
    fontWeight: '500',
  },
  fabMenuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 998,
  },
  parentSection: {
    marginBottom: 20,
    width: '100%',
  },
  parentSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  activitiesEditContainer: {
    width: '100%',
    maxHeight: 200,
  },
  activityEditItem: {
    width: '100%',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  activityEditItemSelected: {
    borderColor: '#2196f3',
  },
  activityEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  activityEditInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 4,
    padding: 8,
    fontSize: 14,
    marginRight: 8,
  },
  saveActivityButton: {
    backgroundColor: '#4caf50',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  saveActivityButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  removeActivityButton: {
    backgroundColor: '#f44336',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
  },
  removeActivityButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  activityEditText: {
    fontSize: 16,
  },
});
