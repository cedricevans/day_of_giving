// Hand-written to match supabase/migrations/0001_init.sql through 0007.
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

/** One row per US state from pad.supporter_map(). Counts are null when few is true (under 3). */
export interface SupporterMapRow {
  region_code: string
  region: string
  supporters: number | null
  give_clicks: number | null
  share: number | null
  few: boolean
  total_us: number
  total_intl: number
  /** At least one Give click from this state, even when counts are hidden. Added in 0005. */
  has_give_click?: boolean
}

export type WallKind = 'why_i_give' | 'shout_out' | 'memory'
export type WallEmoji = 'clap' | 'heart' | 'fire' | 'scales'

/** Public Wall post as returned by pad.wall_feed(). */
export type WallPost = {
  id: string
  created_at: string
  display_name: string | null
  chapter: string | null
  message: string
  kind: WallKind
  reactions: Partial<Record<WallEmoji, number>>
  mine: WallEmoji[]
}

export type PollRow = {
  id: string
  question: string
  options: string[]
  counts: number[]
  total: number
  my_vote: number | null
}

export type ScoreboardRow = {
  raised_cents: number
  gift_count: number
  donor_count: number
  chapters_participating: number
  wall_posts: number
  last_recorded_at: string | null
}

export type LeaderboardRow = {
  chapter: string
  raised_cents: number
  gifts: number
  supporters: number
  posts: number
}

/** Admin-side row of pad.wall_posts (includes hidden posts). */
export type WallPostAdminRow = {
  id: string
  created_at: string
  visitor_id: string
  display_name: string | null
  chapter: string | null
  message: string
  kind: WallKind
  status: 'published' | 'hidden'
  hidden_reason: string | null
}

export type PollAdminRow = {
  id: string
  created_at: string
  question: string
  options: string[]
  is_active: boolean
  sort_order: number
}

/** Public honor roll entry from pad.donor_honor_roll(). Consenting donors only. */
export type HonorRollRow = {
  display_name: string
  chapter: string | null
  donated_at: string
}

export type SubmissionStatus = 'pending_upload' | 'received' | 'approved' | 'file_removed'

export type SubmissionRow = {
  id: string
  created_at: string
  visitor_id: string
  name: string
  email: string
  chapter: string | null
  testimonial: string | null
  consent: boolean
  file_path: string | null
  poster_path: string | null
  file_mime: string | null
  file_bytes: number | null
  duration_seconds: number | null
  status: SubmissionStatus
  on_site: boolean
  published_at: string | null
  youtube_id: string | null
}

/** Story shown on the landing page, from pad.member_stories(). */
export type StoryRow = {
  id: string
  name: string
  chapter: string | null
  testimonial: string | null
  video_path: string | null
  poster_path: string | null
  youtube_id: string | null
  published_at: string | null
  /** False once the month's video egress budget is spent, or when YouTube is used. */
  video_available: boolean
}

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
          chapter: string | null
          ym_transaction_id: string | null
          donated_at: string | null
          fund: string | null
          list_publicly: boolean
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
          chapter?: string | null
          ym_transaction_id?: string | null
          donated_at?: string | null
          fund?: string | null
          list_publicly?: boolean
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
          chapter?: string | null
          ym_transaction_id?: string | null
          donated_at?: string | null
          fund?: string | null
          list_publicly?: boolean
        }
        Relationships: []
      }
      chapters: {
        Row: { id: string; created_at: string; name: string }
        Insert: { id?: string; created_at?: string; name: string }
        Update: { id?: string; created_at?: string; name?: string }
        Relationships: []
      }
      blocked_words: {
        Row: { word: string; created_at: string }
        Insert: { word: string; created_at?: string }
        Update: { word?: string; created_at?: string }
        Relationships: []
      }
      wall_posts: {
        Row: WallPostAdminRow
        Insert: { visitor_id: string; message: string }
        Update: { status?: WallPostAdminRow['status']; hidden_reason?: string | null }
        Relationships: []
      }
      submissions: {
        Row: SubmissionRow
        Insert: {
          visitor_id: string
          name: string
          email: string
          chapter?: string | null
          testimonial?: string | null
          consent: boolean
          youtube_id?: string | null
          status?: SubmissionStatus
        }
        Update: {
          status?: SubmissionStatus
          on_site?: boolean
          published_at?: string | null
          youtube_id?: string | null
        }
        Relationships: []
      }
      polls: {
        Row: PollAdminRow
        Insert: { question: string; options: string[]; is_active?: boolean; sort_order?: number }
        Update: { question?: string; options?: string[]; is_active?: boolean; sort_order?: number }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      scoreboard: {
        Args: Record<string, never>
        Returns: ScoreboardRow[]
      }
      chapter_leaderboard: {
        Args: { p_limit?: number }
        Returns: LeaderboardRow[]
      }
      wall_feed: {
        Args: { p_visitor_id: string; p_limit?: number; p_before?: string | null }
        Returns: WallPost[]
      }
      post_to_wall: {
        Args: {
          p_visitor_id: string
          p_display_name: string | null
          p_chapter: string | null
          p_message: string
          p_kind: WallKind
        }
        Returns: Omit<WallPost, 'reactions' | 'mine'>[]
      }
      toggle_wall_reaction: {
        Args: { p_post_id: string; p_visitor_id: string; p_emoji: WallEmoji }
        Returns: boolean
      }
      active_polls: {
        Args: { p_visitor_id: string }
        Returns: PollRow[]
      }
      vote_poll: {
        Args: { p_poll_id: string; p_visitor_id: string; p_option_index: number }
        Returns: undefined
      }
      supporter_map: {
        Args: Record<string, never>
        Returns: SupporterMapRow[]
      }
      donor_honor_roll: {
        Args: { p_limit?: number }
        Returns: HonorRollRow[]
      }
      start_submission: {
        Args: {
          p_visitor_id: string
          p_name: string
          p_email: string
          p_chapter: string | null
          p_testimonial: string | null
          p_consent: boolean
          p_file_bytes: number | null
          p_file_mime: string | null
          p_duration_seconds: number | null
          p_poster_bytes?: number | null
        }
        Returns: { id: string; file_path: string | null; poster_path: string | null }[]
      }
      finish_submission: {
        Args: { p_id: string; p_visitor_id: string }
        Returns: undefined
      }
      member_stories: {
        Args: { p_limit?: number }
        Returns: StoryRow[]
      }
      start_story_play: {
        Args: { p_id: string; p_visitor_id: string }
        Returns: boolean
      }
      story_video_egress_this_month: {
        Args: Record<string, never>
        Returns: number
      }
      submission_storage_bytes: {
        Args: Record<string, never>
        Returns: number
      }
      set_session_geo: {
        Args: {
          p_session_id: string
          p_country: string | null
          p_country_code: string | null
          p_region: string | null
          p_region_code: string | null
          p_city: string | null
        }
        Returns: undefined
      }
    }
  }
}
