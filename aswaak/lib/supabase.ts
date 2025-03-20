import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"

// Create a dummy client for SSG/SSR when environment variables are not available
const createDummyClient = () => {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => ({ data: null, error: null }),
          order: () => ({ data: [], error: null }),
        }),
        order: () => ({ data: [], error: null }),
      }),
      insert: () => ({
        select: () => ({
          single: () => ({ data: null, error: null }),
        }),
      }),
      update: () => ({
        eq: () => ({
          select: () => ({
            single: () => ({ data: null, error: null }),
          }),
        }),
      }),
    }),
  } as any
}

// Check if we're in a browser environment
const isBrowser = typeof window !== "undefined"

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

// Create the client or a dummy client if environment variables are missing
export const supabase =
  supabaseUrl && supabaseAnonKey ? createClient<Database>(supabaseUrl, supabaseAnonKey) : createDummyClient()

// Helper function to check if Supabase is properly initialized
export function isSupabaseInitialized() {
  return !!(supabaseUrl && supabaseAnonKey)
}

