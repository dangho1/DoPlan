import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  useAcceptFriendRequest,
  useCancelSentRequest,
  useDenyFriendRequest,
  useFriendRequests,
  useFriends,
  useRemoveFriend,
  useSendFriendRequest,
  useSentRequests,
} from "@/hooks/queries/useFriendships";
import type { FriendRequest, FriendWithMessages, UserSearchResult } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function FriendshipsScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.id;

  const {
    data: friends = [],
    isLoading: loadingFriends,
    refetch: refetchFriends,
    isRefetching: isRefetchingFriends,
  } = useFriends(userId);

  const {
    data: friendRequests = [],
    refetch: refetchRequests,
    isRefetching: isRefetchingRequests,
  } = useFriendRequests(userId);

  const {
    data: sentRequests = [],
    refetch: refetchSent,
    isRefetching: isRefetchingSent,
  } = useSentRequests(userId);

  const sendFriendRequest = useSendFriendRequest(userId);
  const acceptFriendRequest = useAcceptFriendRequest(userId);
  const denyFriendRequest = useDenyFriendRequest(userId);
  const cancelSentRequest = useCancelSentRequest(userId);
  const removeFriend = useRemoveFriend(userId);

  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const refreshing = isRefetchingFriends || isRefetchingRequests || isRefetchingSent;

  useEffect(() => {
    if (!userId) return;

    const friendshipSub = supabase
      .channel("friendships_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friendships" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["friends", userId] });
          queryClient.invalidateQueries({ queryKey: ["friendRequests", userId] });
          queryClient.invalidateQueries({ queryKey: ["sentRequests", userId] });
        },
      )
      .subscribe();

    const messageSub = supabase
      .channel("messages_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["friends", userId] });
        },
      )
      .subscribe();

    return () => {
      friendshipSub.unsubscribe();
      messageSub.unsubscribe();
    };
  }, [userId, queryClient]);

  const onRefresh = async () => {
    await Promise.all([refetchFriends(), refetchRequests(), refetchSent()]);
  };

  const searchUsers = async () => {
    if (!searchQuery.trim() || !userId) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      const { data, error } = await supabase
        .from("user_profiles")
        .select("user_id, display_name, email, avatar_url")
        .ilike("email", `%${searchQuery.trim()}%`)
        .neq("user_id", userId)
        .limit(10);

      if (error) {
        Alert.alert("Error", "Failed to search users");
        return;
      }

      setSearchResults((data ?? []) as UserSearchResult[]);
      if (!data?.length) Alert.alert("No Results", "No users found with that email");
    } catch {
      Alert.alert("Error", "Failed to search users");
    } finally {
      setSearching(false);
    }
  };

  const handleSendFriendRequest = (targetUserId: string) => {
    sendFriendRequest.mutate(targetUserId, {
      onSuccess: () => {
        Alert.alert("Success", "Friend request sent!");
        setSearchModalVisible(false);
        setSearchQuery("");
        setSearchResults([]);
      },
      onError: (err) => {
        Alert.alert("Info", err instanceof Error ? err.message : "Failed to send friend request");
      },
    });
  };

  const handleAcceptRequest = (friendshipId: string) => {
    acceptFriendRequest.mutate(friendshipId, {
      onSuccess: () => Alert.alert("Success", "Friend request accepted!"),
      onError: () => Alert.alert("Error", "Failed to accept friend request"),
    });
  };

  const handleDenyRequest = (friendshipId: string) => {
    denyFriendRequest.mutate(friendshipId, {
      onError: () => Alert.alert("Error", "Failed to deny friend request"),
    });
  };

  const handleCancelRequest = (friendshipId: string) => {
    cancelSentRequest.mutate(friendshipId, {
      onError: () => Alert.alert("Error", "Failed to cancel friend request"),
    });
  };

  const handleRemoveFriend = (friendshipId: string, friendName: string) => {
    Alert.alert("Remove Friend", `Are you sure you want to remove ${friendName}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          removeFriend.mutate(friendshipId, {
            onError: () => Alert.alert("Error", "Failed to remove friend"),
          });
        },
      },
    ]);
  };

  const renderFriend = ({ item }: { item: FriendWithMessages }) => (
    <TouchableOpacity
      style={[
        styles.friendItem,
        { borderBottomColor: Colors[colorScheme ?? "light"].tabIconDefault },
      ]}
      onPress={() =>
        router.push({
          pathname: "/chat/[friendId]",
          params: { friendId: item.user_id, friendName: item.display_name },
        })
      }
    >
      <View style={styles.friendInfo}>
        <View style={styles.friendHeader}>
          <Text
            style={[styles.friendName, { color: Colors[colorScheme ?? "light"].text }]}
          >
            {item.display_name}
          </Text>
          {item.unread_count > 0 && (
            <View
              style={[
                styles.unreadBadge,
                { backgroundColor: Colors[colorScheme ?? "light"].tint },
              ]}
            >
              <Text style={styles.unreadBadgeText}>{item.unread_count}</Text>
            </View>
          )}
        </View>
        {item.last_message ? (
          <Text
            style={[
              styles.lastMessage,
              { color: Colors[colorScheme ?? "light"].tabIconDefault },
            ]}
            numberOfLines={1}
          >
            {item.last_message}
          </Text>
        ) : (
          <Text
            style={[
              styles.noMessages,
              { color: Colors[colorScheme ?? "light"].tabIconDefault },
            ]}
          >
            No messages yet - Tap to chat!
          </Text>
        )}
        {item.last_message_time && (
          <Text
            style={[
              styles.messageTime,
              { color: Colors[colorScheme ?? "light"].tabIconDefault },
            ]}
          >
            {new Date(item.last_message_time).toLocaleString()}
          </Text>
        )}
      </View>
      <Text
        style={[styles.chevron, { color: Colors[colorScheme ?? "light"].tabIconDefault }]}
      >
        ›
      </Text>
    </TouchableOpacity>
  );

  const renderFriendRequest = ({ item }: { item: FriendRequest }) => (
    <View
      style={[
        styles.requestItem,
        { borderBottomColor: Colors[colorScheme ?? "light"].tabIconDefault },
      ]}
    >
      <View style={styles.requestInfo}>
        <Text
          style={[styles.requestName, { color: Colors[colorScheme ?? "light"].text }]}
        >
          {item.display_name}
        </Text>
        <Text
          style={[
            styles.requestEmail,
            { color: Colors[colorScheme ?? "light"].tabIconDefault },
          ]}
        >
          {item.email}
        </Text>
        <Text
          style={[
            styles.requestTime,
            { color: Colors[colorScheme ?? "light"].tabIconDefault },
          ]}
        >
          {item.created_at ? new Date(item.created_at).toLocaleDateString() : ""}
        </Text>
      </View>
      <View style={styles.requestActions}>
        <TouchableOpacity
          style={[styles.acceptButton, { backgroundColor: "#22c55e" }]}
          onPress={() => handleAcceptRequest(item.friendship_id)}
        >
          <Text style={styles.actionButtonText}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.denyButton, { backgroundColor: "#ef4444" }]}
          onPress={() => handleDenyRequest(item.friendship_id)}
        >
          <Text style={styles.actionButtonText}>Deny</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSentRequest = ({ item }: { item: FriendRequest }) => (
    <View
      style={[
        styles.requestItem,
        { borderBottomColor: Colors[colorScheme ?? "light"].tabIconDefault },
      ]}
    >
      <View style={styles.requestInfo}>
        <Text
          style={[styles.requestName, { color: Colors[colorScheme ?? "light"].text }]}
        >
          {item.display_name}
        </Text>
        <Text
          style={[
            styles.requestEmail,
            { color: Colors[colorScheme ?? "light"].tabIconDefault },
          ]}
        >
          {item.email}
        </Text>
        <Text
          style={[
            styles.requestTime,
            { color: Colors[colorScheme ?? "light"].tabIconDefault },
          ]}
        >
          Sent {item.created_at ? new Date(item.created_at).toLocaleDateString() : ""}
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.cancelButton, { backgroundColor: "#6b7280" }]}
        onPress={() => handleCancelRequest(item.friendship_id)}
      >
        <Text style={styles.actionButtonText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSearchResult = ({ item }: { item: UserSearchResult }) => (
    <TouchableOpacity
      style={[
        styles.searchResultItem,
        { borderBottomColor: Colors[colorScheme ?? "light"].tabIconDefault },
      ]}
      onPress={() => handleSendFriendRequest(item.user_id)}
    >
      <View style={styles.searchResultInfo}>
        <Text
          style={[
            styles.searchResultName,
            { color: Colors[colorScheme ?? "light"].text },
          ]}
        >
          {item.display_name}
        </Text>
        <Text
          style={[
            styles.searchResultEmail,
            { color: Colors[colorScheme ?? "light"].tabIconDefault },
          ]}
        >
          {item.email}
        </Text>
      </View>
      <TouchableOpacity
        style={[
          styles.addButton,
          { backgroundColor: Colors[colorScheme ?? "light"].tint },
        ]}
        onPress={() => handleSendFriendRequest(item.user_id)}
      >
        <Text style={styles.addButtonText}>Add</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (loadingFriends) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: Colors[colorScheme ?? "light"].background },
        ]}
      >
        <View
          style={[
            styles.header,
            { backgroundColor: Colors[colorScheme ?? "light"].tint },
          ]}
        >
          <Text style={styles.headerTitle}>Friends</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={{ color: Colors[colorScheme ?? "light"].text }}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: Colors[colorScheme ?? "light"].background },
      ]}
    >
      <View
        style={[
          styles.header,
          { backgroundColor: Colors[colorScheme ?? "light"].tint },
        ]}
      >
        <Text style={styles.headerTitle}>Messages</Text>
        <TouchableOpacity
          style={styles.addFriendButton}
          onPress={() => setSearchModalVisible(true)}
        >
          <Text style={styles.addFriendButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={[]}
        renderItem={() => null}
        ListHeaderComponent={
          <>
            {friendRequests.length > 0 && (
              <View style={styles.section}>
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: Colors[colorScheme ?? "light"].text },
                  ]}
                >
                  Friend Requests ({friendRequests.length})
                </Text>
                {friendRequests.map((request) => (
                  <View key={request.friendship_id}>
                    {renderFriendRequest({ item: request })}
                  </View>
                ))}
              </View>
            )}

            {sentRequests.length > 0 && (
              <View style={styles.section}>
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: Colors[colorScheme ?? "light"].text },
                  ]}
                >
                  Sent Requests ({sentRequests.length})
                </Text>
                {sentRequests.map((request) => (
                  <View key={request.friendship_id}>
                    {renderSentRequest({ item: request })}
                  </View>
                ))}
              </View>
            )}

            <View style={styles.section}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: Colors[colorScheme ?? "light"].text },
                ]}
              >
                Conversations ({friends.length})
              </Text>
              {friends.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text
                    style={[
                      styles.emptyStateText,
                      { color: Colors[colorScheme ?? "light"].tabIconDefault },
                    ]}
                  >
                    No friends yet. Tap + to add friends and start chatting!
                  </Text>
                </View>
              ) : (
                friends.map((friend) => (
                  <View key={friend.friendship_id}>
                    {renderFriend({ item: friend })}
                  </View>
                ))
              )}
            </View>
          </>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors[colorScheme ?? "light"].tint}
          />
        }
      />

      <Modal
        visible={searchModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: Colors[colorScheme ?? "light"].background },
          ]}
        >
          <View
            style={[
              styles.modalHeader,
              {
                borderBottomColor: Colors[colorScheme ?? "light"].tabIconDefault,
              },
            ]}
          >
            <TouchableOpacity
              onPress={() => {
                setSearchModalVisible(false);
                setSearchQuery("");
                setSearchResults([]);
              }}
            >
              <Text
                style={[
                  styles.modalCancelText,
                  { color: Colors[colorScheme ?? "light"].tint },
                ]}
              >
                Cancel
              </Text>
            </TouchableOpacity>
            <Text
              style={[
                styles.modalTitle,
                { color: Colors[colorScheme ?? "light"].text },
              ]}
            >
              Add Family Member
            </Text>
            <View style={styles.modalHeaderPlaceholder} />
          </View>

          <View style={styles.searchContainer}>
            <TextInput
              style={[
                styles.searchInput,
                {
                  backgroundColor: Colors[colorScheme ?? "light"].background,
                  color: Colors[colorScheme ?? "light"].text,
                  borderColor: Colors[colorScheme ?? "light"].tabIconDefault,
                },
              ]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by email..."
              placeholderTextColor={Colors[colorScheme ?? "light"].tabIconDefault}
              onSubmitEditing={searchUsers}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TouchableOpacity
              style={[
                styles.searchButton,
                { backgroundColor: Colors[colorScheme ?? "light"].tint },
              ]}
              onPress={searchUsers}
              disabled={searching}
            >
              <Text style={styles.searchButtonText}>{searching ? "..." : "Search"}</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={searchResults}
            renderItem={renderSearchResult}
            keyExtractor={(item) => item.user_id}
            style={styles.searchResultsList}
            contentContainerStyle={styles.searchResultsContent}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    paddingTop: 50,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
    flex: 1,
    textAlign: "center",
  },
  addFriendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  addFriendButtonText: { color: "white", fontSize: 24, fontWeight: "bold" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  section: { paddingTop: 16 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  friendItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  friendInfo: { flex: 1 },
  friendHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  friendName: { fontSize: 16, fontWeight: "600", marginRight: 8 },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  unreadBadgeText: { color: "white", fontSize: 12, fontWeight: "bold" },
  lastMessage: { fontSize: 14, marginBottom: 4 },
  noMessages: { fontSize: 14, marginBottom: 4, fontStyle: "italic" },
  messageTime: { fontSize: 12 },
  chevron: { fontSize: 24, marginLeft: 8 },
  requestItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  requestInfo: { flex: 1 },
  requestName: { fontSize: 16, fontWeight: "600", marginBottom: 4 },
  requestEmail: { fontSize: 14, marginBottom: 2 },
  requestTime: { fontSize: 12 },
  requestActions: { flexDirection: "row", gap: 8 },
  acceptButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  denyButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  actionButtonText: { color: "white", fontWeight: "bold", fontSize: 12 },
  emptyState: { padding: 32, alignItems: "center" },
  emptyStateText: { fontSize: 16, textAlign: "center" },
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    paddingTop: 50,
    borderBottomWidth: 1,
  },
  modalCancelText: { fontSize: 16 },
  modalTitle: { fontSize: 18, fontWeight: "bold" },
  modalHeaderPlaceholder: { width: 60 },
  searchContainer: {
    flexDirection: "row",
    padding: 16,
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 8,
    fontSize: 16,
  },
  searchButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  searchButtonText: { color: "white", fontWeight: "bold" },
  searchResultsList: { flex: 1 },
  searchResultsContent: { padding: 16 },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  searchResultInfo: { flex: 1 },
  searchResultName: { fontSize: 16, fontWeight: "500", marginBottom: 2 },
  searchResultEmail: { fontSize: 14 },
  addButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  addButtonText: { color: "white", fontWeight: "bold" },
});
