import { supabase } from '@/lib/supabase'
import type { Contact, ContactInsert } from '@/lib/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export function useContacts(childId: string | undefined) {
  return useQuery({
    queryKey: ['contacts', childId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('child_id', childId!)
        .order('name', { ascending: true })

      if (error) throw error
      return (data ?? []) as Contact[]
    },
    enabled: !!childId,
    staleTime: 2 * 60 * 1000,
  })
}

export function useSaveContact(childId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      contact,
      userId,
      editingId,
    }: {
      contact: Omit<ContactInsert, 'child_id' | 'created_by' | 'id' | 'created_at' | 'updated_at'>
      userId: string
      editingId?: string
    }) => {
      if (editingId) {
        const { error } = await supabase
          .from('contacts')
          .update(contact)
          .eq('id', editingId)

        if (error) throw error
      } else {
        const { error } = await supabase.from('contacts').insert([
          { ...contact, child_id: childId!, created_by: userId },
        ])

        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', childId] })
    },
  })
}

export function useDeleteContact(childId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (contactId: string) => {
      const { error } = await supabase.from('contacts').delete().eq('id', contactId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', childId] })
    },
  })
}
