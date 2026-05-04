import { supabase } from '@/lib/supabase'
import type { Child } from '@/lib/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export function useChildren(userId: string | undefined) {
  return useQuery({
    queryKey: ['children', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_children')
        .select('children(*)')
        .eq('user_id', userId!)

      if (error) throw error

      return (data ?? [])
        .map((item) => item.children)
        .filter((c): c is Child => c !== null)
        .flat()
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  })
}

export function useAddChild(userId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      name,
      dateOfBirth,
    }: {
      name: string
      dateOfBirth: string
    }) => {
      const normalizedName = name.trim()

      const { data: existingChildren, error: existingChildrenError } = await supabase
        .from('user_children')
        .select('children(name)')
        .eq('user_id', userId!)

      if (existingChildrenError) throw existingChildrenError

      const hasDuplicateName = (existingChildren ?? []).some((item) => {
        const child = Array.isArray(item.children) ? item.children[0] : item.children
        return child?.name.trim().toLowerCase() === normalizedName.toLowerCase()
      })

      if (hasDuplicateName) {
        throw new Error('duplicate-child-name')
      }

      const { data: childData, error: childError } = await supabase
        .from('children')
        .insert({ name: normalizedName, date_of_birth: dateOfBirth || null, avatar_url: null })
        .select()
        .single()

      if (childError) throw childError

      const { error: linkError } = await supabase
        .from('user_children')
        .insert({ user_id: userId!, child_id: childData.id })

      if (linkError) {
        await supabase.from('children').delete().eq('id', childData.id)
        throw linkError
      }

      return childData
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['children', userId] })
    },
  })
}

export function useDeleteChild(userId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (childId: string) => {
      const { error } = await supabase.rpc('delete_child', { child_uuid: childId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['children', userId] })
    },
  })
}
