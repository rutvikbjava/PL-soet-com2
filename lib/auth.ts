import { createServerClient } from './supabase'
import type { User } from '@/types/database'

export type Role = 'faculty' | 'hod' | 'coe' | 'principal' | 'admin'

export interface Session {
  user: User | null
  role: Role | null
}

/**
 * Gets the current session with user data and role from the users table
 * Returns null for user and role if not authenticated
 * 
 * @returns Promise<Session> - { user, role }
 */
export async function getSession(): Promise<Session> {
  const supabase = await createServerClient()

  // Get the authenticated user from Supabase Auth
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    return { user: null, role: null }
  }

  // Fetch the user record from the users table
  const { data: userData, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  const user = userData as any

  if (error || !user) {
    return { user: null, role: null }
  }

  return {
    user,
    role: user.role as Role,
  }
}
