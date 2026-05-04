import type { Tables, TablesInsert, TablesUpdate } from '../database.types'

export type Child = Tables<'children'>
export type ChildInsert = TablesInsert<'children'>
export type ChildUpdate = TablesUpdate<'children'>

export type Expense = Tables<'expenses'>
export type ExpenseInsert = TablesInsert<'expenses'>
export type ExpenseUpdate = TablesUpdate<'expenses'>

export type RecurringActivity = Tables<'recurring_activities'>
export type RecurringActivityInsert = TablesInsert<'recurring_activities'>
export type RecurringActivityUpdate = TablesUpdate<'recurring_activities'>

export type Message = Tables<'messages'>
export type MessageInsert = TablesInsert<'messages'>

export type UserProfile = Tables<'user_profiles'>
export type UserProfileUpdate = TablesUpdate<'user_profiles'>

export type Friendship = Tables<'friendships'>
export type UserChild = Tables<'user_children'>
export type CustodySchedule = Tables<'custody_schedules'>
export type CalendarEvent = Tables<'calendar_events'>
export type Conversation = Tables<'conversations'>
export type ConversationInsert = TablesInsert<'conversations'>
export type ConversationParticipant = Tables<'conversation_participants'>

// View types
export type FriendshipWithProfile = Tables<'friendships_with_profiles'>
export type ConversationListItem = Tables<'conversation_list'>

// Composed types derived from joined queries
export type ConversationWithDetails = {
  conversation_id: string
  title: string | null
  created_by: string
  participant_ids: string[]
  created_at: string | null
  last_message_id: string | null
  last_message: string | null
  last_message_sender_id: string | null
  last_message_time: string | null
  last_message_read: boolean | null
  participant_count: number | null
  other_participant_name?: string
  other_participant_avatar?: string | null
  other_participant_id?: string
  unread_count?: number
}

export type FriendWithMessages = {
  friendship_id: string
  user_id: string
  display_name: string
  email: string
  avatar_url: string | null
  status: string
  created_at: string | null
  unread_count: number
  last_message: string | null
  last_message_time: string | null
}

export type FriendRequest = {
  friendship_id: string
  user_id: string
  display_name: string
  email: string
  avatar_url: string | null
  created_at: string | null
}

export type UserSearchResult = {
  user_id: string
  display_name: string
  email: string
  avatar_url: string | null
}
