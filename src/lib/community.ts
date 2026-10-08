import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { isSupabaseConfigured, supabase } from './supabase'
import { getVisitorId } from './visitor'
import type { HonorRollRow, LeaderboardRow, PollRow, StoryRow, ScoreboardRow, WallEmoji, WallKind, WallPost } from './database.types'

// The Scoreboard and Wall refresh on a timer rather than a realtime channel:
// anon has no direct table access (everything goes through pad.* functions),
// so there is nothing for realtime to subscribe to.
const REFRESH_MS = 30_000

// Server error codes raised by pad.post_to_wall, pad.vote_poll, etc.
const friendlyErrors: Record<string, string> = {
  wall_message_too_short: 'Say a little more. Posts need at least 3 characters.',
  wall_too_long: 'That is a bit long. Keep posts under 280 characters.',
  wall_links_not_allowed: 'Links are not allowed on the Wall.',
  wall_blocked_words: 'Your post includes language the Wall does not allow. Please edit and try again.',
  wall_rate_limited: 'You are posting fast. Give it a moment and try again.',
  wall_post_not_found: 'That post is no longer on the Wall.',
  poll_bad_vote: 'That poll is closed.',
}

export function friendlyError(err: { message?: string } | null | undefined) {
  if (!err?.message) return 'Something went wrong. Please try again.'
  const code = Object.keys(friendlyErrors).find((k) => err.message!.includes(k))
  return code ? friendlyErrors[code] : 'Something went wrong. Please try again.'
}

/** Runs `load` now, every REFRESH_MS while the tab is visible, and on return to the tab. */
export function usePolling(load: () => void) {
  const saved = useRef(load)
  useLayoutEffect(() => {
    saved.current = load
  })

  useEffect(() => {
    if (!isSupabaseConfigured) return
    saved.current()
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') saved.current()
    }, REFRESH_MS)
    const onVisible = () => document.visibilityState === 'visible' && saved.current()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
}

// One shared poll for every component that shows the score (hero bar and
// Scoreboard), so adding a reader doesn't add requests.
type ScoreState = { score: ScoreboardRow | null; leaders: LeaderboardRow[] }
let scoreState: ScoreState = { score: null, leaders: [] }
const scoreListeners = new Set<() => void>()
let stopScorePolling: (() => void) | null = null

async function loadScore() {
  const [s, l] = await Promise.all([supabase.rpc('scoreboard'), supabase.rpc('chapter_leaderboard', { p_limit: 8 })])
  if (s.error) console.warn('[community] scoreboard failed', s.error)
  if (l.error) console.warn('[community] leaderboard failed', l.error)
  scoreState = {
    score: s.error ? scoreState.score : (s.data?.[0] ?? null),
    leaders: l.error ? scoreState.leaders : (l.data ?? []),
  }
  scoreListeners.forEach((fn) => fn())
}

function subscribeScore(fn: () => void) {
  scoreListeners.add(fn)
  if (!stopScorePolling && isSupabaseConfigured) {
    void loadScore()
    const id = setInterval(() => document.visibilityState === 'visible' && void loadScore(), REFRESH_MS)
    const onVisible = () => document.visibilityState === 'visible' && void loadScore()
    document.addEventListener('visibilitychange', onVisible)
    stopScorePolling = () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }
  return () => {
    scoreListeners.delete(fn)
    if (scoreListeners.size === 0) {
      stopScorePolling?.()
      stopScorePolling = null
    }
  }
}

export function useScoreboard() {
  return useSyncExternalStore(subscribeScore, () => scoreState)
}

/**
 * Donors who consented on PAD's form to be listed. Name and chapter only.
 * Refreshes every 5 minutes rather than on the 30 second timer: the list can
 * run to hundreds of names, and re-downloading it that often wastes egress.
 */
