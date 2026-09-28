import { createServerClient, createAdminClient } from './supabase'
import { headers } from 'next/headers'
import type { User } from '@/types/database'

export type Role = 'faculty' | 'hod' | 'coe' | 'principal' | 'admin'

export interface Session {
  user: User | null
  role: Role | null
}

/**
 * Gets the current session with user data and role from the users table
 * First tries reading from cookies, then falls back to Authorization header
 * Returns null for user and role if not authenticated
 * 
 * @returns Promise<Session> - { user, role }
 */
export async function getSession(): Promise<Session> {
  // Try method 1: Read session from cookies
  const supabase = await createServerClient()

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  let userId: string | null = authUser?.id || null

  // Try method 2: Read from Authorization header if cookies failed
  if (!userId) {
    try {
      const headersList = await headers()
      const authHeader = headersList.get('authorization')

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '')
        const adminClient = createAdminClient()

        const {
          data: { user: tokenUser },
        } = await adminClient.auth.getUser(token)

        if (tokenUser) {
          userId = tokenUser.id
        }
      }
    } catch (error) {
      // Authorization header method failed, continue to return null
      console.error('Failed to read Authorization header:', error)
    }
  }

  // If no user found by either method
  if (!userId) {
    return { user: null, role: null }
  }

  // Fetch the user record from the users table
  const { data: userData, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
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
