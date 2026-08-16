import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  useContacts,
  useDeleteContact,
  useSaveContact,
} from '@/hooks/queries/useContacts';
import type { Contact } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  InputAccessoryView,
  Keyboard,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

interface ContactsProps {
  childName?: string;
  childId?: string;
  onBack?: () => void;
}

export default function Contacts({ childName, childId, onBack }: ContactsProps) {
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

  const { data: contacts = [], isLoading } = useContacts(resolvedChildId);
  const saveContact = useSaveContact(resolvedChildId);
  const deleteContact = useDeleteContact(resolvedChildId);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');

  const notesAccessoryId = 'contactsNotesAccessory';

  const resetForm = () => {
    setName('');
    setRole('');
    setPhoneNumber('');
    setEmail('');
    setNotes('');
    setEditingContact(null);
  };

  const openAddModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (contact: Contact) => {
    setEditingContact(contact);
    setName(contact.name);
    setRole(contact.role || '');
    setPhoneNumber(contact.phone_number || '');
    setEmail(contact.email || '');
    setNotes(contact.notes || '');
    setModalVisible(true);
  };

  const validateForm = (): boolean => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name is required.');
      return false;
    }
    return true;
  };

  const handleSave = () => {
    if (!validateForm() || !userId) return;

    const contact = {
      name: name.trim(),
      role: role.trim() || null,
      phone_number: phoneNumber.trim() || null,
      email: email.trim() || null,
      notes: notes.trim() || null,
    };

    saveContact.mutate(
      { contact, userId, editingId: editingContact?.id },
      {
        onSuccess: () => {
          setModalVisible(false);
          resetForm();
        },
        onError: () => Alert.alert('Error', 'Failed to save contact.'),
      },
    );
  };

  const handleDelete = (contact: Contact) => {
    Alert.alert(
      'Delete Contact',
      `Are you sure you want to delete "${contact.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteContact.mutate(contact.id, {
              onError: () => Alert.alert('Error', 'Failed to delete contact.'),
            });
          },
        },
      ],
    );
  };

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`).catch(() =>
      Alert.alert('Error', 'Unable to place a call.'),
    );
  };

  const handleEmail = (address: string) => {
    Linking.openURL(`mailto:${address}`).catch(() =>
      Alert.alert('Error', 'Unable to open email.'),
    );
  };

  return (
    <View
      style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors[colorScheme ?? 'light'].text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
          Contacts - {resolvedChildName}
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
            Keep track of {childName}&apos;s teachers, coaches, doctors, and other important people
          </Text>

          {contacts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons
                name="people-outline"
                size={64}
                color={Colors[colorScheme ?? 'light'].textSecondary}
              />
              <Text
                style={[styles.emptyText, { color: Colors[colorScheme ?? 'light'].textSecondary }]}
              >
                No contacts yet
              </Text>
              <Text
                style={[
                  styles.emptySubtext,
                  { color: Colors[colorScheme ?? 'light'].textSecondary },
                ]}
              >
                Tap the + button above to add your first contact
              </Text>
            </View>
          ) : (
            <View style={styles.contactsList}>
              {contacts.map((contact) => (
                <View
                  key={contact.id}
                  style={[
                    styles.contactCard,
                    {
                      backgroundColor: Colors[colorScheme ?? 'light'].cardBackground,
                      borderColor: Colors[colorScheme ?? 'light'].border,
                    },
                  ]}
                >
                  <View style={styles.contactHeader}>
                    <View style={styles.contactNameColumn}>
                      <Text
                        style={[
                          styles.contactName,
                          { color: Colors[colorScheme ?? 'light'].text },
                        ]}
                      >
                        {contact.name}
                      </Text>
                      {contact.role && (
                        <Text
                          style={[
                            styles.contactRole,
                            { color: Colors[colorScheme ?? 'light'].textSecondary },
                          ]}
                        >
                          {contact.role}
                        </Text>
                      )}
                    </View>
                    <View style={styles.contactActions}>
                      <TouchableOpacity
                        onPress={() => openEditModal(contact)}
                        style={styles.actionButton}
                      >
                        <Ionicons
                          name="pencil"
                          size={20}
                          color={Colors[colorScheme ?? 'light'].primary}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDelete(contact)}
                        style={styles.actionButton}
                      >
                        <Ionicons name="trash-outline" size={20} color="#ff4444" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.contactDetails}>
                    {contact.phone_number && (
                      <TouchableOpacity
                        style={styles.detailRow}
                        onPress={() => handleCall(contact.phone_number!)}
                      >
                        <Ionicons
                          name="call-outline"
                          size={16}
                          color={Colors[colorScheme ?? 'light'].primary}
                        />
                        <Text
                          style={[
                            styles.detailText,
                            styles.detailLink,
                            { color: Colors[colorScheme ?? 'light'].primary },
                          ]}
                        >
                          {contact.phone_number}
                        </Text>
                      </TouchableOpacity>
                    )}
                    {contact.email && (
                      <TouchableOpacity
                        style={styles.detailRow}
                        onPress={() => handleEmail(contact.email!)}
                      >
                        <Ionicons
                          name="mail-outline"
                          size={16}
                          color={Colors[colorScheme ?? 'light'].primary}
                        />
                        <Text
                          style={[
                            styles.detailText,
                            styles.detailLink,
                            { color: Colors[colorScheme ?? 'light'].primary },
                          ]}
                        >
                          {contact.email}
                        </Text>
                      </TouchableOpacity>
                    )}
                    {contact.notes && (
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
                          {contact.notes}
                        </Text>
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
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: Colors[colorScheme ?? 'light'].cardBackground },
            ]}
          >
            <KeyboardAwareScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
                {editingContact ? 'Edit Contact' : 'New Contact'}
              </Text>

              <Text style={[styles.inputLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
                Name *
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
                placeholder="e.g., Ms. Johnson"
                placeholderTextColor={Colors[colorScheme ?? 'light'].textSecondary}
                value={name}
                onChangeText={setName}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />

              <Text style={[styles.inputLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
                Role
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
                placeholder="e.g., Teacher, Coach, Doctor"
                placeholderTextColor={Colors[colorScheme ?? 'light'].textSecondary}
                value={role}
                onChangeText={setRole}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />

              <Text style={[styles.inputLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
                Phone Number
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
                placeholder="e.g., (555) 123-4567"
                placeholderTextColor={Colors[colorScheme ?? 'light'].textSecondary}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />

              <Text style={[styles.inputLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
                Email
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
                placeholder="e.g., teacher@school.edu"
                placeholderTextColor={Colors[colorScheme ?? 'light'].textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
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
                inputAccessoryViewID={Platform.OS === 'ios' ? notesAccessoryId : undefined}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.cancelModalButton,
                    { borderColor: Colors[colorScheme ?? 'light'].border },
                  ]}
                  onPress={() => setModalVisible(false)}
                  disabled={saveContact.isPending}
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
                  disabled={saveContact.isPending}
                >
                  {saveContact.isPending ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.saveButtonText}>
                      {editingContact ? 'Update' : 'Save'}
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
  contactsList: { gap: 15, paddingBottom: 30 },
  contactCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 15,
  },
  contactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  contactNameColumn: { flex: 1, marginRight: 10 },
  contactName: { fontSize: 18, fontWeight: 'bold' },
  contactRole: { fontSize: 14, fontStyle: 'italic', marginTop: 2 },
  contactActions: { flexDirection: 'row', gap: 8 },
  actionButton: { padding: 4 },
  contactDetails: { gap: 8, marginTop: 4 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailText: { fontSize: 14, flex: 1 },
  detailLink: { fontWeight: '600' },
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
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 20 },
  modalButton: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  cancelModalButton: { backgroundColor: 'transparent', borderWidth: 1 },
  saveModalButton: {},
  cancelButtonText: { fontSize: 16, fontWeight: '600' },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
