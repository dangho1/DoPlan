import { supabase } from '@/lib/supabase'
import type { ConversationWithDetails } from '@/lib/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export function useConversations(userId: string | undefined) {
  return useQuery({
    queryKey: ['conversations', userId],
    queryFn: async () => {
      const { data: conversations, error } = await supabase
        .from('conversations')
        .select('*')
        .contains('participant_ids', [userId!])
        .order('created_at', { ascending: false })

      if (error) throw error

      const conversationsWithDetails: ConversationWithDetails[] = []

      for (const conversation of conversations ?? []) {
        const otherParticipantId = conversation.participant_ids.find(
          (id: string) => id !== userId,
        )

        let otherParticipantName: string | undefined
        let otherParticipantAvatar: string | null | undefined
        let unreadCount = 0

        if (otherParticipantId) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('display_name, avatar_url')
            .eq('user_id', otherParticipantId)
            .single()

          if (profile) {
            otherParticipantName = profile.display_name
            otherParticipantAvatar = profile.avatar_url
          }

          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conversation.id)
            .eq('sender_id', otherParticipantId)
            .eq('receiver_id', userId!)
            .eq('read', false)

          unreadCount = count ?? 0
        }

        const { data: lastMsg } = await supabase
          .from('messages')
          .select('id, content, sender_id, created_at, read')
          .eq('conversation_id', conversation.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        conversationsWithDetails.push({
          conversation_id: conversation.id,
          title: conversation.title,
          created_by: conversation.created_by,
          participant_ids: conversation.participant_ids,
          created_at: conversation.created_at,
          last_message_id: lastMsg?.id ?? null,
          last_message: lastMsg?.content ?? null,
          last_message_sender_id: lastMsg?.sender_id ?? null,
          last_message_time: lastMsg?.created_at ?? null,
          last_message_read: lastMsg?.read ?? null,
          participant_count: conversation.participant_ids.length,
          other_participant_name: otherParticipantName,
          other_participant_avatar: otherParticipantAvatar,
          other_participant_id: otherParticipantId,
          unread_count: unreadCount,
        })
      }

      return conversationsWithDetails.sort((a, b) => {
        if (!a.last_message_time && !b.last_message_time) {
          return new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime()
        }
        if (!a.last_message_time) return 1
        if (!b.last_message_time) return -1
        return new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime()
      })
    },
    enabled: !!userId,
    staleTime: 30 * 1000,
  })
}

export function useCreateConversation(userId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      participantIds,
      title,
    }: {
      participantIds: string[]
      title?: string
    }) => {
      const { data, error } = await supabase.rpc('create_conversation', {
        p_created_by: userId!,
        p_participant_ids: participantIds,
        p_title: title ?? null,
      })

      if (error) throw error
      return data as string
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', userId] })
    },
  })
}

export function useDeleteConversation(userId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', userId] })
    },
  })
}
