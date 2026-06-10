import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { supabase } from '@/lib/supabase';

interface User {
  id: string;
  user_id: string;
  display_name: string;
  email: string;
  avatar_url?: string;
}

interface Friend {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted' | 'blocked';
  friend_profile: User;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  created_at: string;
  is_read: boolean;
  sender_profile?: User;
}

interface FriendRequest {
  id: string;
  user_id: string;
  friend_id: string;
  status: string;
  created_at: string;
  user_profile: User;
}

export default function SimpleChat() {
  const colorScheme = useColorScheme();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [friendEmail, setFriendEmail] = useState('');
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'chat'>('friends');
  const [loading, setLoading] = useState(true);

  const messagesRef = useRef<FlatList>(null);

  useEffect(() => {
    initializeUser();
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadFriends();
      loadFriendRequests();
    }
  }, [currentUser]);

  useEffect(() => {
    if (selectedFriend && currentUser) {
      loadMessages();
      subscribeToMessages();
    }
  }, [selectedFriend, currentUser]);

  const initializeUser = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        console.error('Error getting user:', error);
        return;
      }

      // Get or create user profile
      let { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileError && profileError.code === 'PGRST116') {
        // Profile doesn't exist, create it
        const { data: newProfile, error: createError } = await supabase
          .from('user_profiles')
          .insert({
            user_id: user.id,
            display_name: user.user_metadata?.full_name || user.email || 'User',
            email: user.email || '',
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating profile:', createError);
          return;
        }
        profile = newProfile;
      }

      setCurrentUser(profile);
      setLoading(false);
    } catch (error) {
      console.error('Error initializing user:', error);
      setLoading(false);
    }
  };

  const loadFriends = async () => {
    if (!currentUser) return;

    try {
      const { data, error } = await supabase
        .from('friendships')
        .select(`
          *,
          friend_profile:user_profiles!friendships_friend_id_fkey(*)
        `)
        .eq('user_id', currentUser.user_id)
        .eq('status', 'accepted');

      if (error) {
        console.error('Error loading friends:', error);
        return;
      }

      setFriends(data || []);
    } catch (error) {
      console.error('Error loading friends:', error);
    }
  };

  const loadFriendRequests = async () => {
    if (!currentUser) return;

    try {
      const { data, error } = await supabase
        .from('friendships')
        .select(`
          *,
          user_profile:user_profiles!friendships_user_id_fkey(*)
        `)
        .eq('friend_id', currentUser.user_id)
        .eq('status', 'pending');

      if (error) {
        console.error('Error loading friend requests:', error);
        return;
      }

      setFriendRequests(data || []);
    } catch (error) {
      console.error('Error loading friend requests:', error);
    }
  };

  const loadMessages = async () => {
    if (!selectedFriend || !currentUser) return;

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select(`
          *,
          sender_profile:user_profiles!chat_messages_sender_id_fkey(*)
        `)
        .or(`and(sender_id.eq.${currentUser.user_id},receiver_id.eq.${selectedFriend.friend_id}),and(sender_id.eq.${selectedFriend.friend_id},receiver_id.eq.${currentUser.user_id})`)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading messages:', error);
        return;
      }

      setMessages(data || []);
      
      // Mark messages as read
      await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .eq('sender_id', selectedFriend.friend_id)
        .eq('receiver_id', currentUser.user_id)
        .eq('is_read', false);

    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const subscribeToMessages = () => {
    if (!selectedFriend || !currentUser) return;

    const channel = supabase
      .channel('chat_messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `or(and(sender_id.eq.${currentUser.user_id},receiver_id.eq.${selectedFriend.friend_id}),and(sender_id.eq.${selectedFriend.friend_id},receiver_id.eq.${currentUser.user_id}))`,
        },
        async (payload) => {
          const newMessage = payload.new as Message;
          
          // Get sender profile
          const { data: senderProfile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', newMessage.sender_id)
            .single();

          newMessage.sender_profile = senderProfile;
          
          setMessages(prev => [...prev, newMessage]);
          
          // Mark as read if it's from the other person
          if (newMessage.sender_id === selectedFriend.friend_id) {
            await supabase
              .from('chat_messages')
              .update({ is_read: true })
              .eq('id', newMessage.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedFriend || !currentUser) return;

    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          sender_id: currentUser.user_id,
          receiver_id: selectedFriend.friend_id,
          message: newMessage.trim(),
        });

      if (error) {
        console.error('Error sending message:', error);
        Alert.alert('Error', 'Failed to send message');
        return;
      }

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    }
  };

  const sendFriendRequest = async () => {
    if (!friendEmail.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    try {
      const { data, error } = await supabase.rpc('send_friend_request', {
        friend_email: friendEmail.trim(),
      });

      if (error) {
        console.error('Error sending friend request:', error);
        Alert.alert('Error', 'Failed to send friend request');
        return;
      }

      const result = data as { success: boolean; message: string };
      
      if (result.success) {
        Alert.alert('Success', result.message);
        setFriendEmail('');
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
      Alert.alert('Error', 'Failed to send friend request');
    }
  };

  const acceptFriendRequest = async (requestId: string) => {
    try {
      const { data, error } = await supabase.rpc('accept_friend_request', {
        friendship_id: requestId,
      });

      if (error) {
        console.error('Error accepting friend request:', error);
        Alert.alert('Error', 'Failed to accept friend request');
        return;
      }

      const result = data as { success: boolean; message: string };
      
      if (result.success) {
        Alert.alert('Success', result.message);
        loadFriends();
        loadFriendRequests();
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (error) {
      console.error('Error accepting friend request:', error);
      Alert.alert('Error', 'Failed to accept friend request');
    }
  };

  const renderFriendItem = ({ item }: { item: Friend }) => (
    <TouchableOpacity
      style={[styles.friendItem, { borderColor: Colors[colorScheme ?? 'light'].border }]}
      onPress={() => {
        setSelectedFriend(item);
        setActiveTab('chat');
      }}
    >
      <Text style={[styles.friendName, { color: Colors[colorScheme ?? 'light'].text }]}>
        {item.friend_profile.display_name}
      </Text>
      <Text style={[styles.friendEmail, { color: Colors[colorScheme ?? 'light'].text }]}>
        {item.friend_profile.email}
      </Text>
    </TouchableOpacity>
  );

  const renderFriendRequestItem = ({ item }: { item: FriendRequest }) => (
    <View style={[styles.requestItem, { borderColor: Colors[colorScheme ?? 'light'].border }]}>
      <View style={styles.requestInfo}>
        <Text style={[styles.friendName, { color: Colors[colorScheme ?? 'light'].text }]}>
          {item.user_profile.display_name}
        </Text>
        <Text style={[styles.friendEmail, { color: Colors[colorScheme ?? 'light'].text }]}>
          {item.user_profile.email}
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.acceptButton, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]}
        onPress={() => acceptFriendRequest(item.id)}
      >
        <Text style={styles.acceptButtonText}>Accept</Text>
      </TouchableOpacity>
    </View>
  );

  const renderMessageItem = ({ item }: { item: Message }) => {
    const isMyMessage = item.sender_id === currentUser?.user_id;
    
    return (
      <View style={[
        styles.messageContainer,
        isMyMessage ? styles.myMessage : styles.otherMessage
      ]}>
        <Text style={[
          styles.messageText,
          { color: isMyMessage ? '#fff' : Colors[colorScheme ?? 'light'].text }
        ]}>
          {item.message}
        </Text>
        <Text style={[
          styles.messageTime,
          { color: isMyMessage ? '#fff' : Colors[colorScheme ?? 'light'].text }
        ]}>
          {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Text style={{ color: Colors[colorScheme ?? 'light'].text }}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'friends' && styles.activeTab]}
          onPress={() => setActiveTab('friends')}
        >
          <Text style={[styles.tabText, { color: Colors[colorScheme ?? 'light'].text }]}>
            Friends ({friends.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'requests' && styles.activeTab]}
          onPress={() => setActiveTab('requests')}
        >
          <Text style={[styles.tabText, { color: Colors[colorScheme ?? 'light'].text }]}>
            Requests ({friendRequests.length})
          </Text>
        </TouchableOpacity>
        {selectedFriend && (
          <TouchableOpacity
            style={[styles.tab, activeTab === 'chat' && styles.activeTab]}
            onPress={() => setActiveTab('chat')}
          >
            <Text style={[styles.tabText, { color: Colors[colorScheme ?? 'light'].text }]}>
              Chat
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      {activeTab === 'friends' && (
        <View style={styles.content}>
          <View style={styles.addFriendContainer}>
            <TextInput
              style={[styles.input, { 
                borderColor: Colors[colorScheme ?? 'light'].border,
                color: Colors[colorScheme ?? 'light'].text 
              }]}
              placeholder="Enter friend's email"
              placeholderTextColor={Colors[colorScheme ?? 'light'].text + '80'}
              value={friendEmail}
              onChangeText={setFriendEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]}
              onPress={sendFriendRequest}
            >
              <Text style={styles.addButtonText}>Add Friend</Text>
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={friends}
            renderItem={renderFriendItem}
            keyExtractor={(item) => item.id}
            style={styles.list}
            showsVerticalScrollIndicator={false}
          />
        </View>
      )}

      {activeTab === 'requests' && (
        <View style={styles.content}>
          <FlatList
            data={friendRequests}
            renderItem={renderFriendRequestItem}
            keyExtractor={(item) => item.id}
            style={styles.list}
            showsVerticalScrollIndicator={false}
          />
          {friendRequests.length === 0 && (
            <Text style={[styles.emptyText, { color: Colors[colorScheme ?? 'light'].text }]}>
              No friend requests
            </Text>
          )}
        </View>
      )}

      {activeTab === 'chat' && selectedFriend && (
        <KeyboardAvoidingView 
          style={styles.chatContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.chatHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setActiveTab('friends')}
            >
              <Text style={[styles.backButtonText, { color: Colors[colorScheme ?? 'light'].tint }]}>
                ← Back
              </Text>
            </TouchableOpacity>
            <Text style={[styles.chatTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
              {selectedFriend.friend_profile.display_name}
            </Text>
          </View>
          
          <FlatList
            ref={messagesRef}
            data={messages}
            renderItem={renderMessageItem}
            keyExtractor={(item) => item.id}
            style={styles.messagesList}
            onContentSizeChange={() => messagesRef.current?.scrollToEnd()}
            showsVerticalScrollIndicator={false}
          />
          
          <View style={[styles.messageInputContainer, { borderColor: Colors[colorScheme ?? 'light'].border }]}>
            <TextInput
              style={[styles.messageInput, { color: Colors[colorScheme ?? 'light'].text }]}
              placeholder="Type a message..."
              placeholderTextColor={Colors[colorScheme ?? 'light'].text + '80'}
              value={newMessage}
              onChangeText={setNewMessage}
              multiline
              onSubmitEditing={sendMessage}
            />
            <TouchableOpacity
              style={[styles.sendButton, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]}
              onPress={sendMessage}
            >
              <Text style={styles.sendButtonText}>Send</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  addFriendContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 10,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
  },
  addButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
  },
  addButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  list: {
    flex: 1,
  },
  friendItem: {
    padding: 15,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 10,
  },
  friendName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  friendEmail: {
    fontSize: 14,
    opacity: 0.7,
  },
  requestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 10,
  },
  requestInfo: {
    flex: 1,
  },
  acceptButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6,
  },
  acceptButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    marginTop: 50,
    opacity: 0.6,
  },
  chatContainer: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    marginRight: 15,
  },
  backButtonText: {
    fontSize: 16,
  },
  chatTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  messagesList: {
    flex: 1,
    padding: 15,
  },
  messageContainer: {
    maxWidth: '80%',
    padding: 10,
    borderRadius: 12,
    marginBottom: 10,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
  },
  messageText: {
    fontSize: 16,
  },
  messageTime: {
    fontSize: 12,
    marginTop: 5,
    opacity: 0.7,
  },
  messageInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 15,
    borderTopWidth: 1,
    gap: 10,
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: 'center',
  },
  sendButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});
