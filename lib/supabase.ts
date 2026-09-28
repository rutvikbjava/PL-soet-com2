import { createBrowserClient as createBrowserSupabaseClient } from '@supabase/ssr'
import { createServerClient as createServerSupabaseClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Creates a Supabase client for use in browser/client components
 * Uses NEXT_PUBLIC_ environment variables
 */
export function createBrowserClient() {
  return createBrowserSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

/**
 * Creates a Supabase client for use in server components, server actions, and route handlers
 * Reads cookies for authentication
 */
export async function createServerClient() {
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()

  return createServerSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: any) {
          try {
            cookiesToSet.forEach(({ name, value, options }: any) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

/**
 * Creates a Supabase admin client with elevated privileges
 * Uses service role key - SERVER ONLY, never expose to client
 * Bypasses Row Level Security (RLS)
 */
export function createAdminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  }

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

/**
 * Generates a temporary signed URL for accessing private storage files
 * Uses admin client to bypass RLS - SERVER ONLY
 * 
 * @param bucket - Storage bucket name
 * @param path - File path within the bucket
 * @returns Signed URL string on success, null on error
 */
export async function getSignedUrl(bucket: string, path: string): Promise<string | null> {
  try {
    const supabase = createAdminClient()
    
    const { data, error } = await supabase
      .storage
      .from(bucket)
      .createSignedUrl(path, 3600)

    if (error || !data) {
      return null
    }

    return data.signedUrl
  } catch {
    return null
  }
}
