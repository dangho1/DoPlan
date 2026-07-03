import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  useActivities,
  useDeleteActivity,
  useSaveActivity,
  useToggleActivity,
} from '@/hooks/queries/useActivities';
import type { RecurringActivity } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from "react-native-keyboard-controller"

interface ActivitiesProps {
  childName?: string;
  childId?: string;
  onBack?: () => void;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

const ACTIVITY_COLORS = [
  '#007AFF', '#FF3B30', '#34C759', '#FF9500', '#AF52DE', '#FF2D55', '#5856D6', '#00C7BE',
];

export default function Activities({ childName, childId, onBack }: ActivitiesProps) {
  const router = useRouter();
  const params = useLocalSearchParams<{ childName?: string; childId?: string }>();
  const resolvedChildName =
    childName ?? (typeof params.childName === 'string' ? params.childName : '');
  const resolvedChildId =
    childId ?? (typeof params.childId === 'string' ? params.childId : '');
  const handleBack = onBack ?? (() => router.back());

  const colorScheme = useColorScheme();
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.id;

  const { data: activities = [], isLoading } = useActivities(resolvedChildId);
  const saveActivity = useSaveActivity(resolvedChildId);
  const deleteActivity = useDeleteActivity(resolvedChildId);
  const toggleActivity = useToggleActivity(resolvedChildId);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingActivity, setEditingActivity] = useState<RecurringActivity | null>(null);

