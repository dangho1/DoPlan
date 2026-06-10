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
  is_online?: boolean;
  last_seen?: string;
}

interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted' | 'blocked' | 'declined';
  created_at: string;
  friend_profile?: User;
  user_profile?: User;
}

interface Conversation {
  id: string;
  user1_id: string;
  user2_id: string;
  created_at: string;
  updated_at: string;
  other_user?: User;
  last_message?: Message;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'image' | 'file';
  is_read: boolean;
  created_at: string;
  sender_profile?: User;
}

interface ChatProps {
  childName: string;
  childId: string;
  onBack: () => void;
}

export default function Chat({ childName, childId, onBack }: ChatProps) {
  const colorScheme = useColorScheme();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [friendRequests, setFriendRequests] = useState<Friendship[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [friendEmail, setFriendEmail] = useState('');
  const [activeTab, setActiveTab] = useState<'conversations' | 'friends' | 'requests' | 'chat'>('conversations');
  const [loading, setLoading] = useState(true);

  const messagesRef = useRef<FlatList>(null);

  useEffect(() => {
    initializeUser();
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadFriends();
      loadFriendRequests();
      loadConversations();
      subscribeToFriendships();
    }
  }, [currentUser]);

  useEffect(() => {
    if (selectedConversation && currentUser) {
      loadMessages();
      const unsubscribe = subscribeToMessages();
      return unsubscribe;
    }
  }, [selectedConversation, currentUser]);

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
            is_online: true,
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating profile:', createError);
          return;
        }
        profile = newProfile;
      } else if (!profileError) {
        // Update online status
        await supabase
          .from('user_profiles')
          .update({ is_online: true, last_seen: new Date().toISOString() })
          .eq('user_id', user.id);
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

  const loadConversations = async () => {
    if (!currentUser) return;

    try {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          user1_profile:user_profiles!conversations_user1_id_fkey(*),
          user2_profile:user_profiles!conversations_user2_id_fkey(*)
        `)
        .or(`user1_id.eq.${currentUser.user_id},user2_id.eq.${currentUser.user_id}`)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error loading conversations:', error);
        return;
      }

      // Process conversations to add other_user info
      const processedConversations = await Promise.all(
        (data || []).map(async (conv: any) => {
          const other_user = conv.user1_id === currentUser.user_id 
            ? conv.user2_profile 
            : conv.user1_profile;

          // Get last message for this conversation
          const { data: lastMessage } = await supabase
            .from('messages')
            .select(`
              *,
              sender_profile:user_profiles!messages_sender_id_fkey(*)
            `)
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          return {
            ...conv,
            other_user,
            last_message: lastMessage,
          };
        })
      );

      setConversations(processedConversations);
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const loadMessages = async () => {
    if (!selectedConversation || !currentUser) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender_profile:user_profiles!messages_sender_id_fkey(*)
        `)
        .eq('conversation_id', selectedConversation.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading messages:', error);
        return;
      }

      setMessages(data || []);
      
      // Mark messages as read
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', selectedConversation.id)
        .neq('sender_id', currentUser.user_id)
        .eq('is_read', false);

    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const subscribeToMessages = () => {
    if (!selectedConversation || !currentUser) return () => {};

    const channel = supabase
      .channel(`messages:${selectedConversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedConversation.id}`,
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
          if (newMessage.sender_id !== currentUser.user_id) {
            await supabase
              .from('messages')
              .update({ is_read: true })
              .eq('id', newMessage.id);
          }

          // Scroll to bottom
          setTimeout(() => {
            messagesRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const subscribeToFriendships = () => {
    if (!currentUser) return;

    const channel = supabase
      .channel('friendships')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
          filter: `or(user_id.eq.${currentUser.user_id},friend_id.eq.${currentUser.user_id})`,
        },
        () => {
          loadFriends();
          loadFriendRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !currentUser) return;

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: selectedConversation.id,
          sender_id: currentUser.user_id,
          content: newMessage.trim(),
          message_type: 'text',
        });

      if (error) {
        console.error('Error sending message:', error);
        Alert.alert('Error', 'Failed to send message');
        return;
      }

      // Update conversation updated_at
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', selectedConversation.id);

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    }
  };

  const startConversation = async (friend: Friendship) => {
    if (!currentUser || !friend.friend_profile) return;

    try {
      const { data, error } = await supabase.rpc('get_or_create_conversation', {
        user1_uuid: currentUser.user_id,
        user2_uuid: friend.friend_id,
      });

      if (error) {
        console.error('Error creating conversation:', error);
        Alert.alert('Error', 'Failed to start conversation');
        return;
      }

      const conversationId = data;
      
      // Create conversation object
      const conversation: Conversation = {
        id: conversationId,
        user1_id: currentUser.user_id,
        user2_id: friend.friend_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        other_user: friend.friend_profile,
      };

      setSelectedConversation(conversation);
      setActiveTab('chat');
      loadConversations(); // Refresh conversations list
    } catch (error) {
      console.error('Error starting conversation:', error);
      Alert.alert('Error', 'Failed to start conversation');
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
        friendship_uuid: requestId,
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

  const declineFriendRequest = async (requestId: string) => {
    try {
      const { data, error } = await supabase.rpc('decline_friend_request', {
        friendship_uuid: requestId,
      });

      if (error) {
        console.error('Error declining friend request:', error);
        Alert.alert('Error', 'Failed to decline friend request');
        return;
      }

      const result = data as { success: boolean; message: string };
      
      if (result.success) {
        loadFriendRequests();
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (error) {
      console.error('Error declining friend request:', error);
      Alert.alert('Error', 'Failed to decline friend request');
    }
  };

  const renderConversationItem = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={[styles.conversationItem, { borderColor: Colors[colorScheme ?? 'light'].border }]}
      onPress={() => {
        setSelectedConversation(item);
        setActiveTab('chat');
      }}
    >
      <View style={styles.conversationHeader}>
        <Text style={[styles.conversationName, { color: Colors[colorScheme ?? 'light'].text }]}>
          {item.other_user?.display_name || 'Unknown User'}
        </Text>
        {item.other_user?.is_online && (
          <View style={styles.onlineIndicator} />
        )}
      </View>
      {item.last_message && (
        <Text 
          style={[styles.lastMessage, { color: Colors[colorScheme ?? 'light'].text }]}
          numberOfLines={1}
        >
          {item.last_message.content}
        </Text>
      )}
      <Text style={[styles.conversationTime, { color: Colors[colorScheme ?? 'light'].text }]}>
        {item.updated_at ? new Date(item.updated_at).toLocaleDateString() : ''}
      </Text>
    </TouchableOpacity>
  );

  const renderFriendItem = ({ item }: { item: Friendship }) => (
    <TouchableOpacity
      style={[styles.friendItem, { borderColor: Colors[colorScheme ?? 'light'].border }]}
      onPress={() => startConversation(item)}
    >
      <View style={styles.friendHeader}>
        <Text style={[styles.friendName, { color: Colors[colorScheme ?? 'light'].text }]}>
          {item.friend_profile?.display_name || 'Unknown User'}
        </Text>
        {item.friend_profile?.is_online && (
          <View style={styles.onlineIndicator} />
        )}
      </View>
      <Text style={[styles.friendEmail, { color: Colors[colorScheme ?? 'light'].text }]}>
        {item.friend_profile?.email || ''}
      </Text>
    </TouchableOpacity>
  );

  const renderFriendRequestItem = ({ item }: { item: Friendship }) => (
    <View style={[styles.requestItem, { borderColor: Colors[colorScheme ?? 'light'].border }]}>
      <View style={styles.requestInfo}>
        <Text style={[styles.friendName, { color: Colors[colorScheme ?? 'light'].text }]}>
          {item.user_profile?.display_name || 'Unknown User'}
        </Text>
        <Text style={[styles.friendEmail, { color: Colors[colorScheme ?? 'light'].text }]}>
          {item.user_profile?.email || ''}
        </Text>
      </View>
      <View style={styles.requestButtons}>
        <TouchableOpacity
          style={[styles.acceptButton, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]}
          onPress={() => acceptFriendRequest(item.id)}
        >
          <Text style={styles.acceptButtonText}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.declineButton, { backgroundColor: '#ff4444' }]}
          onPress={() => declineFriendRequest(item.id)}
        >
          <Text style={styles.declineButtonText}>Decline</Text>
        </TouchableOpacity>
      </View>
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
          {item.content}
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: Colors[colorScheme ?? 'light'].tint }]}>
            ← Back
          </Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
          Chat - {childName}
        </Text>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'conversations' && styles.activeTab]}
          onPress={() => setActiveTab('conversations')}
        >
          <Text style={[styles.tabText, { color: Colors[colorScheme ?? 'light'].text }]}>
            Chats ({conversations.length})
          </Text>
        </TouchableOpacity>
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
        {selectedConversation && (
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
      {activeTab === 'conversations' && (
        <View style={styles.content}>
          <FlatList
            data={conversations}
            renderItem={renderConversationItem}
            keyExtractor={(item) => item.id}
            style={styles.list}
            showsVerticalScrollIndicator={false}
          />
          {conversations.length === 0 && (
            <Text style={[styles.emptyText, { color: Colors[colorScheme ?? 'light'].text }]}>
              No conversations yet. Start chatting with your friends!
            </Text>
          )}
        </View>
      )}

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
          {friends.length === 0 && (
            <Text style={[styles.emptyText, { color: Colors[colorScheme ?? 'light'].text }]}>
              No friends yet. Add friends by their email address!
            </Text>
          )}
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

      {activeTab === 'chat' && selectedConversation && (
        <KeyboardAvoidingView 
          style={styles.chatContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.chatHeader}>
            <Text style={[styles.chatTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
              {selectedConversation.other_user?.display_name || 'Unknown User'}
            </Text>
            {selectedConversation.other_user?.is_online && (
              <View style={styles.onlineIndicatorChat} />
            )}
          </View>
          
          <FlatList
            ref={messagesRef}
            data={messages}
            renderItem={renderMessageItem}
            keyExtractor={(item) => item.id}
            style={styles.messagesList}
            onContentSizeChange={() => messagesRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => messagesRef.current?.scrollToEnd({ animated: false })}
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
              returnKeyType="send"
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 5,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    marginRight: 40, // Offset for back button
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
  conversationItem: {
    padding: 15,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 10,
  },
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  lastMessage: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 5,
  },
  conversationTime: {
    fontSize: 12,
    opacity: 0.5,
  },
  friendItem: {
    padding: 15,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 10,
  },
  friendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  friendName: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  friendEmail: {
    fontSize: 14,
    opacity: 0.7,
  },
  onlineIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginLeft: 8,
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
  requestButtons: {
    flexDirection: 'row',
    gap: 8,
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
  declineButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6,
  },
  declineButtonText: {
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
    justifyContent: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  chatTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  onlineIndicatorChat: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4CAF50',
    marginLeft: 8,
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
