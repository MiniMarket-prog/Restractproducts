import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"

// Create a dummy client for SSG/SSR when environment variables are not available
const createDummyClient = () => {
  console.warn("Creating dummy Supabase client - environment variables missing")
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => ({ data: null, error: null }),
          order: () => ({ data: [], error: null }),
        }),
        order: () => ({ data: [], error: null }),
        not: () => ({ data: [], error: null }),
        limit: () => ({ data: [], error: null }),
        count: () => ({ data: [], error: null }),
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

// Log environment variables (without exposing full key)
console.log(`Supabase URL: ${supabaseUrl ? "Set" : "Not set"}`)
console.log(
  `Supabase Anon Key: ${supabaseAnonKey ? "Set (starts with " + supabaseAnonKey.substring(0, 3) + "...)" : "Not set"}`,
)

// Create the client or a dummy client if environment variables are missing
export const supabase =
  supabaseUrl && supabaseAnonKey ? createClient<Database>(supabaseUrl, supabaseAnonKey) : createDummyClient()

// Helper function to check if Supabase is properly initialized
export function isSupabaseInitialized() {
  const initialized = !!(supabaseUrl && supabaseAnonKey)
  console.log(`Supabase initialized: ${initialized}`)

  if (!initialized) {
    console.warn("Supabase environment variables are missing. Check your .env file or environment settings.")
  }

  return initialized
}

// Add a function to test the Supabase connection
export async function testSupabaseConnection() {
  if (!isSupabaseInitialized()) {
    return { success: false, message: "Supabase not initialized" }
  }

  try {
    const { data, error } = await supabase.from("categories").select("count").limit(1)

    if (error) {
      return { success: false, message: error.message }
    }

    return { success: true, message: "Connection successful" }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "Unknown error" }
  }
}

