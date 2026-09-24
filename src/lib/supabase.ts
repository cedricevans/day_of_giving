import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Non-fatal: the landing page's hero/story/buttons still work without a
  // backend. Only tracking + admin login are unavailable until this is set.
  console.warn(
    '[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set — visit/lead tracking and the admin dashboard are disabled. See .env.example.',
  )
}

export const supabase = createClient<Database>(url ?? '', anonKey ?? '')
export const isSupabaseConfigured = Boolean(url && anonKey)