export function useHonorRoll() {
  const [donors, setDonors] = useState<HonorRollRow[]>([])

  useEffect(() => {
    if (!isSupabaseConfigured) return
    const load = async () => {
      const { data, error } = await supabase.rpc('donor_honor_roll', { p_limit: 500 })
      if (error) console.warn('[community] honor roll failed', error)
      else setDonors(data ?? [])
    }
    void load()
    const id = setInterval(() => document.visibilityState === 'visible' && void load(), 5 * 60_000)
    return () => clearInterval(id)
  }, [])

  return donors
}

export type Story = StoryRow & { posterUrl: string | null; preview?: boolean }

/**
 * Admin preview (`/?preview` while signed in): reads pad.submissions
 * directly, which only admins can, so stories that are not on the site yet
 * show up with a "Preview" badge. Visitors never get here.
 */
async function loadPreviewStories(): Promise<(StoryRow & { preview?: boolean })[]> {
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .neq('status', 'pending_upload')
    .order('on_site', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(60)
  if (error) {
    console.warn('[community] preview stories failed', error)
    return []
  }
  return (data ?? []).map((s) => {
    const hasFile = Boolean(s.file_path) && s.status !== 'file_removed'
    return {
      id: s.id,
      name: s.name,
      chapter: s.chapter,
      testimonial: s.testimonial,
      video_path: hasFile ? s.file_path : null,
      poster_path: hasFile ? s.poster_path : null,
      youtube_id: s.youtube_id,
      published_at: s.published_at,
      video_available: hasFile && !s.youtube_id,
      preview: !s.on_site,
    }
  })
}

/**
 * Loaded once per visit rather than on the 30 second timer: every refresh
 * would re-sign poster URLs, which defeats the browser cache and spends
 * Supabase egress. Videos are signed only after pad.start_story_play logs
 * the play against the monthly budget.
 */
export function useMemberStories() {
  const [stories, setStories] = useState<Story[]>([])

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let cancelled = false
    ;(async () => {
      const wantsPreview = new URLSearchParams(window.location.search).has('preview')
      const session = wantsPreview ? (await supabase.auth.getSession()).data.session : null
      let rows: (StoryRow & { preview?: boolean })[]
      if (session) {
        rows = await loadPreviewStories()
      } else {
        const { data, error } = await supabase.rpc('member_stories', { p_limit: 24 })
        if (error) return console.warn('[community] stories failed', error)
        rows = data ?? []
      }
      const posterPaths = rows.map((r) => r.poster_path).filter((p): p is string => Boolean(p))
      const signed = posterPaths.length
        ? await supabase.storage.from('pad-submissions').createSignedUrls(posterPaths, 3600)
        : { data: [], error: null }
      if (signed.error) console.warn('[community] poster urls failed', signed.error)
      const urlFor = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]))
      if (!cancelled) setStories(rows.map((r) => ({ ...r, posterUrl: (r.poster_path && urlFor.get(r.poster_path)) || null })))
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return stories
}

/** Returns a short-lived video URL, or null when the monthly budget is spent. */
export async function playStory(story: Story) {
  if (!story.video_path) return null
  // Admin previews of hidden stories sign directly and don't count against the budget.
  if (!story.preview) {
    const { data: allowed, error } = await supabase.rpc('start_story_play', { p_id: story.id, p_visitor_id: getVisitorId() })
    if (error || !allowed) return null
  }
  const { data, error: signError } = await supabase.storage.from('pad-submissions').createSignedUrl(story.video_path, 300)
  if (signError) console.warn('[community] video url failed', signError)
  return data?.signedUrl ?? null
}

const PAGE = 24

