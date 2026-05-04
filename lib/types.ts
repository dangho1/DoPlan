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

// View types
export type FriendshipWithProfile = Tables<'friendships_with_profiles'>
export type ConversationListItem = Tables<'conversation_list'>

// Composed types derived from joined queries
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
