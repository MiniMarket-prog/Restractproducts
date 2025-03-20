import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"

// Default to empty strings to prevent build errors
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

// Check if we're in a browser environment before creating the client
const isBrowser = typeof window !== "undefined"

// Only create the client if we have the URL and key or if we're in the browser
export const supabase =
  (supabaseUrl && supabaseAnonKey) || isBrowser ? createClient<Database>(supabaseUrl, supabaseAnonKey) : null

// Helper function to safely use supabase
export function getSupabase() {
  if (!supabase) {
    if (isBrowser) {
      console.error("Supabase client not initialized. Check your environment variables.")
    }
    return null
  }
  return supabase
}

