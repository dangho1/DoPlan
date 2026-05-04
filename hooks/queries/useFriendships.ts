import { supabase } from '@/lib/supabase'
import type { FriendRequest, FriendWithMessages, UserSearchResult } from '@/lib/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export function useFriends(userId: string | undefined) {
  return useQuery({
    queryKey: ['friends', userId],
    queryFn: async () => {
      const { data: friendships, error } = await supabase
        .from('friendships')
        .select('id, user_id, friend_id, status, created_at')
        .eq('status', 'accepted')
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`)

      if (error) throw error

      const friendsData: FriendWithMessages[] = []

      for (const friendship of friendships ?? []) {
        const friendUserId =
          friendship.user_id === userId ? friendship.friend_id : friendship.user_id

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('user_id, display_name, email, avatar_url')
          .eq('user_id', friendUserId)
          .single()

        if (!profile) continue

        const { count: unreadCount } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('sender_id', friendUserId)
          .eq('receiver_id', userId!)
          .eq('read', false)

        const { data: lastMsg } = await supabase
          .from('messages')
          .select('content, created_at')
          .or(
            `and(sender_id.eq.${userId},receiver_id.eq.${friendUserId}),and(sender_id.eq.${friendUserId},receiver_id.eq.${userId})`,
          )
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        friendsData.push({
          friendship_id: friendship.id,
          user_id: profile.user_id,
          display_name: profile.display_name,
          email: profile.email,
          avatar_url: profile.avatar_url,
          status: friendship.status,
          created_at: friendship.created_at,
          unread_count: unreadCount ?? 0,
          last_message: lastMsg?.content ?? null,
          last_message_time: lastMsg?.created_at ?? null,
        })
      }

      return friendsData.sort((a, b) => {
        if (!a.last_message_time && !b.last_message_time) return 0
        if (!a.last_message_time) return 1
        if (!b.last_message_time) return -1
        return (
          new Date(b.last_message_time).getTime() -
          new Date(a.last_message_time).getTime()
        )
      })
    },
    enabled: !!userId,
    staleTime: 30 * 1000,
  })
}

export function useFriendRequests(userId: string | undefined) {
  return useQuery({
    queryKey: ['friendRequests', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('friendships')
        .select('id, user_id, created_at')
        .eq('friend_id', userId!)
        .eq('status', 'pending')

      if (error) throw error

      const requestsData: FriendRequest[] = []

      for (const request of data ?? []) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('user_id, display_name, email, avatar_url')
          .eq('user_id', request.user_id)
          .single()

        if (profile) {
          requestsData.push({
            friendship_id: request.id,
            user_id: profile.user_id,
            display_name: profile.display_name,
            email: profile.email,
            avatar_url: profile.avatar_url,
            created_at: request.created_at,
          })
        }
      }

      return requestsData
    },
    enabled: !!userId,
    staleTime: 30 * 1000,
  })
}

export function useSentRequests(userId: string | undefined) {
  return useQuery({
    queryKey: ['sentRequests', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('friendships')
        .select('id, friend_id, created_at')
        .eq('user_id', userId!)
        .eq('status', 'pending')

      if (error) throw error

      const sentData: FriendRequest[] = []

      for (const request of data ?? []) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('user_id, display_name, email, avatar_url')
          .eq('user_id', request.friend_id)
          .single()

        if (profile) {
          sentData.push({
            friendship_id: request.id,
            user_id: profile.user_id,
            display_name: profile.display_name,
            email: profile.email,
            avatar_url: profile.avatar_url,
            created_at: request.created_at,
          })
        }
      }

      return sentData
    },
    enabled: !!userId,
    staleTime: 30 * 1000,
  })
}

export function useSearchUsers(userId: string | undefined, searchQuery: string) {
  return useQuery({
    queryKey: ['searchUsers', userId, searchQuery],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('user_id, display_name, email, avatar_url')
        .ilike('email', `%${searchQuery.trim()}%`)
        .neq('user_id', userId!)
        .limit(10)

      if (error) throw error
      return (data ?? []) as UserSearchResult[]
    },
    enabled: !!userId && searchQuery.trim().length > 0,
    staleTime: 30 * 1000,
  })
}

function invalidateFriendshipQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string,
) {
  queryClient.invalidateQueries({ queryKey: ['friends', userId] })
  queryClient.invalidateQueries({ queryKey: ['friendRequests', userId] })
  queryClient.invalidateQueries({ queryKey: ['sentRequests', userId] })
}

export function useSendFriendRequest(userId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (targetUserId: string) => {
      const { data: existing } = await supabase
        .from('friendships')
        .select('id, status')
        .or(
          `and(user_id.eq.${userId},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${userId})`,
        )
        .single()

      if (existing) {
        throw new Error(`Already have a ${existing.status} friendship with this user`)
      }

      const { error } = await supabase.from('friendships').insert({
        user_id: userId!,
        friend_id: targetUserId,
        status: 'pending',
      })

      if (error) throw error
    },
    onSuccess: () => {
      if (userId) invalidateFriendshipQueries(queryClient, userId)
    },
  })
}

export function useAcceptFriendRequest(userId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (friendshipId: string) => {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', friendshipId)

      if (error) throw error
    },
    onSuccess: () => {
      if (userId) invalidateFriendshipQueries(queryClient, userId)
    },
  })
}

export function useDenyFriendRequest(userId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (friendshipId: string) => {
      const { error } = await supabase.from('friendships').delete().eq('id', friendshipId)
      if (error) throw error
    },
    onSuccess: () => {
      if (userId) invalidateFriendshipQueries(queryClient, userId)
    },
  })
}

export function useCancelSentRequest(userId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (friendshipId: string) => {
      const { error } = await supabase.from('friendships').delete().eq('id', friendshipId)
      if (error) throw error
    },
    onSuccess: () => {
      if (userId) invalidateFriendshipQueries(queryClient, userId)
    },
  })
}

export function useRemoveFriend(userId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (friendshipId: string) => {
      const { error } = await supabase.from('friendships').delete().eq('id', friendshipId)
      if (error) throw error
    },
    onSuccess: () => {
      if (userId) invalidateFriendshipQueries(queryClient, userId)
    },
  })
}
