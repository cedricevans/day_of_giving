import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { isSupabaseConfigured, supabase } from './supabase'
import { getVisitorId } from './visitor'
import type { LeaderboardRow, PollRow, ScoreboardRow, WallEmoji, WallKind, WallPost } from './database.types'

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

export function useScoreboard() {
  const [score, setScore] = useState<ScoreboardRow | null>(null)
  const [leaders, setLeaders] = useState<LeaderboardRow[]>([])

  usePolling(async () => {
    const [s, l] = await Promise.all([supabase.rpc('scoreboard'), supabase.rpc('chapter_leaderboard', { p_limit: 8 })])
    if (s.error) console.warn('[community] scoreboard failed', s.error)
    else setScore(s.data?.[0] ?? null)
    if (l.error) console.warn('[community] leaderboard failed', l.error)
    else setLeaders(l.data ?? [])
  })

  return { score, leaders }
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
