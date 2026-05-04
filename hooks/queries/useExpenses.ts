import { supabase } from '@/lib/supabase'
import type { Expense, ExpenseInsert, UserProfile } from '@/lib/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export function useExpenses(childId: string | undefined) {
  return useQuery({
    queryKey: ['expenses', childId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('child_id', childId!)
        .order('date', { ascending: false })

      if (error) throw error
      return (data ?? []) as Expense[]
    },
    enabled: !!childId,
    staleTime: 2 * 60 * 1000,
  })
}

export function useChildParents(childId: string | undefined) {
  return useQuery({
    queryKey: ['childParents', childId],
    queryFn: async () => {
      const { data: userChildrenData, error: userChildrenError } = await supabase
        .from('user_children')
        .select('user_id')
        .eq('child_id', childId!)

      if (userChildrenError) throw userChildrenError
      if (!userChildrenData?.length) return []

      const userIds = userChildrenData.map((uc) => uc.user_id)

      const { data, error } = await supabase
        .from('user_profiles')
        .select('user_id, email, display_name, first_name, last_name')
        .in('user_id', userIds)

      if (error) throw error
      return (data ?? []) as Pick<
        UserProfile,
        'user_id' | 'email' | 'display_name' | 'first_name' | 'last_name'
      >[]
    },
    enabled: !!childId,
    staleTime: 5 * 60 * 1000,
  })
}

export function useSaveExpense(childId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      expense,
      userId,
      editingId,
    }: {
      expense: Omit<ExpenseInsert, 'child_id' | 'user_id' | 'id' | 'created_at' | 'updated_at'>
      userId: string
      editingId?: string
    }) => {
      if (editingId) {
        const { error } = await supabase
          .from('expenses')
          .update(expense)
          .eq('id', editingId)

        if (error) throw error
      } else {
        const { error } = await supabase.from('expenses').insert([
          { ...expense, child_id: childId!, user_id: userId },
        ])

        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', childId] })
    },
  })
}

export function useDeleteExpense(childId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (expenseId: string) => {
      const { error } = await supabase.from('expenses').delete().eq('id', expenseId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', childId] })
    },
  })
}