  const [activityName, setActivityName] = useState('');
  const [activityType, setActivityType] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedColor, setSelectedColor] = useState(ACTIVITY_COLORS[0]);

  const notesAccessoryId = 'activitiesNotesAccessory';

  const resetForm = () => {
    setActivityName('');
    setActivityType('');
    setLocation('');
    setNotes('');
    setSelectedDays([]);
    setStartTime('');
    setEndTime('');
    setSelectedColor(ACTIVITY_COLORS[0]);
    setEditingActivity(null);
  };

  const openAddModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (activity: RecurringActivity) => {
    setEditingActivity(activity);
    setActivityName(activity.activity_name);
    setActivityType(activity.activity_type || '');
    setLocation(activity.location || '');
    setNotes(activity.notes || '');
    setSelectedDays(activity.days_of_week);
    setStartTime(activity.start_time.slice(0, 5));
    setEndTime(activity.end_time.slice(0, 5));
    setSelectedColor(activity.color ?? ACTIVITY_COLORS[0]);
    setModalVisible(true);
  };

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b),
    );
  };

  const validateForm = (): boolean => {
    if (!activityName.trim()) {
      Alert.alert('Error', 'Activity name is required.');
      return false;
    }
    if (selectedDays.length === 0) {
      Alert.alert('Error', 'Please select at least one day of the week.');
      return false;
    }
    if (!startTime || !endTime) {
      Alert.alert('Error', 'Start time and end time are required.');
      return false;
    }
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      Alert.alert('Error', 'Please use HH:MM format for times (e.g., 14:30).');
      return false;
    }
    return true;
  };

  const handleSave = () => {
    if (!validateForm() || !userId) return;

    const activity = {
      activity_name: activityName.trim(),
      activity_type: activityType.trim() || null,
      location: location.trim() || null,
      notes: notes.trim() || null,
      days_of_week: selectedDays,
      start_time: startTime + ':00',
      end_time: endTime + ':00',
      color: selectedColor,
      is_active: true,
    };

    saveActivity.mutate(
      { activity, userId, editingId: editingActivity?.id },
      {
        onSuccess: () => {
          Alert.alert('Success', editingActivity ? 'Activity updated!' : 'Activity created!');
          setModalVisible(false);
          resetForm();
        },
        onError: () => Alert.alert('Error', 'Failed to save activity.'),
      },
    );
  };

  const handleDelete = (activity: RecurringActivity) => {
    Alert.alert(
      'Delete Activity',
      `Are you sure you want to delete "${activity.activity_name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteActivity.mutate(activity.id, {
              onSuccess: () => Alert.alert('Success', 'Activity deleted.'),
              onError: () => Alert.alert('Error', 'Failed to delete activity.'),
            });
          },
        },
      ],
    );
  };

  const handleToggleActive = (activity: RecurringActivity) => {
    toggleActivity.mutate(
      { activityId: activity.id, isActive: activity.is_active ?? true },
      {
        onError: () => Alert.alert('Error', 'Failed to update activity status.'),
      },
    );
  };

  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getDaysString = (days: number[]): string =>
    days
      .sort((a, b) => a - b)
      .map((day) => DAYS_OF_WEEK[day].label)
      .join(', ');

  return (
    <View
      style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors[colorScheme ?? 'light'].text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
          Activities - {resolvedChildName}
        </Text>
        <TouchableOpacity onPress={openAddModal} style={styles.addHeaderButton}>
          <Ionicons
            name="add-circle"
            size={28}
            color={Colors[colorScheme ?? 'light'].primary}
          />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].primary} />
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text
            style={[styles.subtitle, { color: Colors[colorScheme ?? 'light'].textSecondary }]}
          >
            Manage {childName}'s weekly recurring activities and events
          </Text>

          {activities.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons
                name="calendar-outline"
                size={64}
                color={Colors[colorScheme ?? 'light'].textSecondary}
              />
              <Text
                style={[styles.emptyText, { color: Colors[colorScheme ?? 'light'].textSecondary }]}
              >
                No recurring activities yet
              </Text>
              <Text
                style={[
                  styles.emptySubtext,
                  { color: Colors[colorScheme ?? 'light'].textSecondary },
                ]}
              >
                Tap the + button above to add your first activity
              </Text>
            </View>
          ) : (
            <View style={styles.activitiesList}>
              {activities.map((activity) => (
                <View
                  key={activity.id}
                  style={[
                    styles.activityCard,
                    {
                      backgroundColor: Colors[colorScheme ?? 'light'].cardBackground,
                      borderColor: Colors[colorScheme ?? 'light'].border,
                      opacity: activity.is_active ? 1 : 0.5,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.activityColorBar,
                      { backgroundColor: activity.color ?? '#007AFF' },
                    ]}
                  />
                  <View style={styles.activityContent}>
                    <View style={styles.activityHeader}>
                      <Text
                        style={[
                          styles.activityName,
                          { color: Colors[colorScheme ?? 'light'].text },
                        ]}
                      >
                        {activity.activity_name}
                      </Text>
                      <View style={styles.activityActions}>
                        <TouchableOpacity
                          onPress={() => handleToggleActive(activity)}
                          style={styles.actionButton}
                        >
                          <Ionicons
                            name={activity.is_active ? 'pause-circle' : 'play-circle'}
                            size={24}
                            color={
                              activity.is_active
                                ? Colors[colorScheme ?? 'light'].primary
                                : '#999'
                            }
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => openEditModal(activity)}
                          style={styles.actionButton}
                        >
                          <Ionicons
                            name="pencil"
                            size={20}
                            color={Colors[colorScheme ?? 'light'].primary}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDelete(activity)}
                          style={styles.actionButton}
                        >
                          <Ionicons name="trash-outline" size={20} color="#ff4444" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {activity.activity_type && (
                      <Text
                        style={[
                          styles.activityType,
                          { color: Colors[colorScheme ?? 'light'].textSecondary },
                        ]}
                      >
                        {activity.activity_type}
                      </Text>
                    )}

                    <View style={styles.activityDetails}>
                      <View style={styles.detailRow}>
                        <Ionicons
                          name="time-outline"
                          size={16}
                          color={Colors[colorScheme ?? 'light'].textSecondary}
                        />
                        <Text
                          style={[
                            styles.detailText,
                            { color: Colors[colorScheme ?? 'light'].text },
                          ]}
                        >
                          {formatTime(activity.start_time)} - {formatTime(activity.end_time)}
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Ionicons
                          name="calendar-outline"
                          size={16}
                          color={Colors[colorScheme ?? 'light'].textSecondary}
                        />
                        <Text
                          style={[
                            styles.detailText,
                            { color: Colors[colorScheme ?? 'light'].text },
                          ]}
                        >
                          {getDaysString(activity.days_of_week)}
                        </Text>
                      </View>
                      {activity.location && (
                        <View style={styles.detailRow}>
                          <Ionicons
                            name="location-outline"
                            size={16}
                            color={Colors[colorScheme ?? 'light'].textSecondary}
                          />
                          <Text
                            style={[
                              styles.detailText,
                              { color: Colors[colorScheme ?? 'light'].text },
                            ]}
                          >
                            {activity.location}
                          </Text>
                        </View>
                      )}
                      {activity.notes && (
                        <View style={styles.detailRow}>
                          <Ionicons
                            name="document-text-outline"
                            size={16}
                            color={Colors[colorScheme ?? 'light'].textSecondary}
                          />
                          <Text
                            style={[
                              styles.detailText,
                              { color: Colors[colorScheme ?? 'light'].text },
                            ]}
                          >
                            {activity.notes}
                          </Text>
                        </View>
                      )}
                    </View>

                    {!activity.is_active && (
                      <View style={styles.pausedBadge}>
                        <Text style={styles.pausedText}>Paused</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View
          style={styles.modalOverlay}
        >
          <View
            style={[
              styles.modalContent,
              { backgroundColor: Colors[colorScheme ?? 'light'].cardBackground },
            ]}
          >
            <KeyboardAwareScrollView showsVerticalScrollIndicator={false}>
              <Text
                style={[styles.modalTitle, { color: Colors[colorScheme ?? 'light'].text }]}
              >
                {editingActivity ? 'Edit Activity' : 'New Activity'}
              </Text>

              <Text style={[styles.inputLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
                Activity Name *
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: Colors[colorScheme ?? 'light'].text,
                    borderColor: Colors[colorScheme ?? 'light'].border,
                    backgroundColor: Colors[colorScheme ?? 'light'].inputBackground,
                  },
                ]}
                placeholder="e.g., Soccer Practice"
                placeholderTextColor={Colors[colorScheme ?? 'light'].textSecondary}
                value={activityName}
                onChangeText={setActivityName}
              />

              <Text style={[styles.inputLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
                Activity Type
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: Colors[colorScheme ?? 'light'].text,
                    borderColor: Colors[colorScheme ?? 'light'].border,
                    backgroundColor: Colors[colorScheme ?? 'light'].inputBackground,
                  },
                ]}
                placeholder="e.g., Sports, Music, Tutoring"
                placeholderTextColor={Colors[colorScheme ?? 'light'].textSecondary}
                value={activityType}
                onChangeText={setActivityType}
              />

              <Text style={[styles.inputLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
                Days of Week *
              </Text>
              <View style={styles.daysContainer}>
                {DAYS_OF_WEEK.map((day) => (
                  <TouchableOpacity
                    key={day.value}
                    style={[
                      styles.dayButton,
                      {
                        backgroundColor: selectedDays.includes(day.value)
                          ? Colors[colorScheme ?? 'light'].primary
                          : Colors[colorScheme ?? 'light'].inputBackground,
                        borderColor: Colors[colorScheme ?? 'light'].border,
                      },
                    ]}
                    onPress={() => toggleDay(day.value)}
                  >
                    <Text
                      style={[
                        styles.dayButtonText,
                        {
                          color: selectedDays.includes(day.value)
                            ? '#fff'
                            : Colors[colorScheme ?? 'light'].text,
                        },
                      ]}
                    >
                      {day.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.timeRow}>
                <View style={styles.timeField}>
                  <Text
                    style={[styles.inputLabel, { color: Colors[colorScheme ?? 'light'].text }]}
                  >
                    Start Time *
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        color: Colors[colorScheme ?? 'light'].text,
                        borderColor: Colors[colorScheme ?? 'light'].border,
                        backgroundColor: Colors[colorScheme ?? 'light'].inputBackground,
                      },
                    ]}
                    placeholder="HH:MM"
                    placeholderTextColor={Colors[colorScheme ?? 'light'].textSecondary}
                    value={startTime}
                    onChangeText={setStartTime}
                  />
                </View>
                <View style={styles.timeField}>
                  <Text
                    style={[styles.inputLabel, { color: Colors[colorScheme ?? 'light'].text }]}
                  >
                    End Time *
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        color: Colors[colorScheme ?? 'light'].text,
                        borderColor: Colors[colorScheme ?? 'light'].border,
                        backgroundColor: Colors[colorScheme ?? 'light'].inputBackground,
                      },
                    ]}
                    placeholder="HH:MM"
                    placeholderTextColor={Colors[colorScheme ?? 'light'].textSecondary}
                    value={endTime}
                    onChangeText={setEndTime}
                  />
                </View>
              </View>

              <Text style={[styles.inputLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
                Location
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: Colors[colorScheme ?? 'light'].text,
                    borderColor: Colors[colorScheme ?? 'light'].border,
                    backgroundColor: Colors[colorScheme ?? 'light'].inputBackground,
                  },
                ]}
                placeholder="e.g., Community Center"
                placeholderTextColor={Colors[colorScheme ?? 'light'].textSecondary}
                value={location}
                onChangeText={setLocation}
              />

              <Text style={[styles.inputLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
                Notes
              </Text>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  {
                    color: Colors[colorScheme ?? 'light'].text,
                    borderColor: Colors[colorScheme ?? 'light'].border,
                    backgroundColor: Colors[colorScheme ?? 'light'].inputBackground,
                  },
                ]}
                placeholder="Additional details..."
                placeholderTextColor={Colors[colorScheme ?? 'light'].textSecondary}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                inputAccessoryViewID={
                  Platform.OS === 'ios' ? notesAccessoryId : undefined
                }
              />

              <Text style={[styles.inputLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
                Color
              </Text>
              <View style={styles.colorPicker}>
                {ACTIVITY_COLORS.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorOption,
                      { backgroundColor: color },
                      selectedColor === color && styles.selectedColorOption,
                    ]}
                    onPress={() => setSelectedColor(color)}
                  >
                    {selectedColor === color && (
                      <Ionicons name="checkmark" size={20} color="#fff" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.cancelModalButton,
                    { borderColor: Colors[colorScheme ?? 'light'].border },
                  ]}
                  onPress={() => setModalVisible(false)}
                  disabled={saveActivity.isPending}
                >
                  <Text
                    style={[styles.cancelButtonText, { color: Colors[colorScheme ?? 'light'].text }]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.saveModalButton,
                    { backgroundColor: Colors[colorScheme ?? 'light'].primary },
                  ]}
                  onPress={handleSave}
                  disabled={saveActivity.isPending}
                >
                  {saveActivity.isPending ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.saveButtonText}>
                      {editingActivity ? 'Update' : 'Save'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </KeyboardAwareScrollView>
            {Platform.OS === 'ios' && (
              <InputAccessoryView nativeID={notesAccessoryId}>
                <View
                  style={[
                    styles.keyboardAccessory,
                    {
                      backgroundColor: Colors[colorScheme ?? 'light'].cardBackground,
                      borderTopColor: Colors[colorScheme ?? 'light'].border,
                    },
                  ]}
                >
                  <TouchableOpacity
                    style={styles.keyboardAccessoryDoneButton}
                    onPress={() => Keyboard.dismiss()}
                  >
                    <Text
                      style={[
                        styles.keyboardAccessoryDoneText,
                        { color: Colors[colorScheme ?? 'light'].primary },
                      ]}
                    >
                      Done
                    </Text>
                  </TouchableOpacity>
                </View>
              </InputAccessoryView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: { padding: 5 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', flex: 1, marginLeft: 15 },
  addHeaderButton: { padding: 5 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, paddingHorizontal: 20 },
  subtitle: { fontSize: 14, marginBottom: 20, lineHeight: 20 },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: { fontSize: 18, fontWeight: '600', marginTop: 20, marginBottom: 8 },
  emptySubtext: { fontSize: 14, textAlign: 'center' },
  activitiesList: { gap: 15, paddingBottom: 30 },
  activityCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  activityColorBar: { height: 6, width: '100%' },
  activityContent: { padding: 15 },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  activityName: { fontSize: 18, fontWeight: 'bold', flex: 1, marginRight: 10 },
  activityActions: { flexDirection: 'row', gap: 8 },
  actionButton: { padding: 4 },
  activityType: { fontSize: 14, fontStyle: 'italic', marginBottom: 12 },
  activityDetails: { gap: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailText: { fontSize: 14, flex: 1 },
  pausedBadge: {
    position: 'absolute',
    top: 15,
    right: 15,
    backgroundColor: '#999',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pausedText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '85%',
    borderRadius: 20,
    padding: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 12 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 16 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  keyboardAccessory: {
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'flex-end',
  },
  keyboardAccessoryDoneButton: { paddingHorizontal: 8, paddingVertical: 4 },
  keyboardAccessoryDoneText: { fontSize: 17, fontWeight: '600' },
  daysContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  dayButtonText: { fontSize: 14, fontWeight: '600' },
  timeRow: { flexDirection: 'row', gap: 10 },
  timeField: { flex: 1 },
  colorPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedColorOption: {
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 20 },
  modalButton: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  cancelModalButton: { backgroundColor: 'transparent', borderWidth: 1 },
  saveModalButton: {},
  cancelButtonText: { fontSize: 16, fontWeight: '600' },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
