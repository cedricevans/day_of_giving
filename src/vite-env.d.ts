/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_PAD_DONATE_URL: string
  readonly VITE_PAD_JOIN_URL: string
  readonly VITE_CAMPAIGN_UTM_SOURCE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
