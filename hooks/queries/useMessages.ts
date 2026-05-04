import { supabase } from '@/lib/supabase'
import type { Message } from '@/lib/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export function useMessages(
  currentUserId: string | undefined,
  friendId: string | undefined,
) {
  return useQuery({
    queryKey: ['messages', currentUserId, friendId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(
          `and(sender_id.eq.${currentUserId},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${currentUserId})`,
        )
        .order('created_at', { ascending: true })

      if (error) throw error
      return (data ?? []) as Message[]
    },
    enabled: !!currentUserId && !!friendId,
    staleTime: 0,
  })
}

export function useSendMessage(
  currentUserId: string | undefined,
  friendId: string | undefined,
) {
  const queryClient = useQueryClient()
  const queryKey = ['messages', currentUserId, friendId]

  return useMutation({
    mutationFn: async (content: string) => {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: currentUserId!,
          receiver_id: friendId!,
          content,
          read: false,
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
        receiver_id: friendId!,
        content,
        read: false,
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
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      await supabase
        .from('messages')
        .update({ read: true })
        .eq('sender_id', friendId!)
        .eq('receiver_id', currentUserId!)
        .eq('read', false)
    },
    onSuccess: () => {
      // Invalidate friends list so unread counts update
      queryClient.invalidateQueries({ queryKey: ['friends'] })
    },
  })
}
