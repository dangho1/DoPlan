import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  useAddConversationParticipants,
  useConversation,
  useLeaveConversation,
  useRemoveConversationParticipant,
} from "@/hooks/queries/useConversations";
import { useFriends } from "@/hooks/queries/useFriendships";
import {
  useMarkMessagesRead,
  useMessages,
  useSendMessage,
} from "@/hooks/queries/useMessages";
import { supabase } from "@/lib/supabase";
import type { Message } from "@/lib/types";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";

export default function ChatConversationScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const router = useRouter();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { conversationId, friendId, friendName, title } = useLocalSearchParams<{
    conversationId?: string;
    friendId?: string;
    friendName?: string;
    title?: string;
  }>();

  const { data: currentUser } = useCurrentUser();
  const currentUserId = currentUser?.id;
  const { data: conversation } = useConversation(
    conversationId,
    currentUserId,
  );
  const { data: friends = [] } = useFriends(currentUserId);
  const addParticipants = useAddConversationParticipants(currentUserId);
  const removeParticipant = useRemoveConversationParticipant(currentUserId);
  const leaveConversation = useLeaveConversation(currentUserId);

  const effectiveFriendId =
    conversation?.participant_ids.find((id) => id !== currentUserId) ??
    friendId ??
    "";
  const displayTitle = conversation?.title || title || friendName || "Chat";
  const participantCount = conversation?.participant_ids.length ?? 0;
  const participantLabel =
    participantCount > 0
      ? `${participantCount} ${participantCount === 1 ? "member" : "members"}`
      : "Conversation";
  const memberNames = useMemo(
    () =>
      new Map(
        conversation?.members.map((member) => [
          member.user_id,
          member.display_name,
        ]) ?? [],
      ),
    [conversation?.members],
  );
  const availableFriends = useMemo(
    () =>
      friends.filter(
        (friend) => !conversation?.participant_ids.includes(friend.user_id),
      ),
    [conversation?.participant_ids, friends],
  );

  const { data: messages = [], isLoading } = useMessages(
    currentUserId,
    effectiveFriendId,
    conversationId,
  );
  const sendMessage = useSendMessage(
    currentUserId,
    effectiveFriendId,
    conversationId,
  );
  const { mutate: markMessagesRead } = useMarkMessagesRead(
    currentUserId,
    effectiveFriendId,
    conversationId,
  );

  const [newMessage, setNewMessage] = useState("");
  const [manageModalVisible, setManageModalVisible] = useState(false);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const flatListRef = useRef<FlatList>(null);
  const { height: keyboardHeight } = useReanimatedKeyboardAnimation();

  const listContainerStyle = useAnimatedStyle(() => ({
    flex: 1,
    marginBottom: Math.abs(keyboardHeight.value),
  }));

  useEffect(() => {
    navigation.setOptions({
      headerBackTitle: "Chats",
      headerTitle: () => (
        <View style={styles.headerTitleContainer}>
          <Text
            numberOfLines={1}
            style={styles.headerTitle}
          >
            {displayTitle}
          </Text>
          <Text style={styles.headerSubtitle}>{participantLabel}</Text>
        </View>
      ),
      headerRight: () => (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Manage chat"
          onPress={() => setManageModalVisible(true)}
          style={styles.headerButton}
        >
          <Ionicons
            name="settings-outline"
            size={24}
            color="black"
            style={styles.headerButtonIcon}
          />
        </TouchableOpacity>
      ),
    });
  }, [displayTitle, navigation, participantLabel]);

  useEffect(() => {
    if (!currentUserId || !effectiveFriendId) return;

    markMessagesRead();

    const queryKey = [
      "messages",
      conversationId ?? effectiveFriendId,
      currentUserId,
      effectiveFriendId,
    ];

    // Unique per-mount suffix: `removeChannel` unsubscribes asynchronously, so a
    // fast unmount/remount (e.g. leaving/deleting the chat right after this
    // screen mounted) can call `.channel()` again before the previous instance's
    // teardown lands, resurrecting a channel that's still mid-`subscribe()` and
    // throwing on `.on()`. A unique topic per effect run avoids that race.
    const instanceId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const channel = supabase
      .channel(`messages_${conversationId ?? effectiveFriendId}_${instanceId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: conversationId
            ? `conversation_id=eq.${conversationId}`
            : `sender_id=eq.${effectiveFriendId},receiver_id=eq.${currentUserId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          queryClient.setQueryData<Message[]>(queryKey, (old = []) => {
            if (old.some((message) => message.id === newMsg.id)) return old;
            return [...old, newMsg];
          });
          markMessagesRead();
          setTimeout(
            () => flatListRef.current?.scrollToEnd({ animated: true }),
            100,
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages" },
        (payload) => {
          queryClient.setQueryData<Message[]>(queryKey, (old = []) =>
            old.filter((message) => message.id !== payload.old.id),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        (payload) => {
          queryClient.setQueryData<Message[]>(queryKey, (old = []) =>
            old.map((message) =>
              message.id === payload.new.id
                ? (payload.new as Message)
                : message,
            ),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    conversationId,
    currentUserId,
    effectiveFriendId,
    markMessagesRead,
    queryClient,
  ]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(
        () => flatListRef.current?.scrollToEnd({ animated: false }),
        100,
      );
    }
  }, [isLoading, messages.length]);

  const handleSend = () => {
    if (!newMessage.trim() || sendMessage.isPending || !effectiveFriendId) {
      return;
    }

    const content = newMessage.trim();
    setNewMessage("");
    sendMessage.mutate(content, {
      onError: () => setNewMessage(content),
    });
  };

  const toggleSelectedFriend = (participantId: string) => {
    setSelectedFriendIds((current) =>
      current.includes(participantId)
        ? current.filter((id) => id !== participantId)
        : [...current, participantId],
    );
  };

  const handleAddSelectedParticipants = () => {
    if (!conversationId || selectedFriendIds.length === 0) return;

    addParticipants.mutate(
      { conversationId, participantIds: selectedFriendIds },
      {
        onSuccess: () => {
          Alert.alert(
            "Added",
            `${selectedFriendIds.length} ${
              selectedFriendIds.length === 1 ? "person was" : "people were"
            } added to the chat.`,
          );
          setSelectedFriendIds([]);
        },
        onError: (error) =>
          Alert.alert(
            "Could not add people",
            error instanceof Error ? error.message : "Please try again.",
          ),
      },
    );
  };

  const handleRemoveParticipant = (participantId: string, name: string) => {
    if (!conversationId || participantId === currentUserId) return;

    Alert.alert("Remove from chat", `Remove ${name} from this chat?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () =>
          removeParticipant.mutate(
            { conversationId, participantId },
            {
              onError: (error) =>
                Alert.alert(
                  "Could not remove person",
                  error instanceof Error ? error.message : "Please try again.",
                ),
            },
          ),
      },
    ]);
  };

  const handleLeaveConversation = () => {
    if (!conversationId) return;

    const isGroup = participantCount > 2;
    Alert.alert(
      isGroup ? "Leave chat" : "Delete chat",
      isGroup
        ? "You will no longer see this chat or receive new messages from it."
        : "This is a two-person chat. Deleting it removes the chat and its messages for both people.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: isGroup ? "Leave" : "Delete",
          style: "destructive",
          onPress: () =>
            leaveConversation.mutate(conversationId, {
              onSuccess: () => {
                setManageModalVisible(false);
                router.replace("/(tabs)/friends");
              },
              onError: (error) =>
                Alert.alert(
                  "Could not update chat",
                  error instanceof Error ? error.message : "Please try again.",
                ),
            }),
        },
      ],
    );
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMyMessage = item.sender_id === currentUserId;
    const senderName = isMyMessage
      ? "You"
      : memberNames.get(item.sender_id) || friendName || "Unknown sender";
    const sentAt = new Date(item.created_at ?? "").toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    return (
      <View
        style={[
          styles.messageContainer,
          isMyMessage
            ? styles.myMessageContainer
            : styles.theirMessageContainer,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            {
              backgroundColor: isMyMessage
                ? colors.tint
                : colors.tabIconDefault + "20",
            },
          ]}
        >
          <Text
            style={[
              styles.messageText,
              { color: isMyMessage ? "white" : colors.text },
            ]}
          >
            {item.content}
          </Text>
        </View>
        <Text
          style={[
            styles.messageMeta,
            { color: colors.textSecondary },
            isMyMessage ? styles.myMessageMeta : styles.theirMessageMeta,
          ]}
        >
          {senderName} · {sentAt}
        </Text>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.tint} />
          <Text style={{ color: colors.text }}>Loading messages...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.View style={listContainerStyle}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          inverted
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={[styles.emptyStateText, { color: colors.tabIconDefault }]}>
                No messages yet. Start the conversation!
              </Text>
            </View>
          }
        />

        <View
          style={[styles.inputContainer, { borderTopColor: colors.tabIconDefault }]}
        >
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.background,
                color: colors.text,
                borderColor: colors.tabIconDefault,
              },
            ]}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Type a message..."
            placeholderTextColor={colors.tabIconDefault}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              {
                backgroundColor: colors.tint,
                opacity:
                  !newMessage.trim() || sendMessage.isPending || !effectiveFriendId
                    ? 0.5
                    : 1,
              },
            ]}
            onPress={handleSend}
            disabled={
              !newMessage.trim() || sendMessage.isPending || !effectiveFriendId
            }
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Modal
        visible={manageModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setManageModalVisible(false)}
      >
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={{ backgroundColor: colors.background }}
          contentContainerStyle={styles.manageContent}
        >
          <View style={styles.manageHeader}>
            <Text style={[styles.manageTitle, { color: colors.text }]}>Chat details</Text>
            <TouchableOpacity onPress={() => setManageModalVisible(false)}>
              <Text style={[styles.doneText, { color: colors.tint }]}>Done</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Members</Text>
            {conversation?.members.map((member) => (
              <View
                key={member.user_id}
                style={[styles.row, { borderBottomColor: colors.tabIconDefault }]}
              >
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: colors.text }]}>
                    {member.display_name}
                    {member.user_id === currentUserId ? " (You)" : ""}
                  </Text>
                  <Text style={[styles.rowSubtitle, { color: colors.tabIconDefault }]}>
                    {member.email}
                  </Text>
                </View>
                {member.user_id !== currentUserId && participantCount > 2 && (
                  <TouchableOpacity
                    style={styles.removeButton}
                    disabled={removeParticipant.isPending}
                    onPress={() =>
                      handleRemoveParticipant(member.user_id, member.display_name)
                    }
                  >
                    <Text style={styles.removeButtonText}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Add a friend</Text>
            {availableFriends.length === 0 ? (
              <Text style={[styles.helpText, { color: colors.tabIconDefault }]}>
                All of your friends are already in this chat.
              </Text>
            ) : (
              availableFriends.map((friend) => (
                <View
                  key={friend.user_id}
                  style={[styles.row, { borderBottomColor: colors.tabIconDefault }]}
                >
                  <View style={styles.rowText}>
                    <Text style={[styles.rowTitle, { color: colors.text }]}>
                      {friend.display_name}
                    </Text>
                    <Text style={[styles.rowSubtitle, { color: colors.tabIconDefault }]}>
                      {friend.email}
                    </Text>
                  </View>
                  <TouchableOpacity
                    accessibilityRole="checkbox"
                    accessibilityState={{
                      checked: selectedFriendIds.includes(friend.user_id),
                    }}
                    style={[
                      styles.selectButton,
                      {
                        borderColor: colors.tint,
                        backgroundColor: selectedFriendIds.includes(friend.user_id)
                          ? colors.tint
                          : "transparent",
                      },
                    ]}
                    disabled={addParticipants.isPending}
                    onPress={() => toggleSelectedFriend(friend.user_id)}
                  >
                    <Text
                      style={[
                        styles.selectButtonText,
                        {
                          color: selectedFriendIds.includes(friend.user_id)
                            ? "white"
                            : colors.tint,
                        },
                      ]}
                    >
                      {selectedFriendIds.includes(friend.user_id) ? "Selected" : "Select"}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
            {availableFriends.length > 0 && (
              <TouchableOpacity
                style={[
                  styles.addSelectedButton,
                  {
                    backgroundColor: colors.tint,
                    opacity:
                      selectedFriendIds.length === 0 || addParticipants.isPending
                        ? 0.5
                        : 1,
                  },
                ]}
                disabled={selectedFriendIds.length === 0 || addParticipants.isPending}
                onPress={handleAddSelectedParticipants}
              >
                <Text style={styles.addSelectedButtonText}>
                  {addParticipants.isPending
                    ? "Adding..."
                    : `Add ${selectedFriendIds.length || "selected"}`}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={styles.destructiveButton}
            disabled={leaveConversation.isPending}
            onPress={handleLeaveConversation}
          >
            <Text style={styles.destructiveButtonText}>
              {leaveConversation.isPending
                ? "Updating..."
                : participantCount > 2
                  ? "Leave chat"
                  : "Delete chat"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerButtonIcon: { transform: [{ translateY: 1, }], marginBottom: 10 },
  headerTitleContainer: {
    maxWidth: 210,
    alignItems: "center",
    gap: 1,
  },
  headerTitle: { color: "white", fontSize: 17, fontWeight: "700" },
  headerSubtitle: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 11,
    fontWeight: "500",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  messagesList: { padding: 16 },
  messageContainer: { marginVertical: 5, maxWidth: "78%" },
  myMessageContainer: { alignSelf: "flex-end" },
  theirMessageContainer: { alignSelf: "flex-start" },
  messageBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderCurve: "continuous",
  },
  messageText: { fontSize: 16, lineHeight: 21 },
  messageMeta: { fontSize: 11, paddingTop: 4, fontWeight: "500" },
  myMessageMeta: { alignSelf: "flex-end", paddingRight: 4 },
  theirMessageMeta: { alignSelf: "flex-start", paddingLeft: 4 },
  emptyState: { padding: 32, alignItems: "center" },
  emptyStateText: { fontSize: 16, textAlign: "center" },
  inputContainer: {
    flexDirection: "row",
    padding: 12,
    borderTopWidth: 1,
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    paddingHorizontal: 20,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonText: { color: "white", fontWeight: "bold", fontSize: 16 },
  manageContent: { padding: 20, gap: 28 },
  manageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  manageTitle: { fontSize: 24, fontWeight: "700" },
  doneText: { fontSize: 17, fontWeight: "600" },
  section: { gap: 4 },
  sectionTitle: { fontSize: 17, fontWeight: "700", paddingBottom: 8 },
  row: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: "600" },
  rowSubtitle: { fontSize: 14 },
  helpText: { fontSize: 15, lineHeight: 21 },
  selectButton: {
    minWidth: 86,
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    borderWidth: 1,
  },
  selectButtonText: { fontWeight: "700" },
  addSelectedButton: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    marginTop: 10,
  },
  addSelectedButtonText: { color: "white", fontSize: 16, fontWeight: "700" },
  removeButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 },
  removeButtonText: { color: "#dc2626", fontWeight: "700" },
  destructiveButton: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "#dc2626",
  },
  destructiveButtonText: { color: "white", fontSize: 16, fontWeight: "700" },
});
