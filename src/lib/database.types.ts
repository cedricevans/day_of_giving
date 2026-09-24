// Hand-written to match supabase/migrations/0001_init.sql.
// Regenerate with `supabase gen types typescript --linked --schema pad`
// once schema exposure is confirmed, and replace this file with the
// generated output.

export type EventType =
  | 'page_view'
  | 'donate_click'
  | 'join_click'
  | 'lead_captured'
  | 'scroll_depth'

export type LeadIntent = 'donate' | 'join' | 'unspecified'

export interface Database {
  pad: {
    Tables: {
      sessions: {
        Row: {
          id: string
          created_at: string
          utm_source: string | null
          utm_medium: string | null
          utm_campaign: string | null
          referrer: string | null
          landing_path: string | null
          user_agent: string | null
          geo_country: string | null
          geo_country_code: string | null
          geo_region: string | null
          geo_region_code: string | null
          geo_city: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          utm_source?: string | null
          utm_medium?: string | null
          utm_campaign?: string | null
          referrer?: string | null
          landing_path?: string | null
          user_agent?: string | null
          geo_country?: string | null
          geo_country_code?: string | null
          geo_region?: string | null
          geo_region_code?: string | null
          geo_city?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          utm_source?: string | null
          utm_medium?: string | null
          utm_campaign?: string | null
          referrer?: string | null
          landing_path?: string | null
          user_agent?: string | null
          geo_country?: string | null
          geo_country_code?: string | null
          geo_region?: string | null
          geo_region_code?: string | null
          geo_city?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          id: string
          created_at: string
          session_id: string | null
          event_type: EventType
          metadata: Record<string, unknown>
        }
        Insert: {
          id?: string
          created_at?: string
          session_id?: string | null
          event_type: EventType
          metadata?: Record<string, unknown>
        }
        Update: {
          id?: string
          created_at?: string
          session_id?: string | null
          event_type?: EventType
          metadata?: Record<string, unknown>
        }
        Relationships: []
      }
      leads: {
        Row: {
          id: string
          created_at: string
          session_id: string | null
          name: string | null
          email: string
          intent: LeadIntent
        }
        Insert: {
          id?: string
          created_at?: string
          session_id?: string | null
          name?: string | null
          email: string
          intent?: LeadIntent
        }
        Update: {
          id?: string
          created_at?: string
          session_id?: string | null
          name?: string | null
          email?: string
          intent?: LeadIntent
        }
        Relationships: []
      }
      donations: {
        Row: {
          id: string
          created_at: string
          donor_name: string | null
          donor_email: string | null
          amount_cents: number
          is_recurring: boolean
          referral_source: string | null
          ym_export_date: string | null
          matched_lead_id: string | null
          notes: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          donor_name?: string | null
          donor_email?: string | null
          amount_cents: number
          is_recurring?: boolean
          referral_source?: string | null
          ym_export_date?: string | null
          matched_lead_id?: string | null
          notes?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          donor_name?: string | null
          donor_email?: string | null
          amount_cents?: number
          is_recurring?: boolean
          referral_source?: string | null
          ym_export_date?: string | null
          matched_lead_id?: string | null
          notes?: string | null
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}
