import { supabase } from '@/lib/supabase'
import type { UserProfile, UserProfileUpdate } from '@/lib/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export function useUserProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['userProfile', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId!)
        .single()

      if (error) throw error
      return data as UserProfile
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })
}

export function useUpdateUserProfile(userId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (updates: UserProfileUpdate) => {
      const { data, error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('user_id', userId!)
        .select()
        .single()

      if (error) throw error
      return data as UserProfile
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['userProfile', userId], data)
    },
  })
}
