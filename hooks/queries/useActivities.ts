import { supabase } from '@/lib/supabase'
import type { RecurringActivity, RecurringActivityInsert, RecurringActivityUpdate } from '@/lib/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export function useActivities(childId: string | undefined) {
  return useQuery({
    queryKey: ['activities', childId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_activities')
        .select('*')
        .eq('child_id', childId!)
        .order('activity_name')

      if (error) throw error
      return (data ?? []) as RecurringActivity[]
    },
    enabled: !!childId,
    staleTime: 2 * 60 * 1000,
  })
}

export function useSaveActivity(childId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      activity,
      userId,
      editingId,
    }: {
      activity: Omit<RecurringActivityInsert, 'child_id' | 'user_id'>
      userId: string
      editingId?: string
    }) => {
      const payload = { ...activity, child_id: childId!, user_id: userId }

      if (editingId) {
        const { error } = await supabase
          .from('recurring_activities')
          .update(payload as RecurringActivityUpdate)
          .eq('id', editingId)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('recurring_activities')
          .insert([payload as RecurringActivityInsert])

        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities', childId] })
    },
  })
}

export function useDeleteActivity(childId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (activityId: string) => {
      const { error } = await supabase
        .from('recurring_activities')
        .delete()
        .eq('id', activityId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities', childId] })
    },
  })
}

export function useToggleActivity(childId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ activityId, isActive }: { activityId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('recurring_activities')
        .update({ is_active: !isActive })
        .eq('id', activityId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities', childId] })
    },
  })
}
