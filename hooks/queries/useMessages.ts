import { supabase } from '@/lib/supabase'
import type { Message } from '@/lib/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export function useMessages(
  currentUserId: string | undefined,
  friendId: string | undefined,
  conversationId?: string | null,
) {
  return useQuery({
    queryKey: ['messages', conversationId ?? friendId, currentUserId, friendId],
    queryFn: async () => {
      let query = supabase.from('messages').select('*')

      if (conversationId) {
        query = query.eq('conversation_id', conversationId)
      } else if (currentUserId && friendId) {
        query = query.or(
          `and(sender_id.eq.${currentUserId},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${currentUserId})`,
        )
      }

      const { data, error } = await query.order('created_at', { ascending: true })

      if (error) throw error
      return (data ?? []) as Message[]
    },
    enabled: !!(conversationId || (currentUserId && friendId)),
    staleTime: 0,
  })
}

export function useSendMessage(
  currentUserId: string | undefined,
  receiverId: string | undefined,
  conversationId?: string | null,
) {
  const queryClient = useQueryClient()
  const queryKey = ['messages', conversationId ?? receiverId, currentUserId, receiverId]

  return useMutation({
    mutationFn: async (content: string) => {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: currentUserId!,
          receiver_id: receiverId!,
          content,
          read: false,
          conversation_id: conversationId || null,
        })
        .select()
        .single()

      if (error) throw error
      return data as Message
    },
    onMutate: async (content) => {
      const optimisticMsg: Message = {
        id: `optimistic-${Date.now()}`,
        sender_id: currentUserId!,
        receiver_id: receiverId!,
        content,
        read: false,
        conversation_id: conversationId || null,
        created_at: new Date().toISOString(),
        updated_at: null,
      }
      queryClient.setQueryData<Message[]>(queryKey, (old = []) => [
        ...old,
        optimisticMsg,
      ])
      return { optimisticId: optimisticMsg.id }
    },
    onSuccess: (data, _vars, context) => {
      queryClient.setQueryData<Message[]>(queryKey, (old = []) => {
        const filtered = old.filter((m) => m.id !== context?.optimisticId)
        if (filtered.some((m) => m.id === data.id)) return filtered
        return [...filtered, data]
      })
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData<Message[]>(queryKey, (old = []) =>
        old.filter((m) => m.id !== context?.optimisticId),
      )
    },
  })
}

export function useMarkMessagesRead(
  currentUserId: string | undefined,
  friendId: string | undefined,
  conversationId?: string | null,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      let query = supabase
        .from('messages')
        .update({ read: true })
        .eq('sender_id', friendId!)
        .eq('receiver_id', currentUserId!)
        .eq('read', false)

      if (conversationId) {
        query = supabase
          .from('messages')
          .update({ read: true })
          .eq('conversation_id', conversationId)
          .eq('sender_id', friendId!)
          .eq('read', false)
      }

      await query
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.invalidateQueries({ queryKey: ['friends'] })
    },
  })
}