export function useWall() {
  const [posts, setPosts] = useState<WallPost[]>([])
  const [loaded, setLoaded] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const postsRef = useRef(posts)
  useLayoutEffect(() => {
    postsRef.current = posts
  })

  // Timer refreshes merge the newest page on top without dropping anything
  // the visitor already paged in with "Load more".
  usePolling(async () => {
    const { data, error } = await supabase.rpc('wall_feed', { p_visitor_id: getVisitorId(), p_limit: PAGE })
    if (error) {
      console.warn('[community] wall feed failed', error)
      setLoaded(true)
      return
    }
    const fresh = data ?? []
    const full = fresh.length === PAGE
    const cutoff = fresh[fresh.length - 1]?.created_at
    const older = full ? postsRef.current.filter((p) => p.created_at < cutoff) : []
    setPosts([...fresh, ...older])
    setHasMore((had) => full && (older.length === 0 || had))
    setLoaded(true)
  })

  const loadMore = useCallback(async () => {
    const last = posts[posts.length - 1]
    if (!last) return
    const { data, error } = await supabase.rpc('wall_feed', {
      p_visitor_id: getVisitorId(),
      p_limit: PAGE,
      p_before: last.created_at,
    })
    if (error) return console.warn('[community] wall page failed', error)
    setPosts((prev) => [...prev, ...(data ?? []).filter((p) => !prev.some((q) => q.id === p.id))])
    setHasMore((data?.length ?? 0) === PAGE)
  }, [posts])

  async function post(input: { name: string; chapter: string; message: string; kind: WallKind }) {
    const { data, error } = await supabase.rpc('post_to_wall', {
      p_visitor_id: getVisitorId(),
      p_display_name: input.name || null,
      p_chapter: input.chapter || null,
      p_message: input.message,
      p_kind: input.kind,
    })
    if (error || !data?.[0]) return { ok: false as const, message: friendlyError(error) }
    setPosts((prev) => [{ ...data[0], reactions: {}, mine: [] }, ...prev])
    return { ok: true as const }
  }

  async function react(postId: string, emoji: WallEmoji) {
    // Optimistic: flip locally, then reconcile with what the server says.
    const flip = (on: boolean) =>
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p
          const had = p.mine.includes(emoji)
          if (had === on) return p
          const count = (p.reactions[emoji] ?? 0) + (on ? 1 : -1)
          return {
            ...p,
            mine: on ? [...p.mine, emoji] : p.mine.filter((e) => e !== emoji),
            reactions: { ...p.reactions, [emoji]: Math.max(0, count) },
          }
        }),
      )
    const before = posts.find((p) => p.id === postId)?.mine.includes(emoji) ?? false
    flip(!before)
    const { data, error } = await supabase.rpc('toggle_wall_reaction', {
      p_post_id: postId,
      p_visitor_id: getVisitorId(),
      p_emoji: emoji,
    })
    if (error) {
      console.warn('[community] reaction failed', error)
      flip(before)
    } else if (data !== !before) {
      flip(Boolean(data))
    }
  }

  return { posts, loaded, hasMore, loadMore, post, react }
}

export function usePolls() {
  const [polls, setPolls] = useState<PollRow[]>([])

  usePolling(async () => {
    const { data, error } = await supabase.rpc('active_polls', { p_visitor_id: getVisitorId() })
    if (error) console.warn('[community] polls failed', error)
    else setPolls(data ?? [])
  })

  async function vote(pollId: string, optionIndex: number) {
    setPolls((prev) =>
      prev.map((p) => {
        if (p.id !== pollId || p.my_vote === optionIndex) return p
        const counts = [...p.counts]
        if (p.my_vote !== null) counts[p.my_vote] = Math.max(0, counts[p.my_vote] - 1)
        counts[optionIndex] += 1
        return { ...p, counts, total: p.my_vote === null ? p.total + 1 : p.total, my_vote: optionIndex }
      }),
    )
    const { error } = await supabase.rpc('vote_poll', {
      p_poll_id: pollId,
      p_visitor_id: getVisitorId(),
      p_option_index: optionIndex,
    })
    if (error) console.warn('[community] vote failed', error)
  }

  return { polls, vote }
}

/** Official chapter names for the picker. Empty until PAD's list is imported in admin. */
export function useChapterList() {
  const [names, setNames] = useState<string[]>([])
  useEffect(() => {
    if (!isSupabaseConfigured) return
    supabase
      .from('chapters')
      .select('name')
      .order('name')
      .then(({ data, error }) => {
        if (error) console.warn('[community] chapter list failed', error)
        else setNames((data ?? []).map((c) => c.name))
      })
  }, [])
  return names
}
