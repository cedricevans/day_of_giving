import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

if (!isSupabaseConfigured) {
  // Non-fatal: the landing page's hero/story/buttons still work without a
  // backend. Only tracking + admin login are unavailable until this is set.
  console.warn(
    '[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set — visit/lead tracking and the admin dashboard are disabled. See .env.example.',
  )
}

// createClient() throws synchronously on an empty/invalid URL, which would
// crash the whole app (including the public landing page) at module load.
// Fall back to a syntactically valid placeholder so the client always
// constructs; isSupabaseConfigured is what actually gates real usage.
export const supabase = createClient<Database>(
  isSupabaseConfigured ? url : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? anonKey : 'placeholder-anon-key',
  // This project's tables live in the "pad" schema of the shared
  // KustomGroupWebApps Supabase project, not "public" — every app there
  // gets its own schema. "pad" must be added to that project's Settings →
  // API → Exposed schemas before requests here will succeed.
  { db: { schema: 'pad' } },
)
