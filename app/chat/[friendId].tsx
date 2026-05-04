import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  useMarkMessagesRead,
  useMessages,
  useSendMessage,
} from '@/hooks/queries/useMessages';
import type { Message } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function ChatConversationScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { friendId, friendName } = useLocalSearchParams<{
    friendId: string;
    friendName: string;
  }>();

  const { data: currentUser } = useCurrentUser();
  const currentUserId = currentUser?.id;

  const { data: messages = [], isLoading } = useMessages(currentUserId, friendId);
  const sendMessage = useSendMessage(currentUserId, friendId);
  const markRead = useMarkMessagesRead(currentUserId, friendId);

  const [newMessage, setNewMessage] = React.useState('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!currentUserId || !friendId) return;

    markRead.mutate();

    const queryKey = ['messages', currentUserId, friendId];

    const channel = supabase
      .channel(`messages_${currentUserId}_${friendId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${friendId},receiver_id=eq.${currentUserId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          queryClient.setQueryData<Message[]>(queryKey, (old = []) => {
            if (old.some((m) => m.id === newMsg.id)) return old;
            return [...old, newMsg];
          });
          markRead.mutate();
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${currentUserId},receiver_id=eq.${friendId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          queryClient.setQueryData<Message[]>(queryKey, (old = []) => {
            if (old.some((m) => m.id === newMsg.id)) return old;
            return [...old, newMsg];
          });
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages' },
        (payload) => {
          queryClient.setQueryData<Message[]>(queryKey, (old = []) =>
            old.filter((m) => m.id !== payload.old.id),
          );
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          queryClient.setQueryData<Message[]>(queryKey, (old = []) =>
            old.map((m) => (m.id === payload.new.id ? (payload.new as Message) : m)),
          );
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [currentUserId, friendId]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [isLoading]);

  const handleSend = () => {
    if (!newMessage.trim() || sendMessage.isPending) return;

    const content = newMessage.trim();
    setNewMessage('');

    sendMessage.mutate(content, {
      onError: () => setNewMessage(content),
    });

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMyMessage = item.sender_id === currentUserId;

    return (
      <View
        style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessageContainer : styles.theirMessageContainer,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isMyMessage
              ? { backgroundColor: Colors[colorScheme ?? 'light'].tint }
              : { backgroundColor: Colors[colorScheme ?? 'light'].tabIconDefault + '20' },
          ]}
        >
          <Text
            style={[
              styles.messageText,
              { color: isMyMessage ? 'white' : Colors[colorScheme ?? 'light'].text },
            ]}
          >
            {item.content}
          </Text>
          <Text
            style={[
              styles.messageTime,
              {
                color: isMyMessage
                  ? 'rgba(255,255,255,0.7)'
                  : Colors[colorScheme ?? 'light'].tabIconDefault,
              },
            ]}
          >
            {new Date(item.created_at ?? '').toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View
        style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}
      >
        <View style={[styles.header, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{friendName || 'Chat'}</Text>
          <View style={styles.headerPlaceholder} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={{ color: Colors[colorScheme ?? 'light'].text }}>
            Loading messages...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{friendName || 'Chat'}</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text
              style={[
                styles.emptyStateText,
                { color: Colors[colorScheme ?? 'light'].tabIconDefault },
              ]}
            >
              No messages yet. Start the conversation!
            </Text>
          </View>
        }
      />

      <View
        style={[
          styles.inputContainer,
          { borderTopColor: Colors[colorScheme ?? 'light'].tabIconDefault },
        ]}
      >
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: Colors[colorScheme ?? 'light'].background,
              color: Colors[colorScheme ?? 'light'].text,
              borderColor: Colors[colorScheme ?? 'light'].tabIconDefault,
            },
          ]}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Type a message..."
          placeholderTextColor={Colors[colorScheme ?? 'light'].tabIconDefault}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            {
              backgroundColor: Colors[colorScheme ?? 'light'].tint,
              opacity: !newMessage.trim() || sendMessage.isPending ? 0.5 : 1,
            },
          ]}
          onPress={handleSend}
          disabled={!newMessage.trim() || sendMessage.isPending}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 50,
  },
  backButton: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  backButtonText: { color: 'white', fontSize: 28, fontWeight: 'bold' },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    flex: 1,
    textAlign: 'center',
  },
  headerPlaceholder: { width: 36 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  messagesList: { padding: 16 },
  messageContainer: { marginVertical: 4, maxWidth: '75%' },
  myMessageContainer: { alignSelf: 'flex-end' },
  theirMessageContainer: { alignSelf: 'flex-start' },
  messageBubble: { padding: 12, borderRadius: 16 },
  messageText: { fontSize: 16, marginBottom: 4 },
  messageTime: { fontSize: 11, alignSelf: 'flex-end' },
  emptyState: { padding: 32, alignItems: 'center' },
  emptyStateText: { fontSize: 16, textAlign: 'center' },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});
