import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { usePolls, useScoreboard, useWall } from '../lib/community'
import { isSupabaseConfigured } from '../lib/supabase'
import { useChapter } from '../lib/visitor'
import type { PollRow, WallEmoji, WallKind, WallPost } from '../lib/database.types'
import { ChapterInput } from './ChapterInput'
import { SectionHeading } from './SectionHeading'

const kinds: { value: WallKind; label: string; prompt: string }[] = [
  { value: 'why_i_give', label: 'Why I give', prompt: 'I give because...' },
  { value: 'shout_out', label: 'Chapter shout-out', prompt: 'Big love to my chapter for...' },
  { value: 'memory', label: 'P.A.D. memory', prompt: 'My favorite P.A.D. moment was...' },
]

const kindLabel: Record<WallKind, string> = {
  why_i_give: 'Why I give',
  shout_out: 'Shout-out',
  memory: 'Memory',
}

const cardTone: Record<WallKind, string> = {
  why_i_give: 'bg-pad-purple-900 text-white',
  shout_out: 'bg-pad-gold-400 text-pad-purple-950',
  memory: 'bg-white text-pad-purple-950 ring-1 ring-pad-purple-700/10',
}

const emojis: { key: WallEmoji; glyph: string; label: string }[] = [
  { key: 'clap', glyph: '👏', label: 'Applause' },
  { key: 'heart', glyph: '❤️', label: 'Love' },
  { key: 'fire', glyph: '🔥', label: 'Fire' },
  { key: 'scales', glyph: '⚖️', label: 'Justice' },
]

const MAX = 280

function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function Composer({ onPost }: { onPost: ReturnType<typeof useWall>['post'] }) {
  const [kind, setKind] = useState<WallKind>('why_i_give')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [chapter] = useChapter()
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy || message.trim().length < 3) return
    setBusy(true)
    setStatus(null)
    const res = await onPost({ name: name.trim(), chapter, message: message.trim(), kind })
    setBusy(false)
    if (res.ok) {
      setMessage('')
      setStatus({ ok: true, text: 'You are on the Wall. Thank you!' })
    } else {
      setStatus({ ok: false, text: res.message })
    }
  }

  const left = MAX - message.length

  return (
    <form
      onSubmit={submit}
      className="relative rounded-3xl border border-pad-purple-700/10 bg-white p-6 shadow-[0_30px_80px_-24px_rgba(43,20,84,0.35)] sm:p-8"
    >
      <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-pad-gold-400 to-transparent" />
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-pad-purple-700/60">Add your voice</p>

      <div className="mt-4 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Post type">
        {kinds.map((k) => (
          <button
            key={k.value}
            type="button"
            role="radio"
            aria-checked={kind === k.value}
            onClick={() => setKind(k.value)}
            className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
              kind === k.value
                ? 'bg-pad-purple-900 text-pad-gold-300'
                : 'bg-pad-purple-700/5 text-pad-purple-800 hover:bg-pad-purple-700/10'
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <label className="block">
          <span className="sr-only">Your message</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, MAX))}
            rows={3}
            required
            minLength={3}
            placeholder={kinds.find((k) => k.value === kind)!.prompt}
            className="block w-full resize-none rounded-xl border border-pad-purple-700/15 bg-white px-4 py-2.5 text-base text-pad-purple-950 outline-none transition-colors placeholder:text-pad-purple-700/40 focus:border-pad-gold-500 focus:ring-2 focus:ring-pad-gold-400/30 sm:text-sm"
          />
          <span className={`mt-1 block text-right text-xs ${left < 20 ? 'font-semibold text-pad-gold-600' : 'text-pad-purple-700/40'}`}>
            {left} left
          </span>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="sr-only">Your name (optional)</span>
            <input
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name (optional)"
              className="w-full rounded-xl border border-pad-purple-700/15 bg-white px-4 py-2.5 text-base text-pad-purple-950 outline-none transition-colors placeholder:text-pad-purple-700/40 focus:border-pad-gold-500 focus:ring-2 focus:ring-pad-gold-400/30 sm:text-sm"
            />
          </label>
          <ChapterInput label="Chapter (optional)" hideLabel placeholder="Chapter (optional)" />
        </div>
      </div>

      <button
        type="submit"
        disabled={busy || message.trim().length < 3}
        className="btn-gold mt-6 w-full rounded-full px-8 py-3.5 text-base font-extrabold transition-transform enabled:hover:scale-[1.02] enabled:active:scale-95 disabled:opacity-60"
      >
        {busy ? 'Posting...' : 'Post to the Wall'}
      </button>

      {status ? (
        <p role="status" className={`mt-4 text-center text-sm font-semibold ${status.ok ? 'text-emerald-700' : 'text-red-700'}`}>
          {status.text}
        </p>
      ) : (
        <p className="mt-4 text-center text-xs text-pad-purple-700/50">Keep it kind. Links are not allowed.</p>
      )}
    </form>
  )
}

function Poll({ poll, onVote }: { poll: PollRow; onVote: (option: number) => void }) {
  const voted = poll.my_vote !== null
  return (
    <div className="rounded-3xl bg-pad-purple-900 p-6 text-white sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.25em] text-pad-gold-300">Quick poll</p>
        <p className="text-xs text-purple-100/50">
          {voted ? `${poll.total.toLocaleString()} ${poll.total === 1 ? 'vote' : 'votes'}. Tap another to change yours.` : 'Tap to vote and see results.'}
        </p>
      </div>
      <p className="mt-2 font-[family-name:var(--font-display)] text-xl font-black leading-snug sm:text-2xl">{poll.question}</p>
      <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {poll.options.map((opt, i) => {
          const pct = poll.total ? Math.round((poll.counts[i] / poll.total) * 100) : 0
          const mine = poll.my_vote === i
          return (
            <button
              key={opt}
              onClick={() => onVote(i)}
              aria-pressed={mine}
              className={`relative w-full overflow-hidden rounded-xl px-3.5 py-2 text-left text-sm font-bold ring-1 transition-colors ${
                mine ? 'ring-pad-gold-400' : 'ring-white/15 hover:ring-white/40'
              }`}
            >
              {voted && (
                <motion.span
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className={`absolute inset-y-0 left-0 ${mine ? 'bg-pad-gold-400/40' : 'bg-white/10'}`}
                  aria-hidden="true"
                />
              )}
              <span className="relative flex justify-between gap-3">
                <span>{opt}</span>
                {voted && <span className="tabular-nums text-pad-gold-300">{pct}%</span>}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function PostCard({ post, featured = false, onReact }: { post: WallPost; featured?: boolean; onReact: (e: WallEmoji) => void }) {
  const dark = post.kind === 'why_i_give'
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={`relative flex flex-col overflow-hidden shadow-[0_16px_40px_-24px_rgba(44,20,84,0.55)] ${cardTone[post.kind]} ${
        featured ? 'rounded-[2rem] p-7 sm:p-10' : 'rounded-[1.5rem] p-5'
      }`}
    >
      <p
        className={`text-[10px] font-extrabold uppercase tracking-[0.25em] ${
          dark ? 'text-pad-gold-300' : 'text-pad-purple-700/70'
        }`}
      >
        {featured ? `Latest · ${kindLabel[post.kind]}` : kindLabel[post.kind]}
      </p>
      {featured && (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute -top-6 right-6 font-[family-name:var(--font-display)] text-[10rem] leading-none ${
            dark ? 'text-white/10' : 'text-pad-purple-900/10'
          }`}
        >
          &ldquo;
        </span>
      )}
      <p
        className={`mt-2 whitespace-pre-line break-words ${
          featured
            ? 'font-[family-name:var(--font-display)] text-2xl font-bold leading-snug sm:text-3xl'
            : 'text-lg font-semibold leading-snug'
        }`}
      >
        {post.message}
      </p>
      <p className={`mt-auto pt-3 text-sm ${dark ? 'text-purple-100/70' : 'text-pad-purple-800/70'}`}>
        <span className="font-bold">{post.display_name || 'A P.A.D. supporter'}</span>
        {post.chapter && <span> · {post.chapter}</span>}
        <span> · {timeAgo(post.created_at)}</span>
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {emojis.map((e) => {
          const count = post.reactions[e.key] ?? 0
          const on = post.mine.includes(e.key)
          return (
            <button
              key={e.key}
              onClick={() => onReact(e.key)}
              aria-pressed={on}
              aria-label={`${e.label}${count ? `, ${count}` : ''}`}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-bold transition-transform active:scale-90 ${
                on
                  ? dark
                    ? 'bg-pad-gold-400 text-pad-purple-950'
                    : 'bg-pad-purple-900 text-white'
                  : dark
                    ? 'bg-white/10 hover:bg-white/20'
                    : 'bg-pad-purple-950/5 hover:bg-pad-purple-950/10'
              }`}
            >
              <span aria-hidden="true">{e.glyph}</span>
              {count > 0 && <span className="tabular-nums">{count}</span>}
            </button>
          )
        })}
      </div>
    </motion.article>
  )
}

const kindDot: Record<WallKind, string> = {
  why_i_give: 'bg-pad-purple-900',
  shout_out: 'bg-pad-gold-500',
  memory: 'bg-pad-purple-600/40',
}

function PostRow({ post, onReact }: { post: WallPost; onReact: (e: WallEmoji) => void }) {
  return (
    <article className="flex gap-3 px-4 py-3.5 sm:px-5">
      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${kindDot[post.kind]}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-pad-purple-800/70">
          <span className="font-bold text-pad-purple-950">{post.display_name || 'A P.A.D. supporter'}</span>
          {post.chapter && <span> · {post.chapter}</span>}
          <span> · {kindLabel[post.kind]} · {timeAgo(post.created_at)}</span>
        </p>
        <p className="mt-1 whitespace-pre-line break-words text-[15px] font-medium leading-snug text-pad-purple-950">{post.message}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {emojis.map((e) => {
            const count = post.reactions[e.key] ?? 0
            const on = post.mine.includes(e.key)
            return (
              <button
                key={e.key}
                onClick={() => onReact(e.key)}
                aria-pressed={on}
                aria-label={`${e.label}${count ? `, ${count}` : ''}`}
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold transition-transform active:scale-90 ${
                  on ? 'bg-pad-purple-900 text-white' : 'bg-pad-purple-950/5 hover:bg-pad-purple-950/10'
                }`}
              >
                <span aria-hidden="true">{e.glyph}</span>
                {count > 0 && <span className="tabular-nums">{count}</span>}
              </button>
            )
          })}
        </div>
      </div>
    </article>
  )
}

const filters: { value: WallKind | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'why_i_give', label: 'Why I give' },
  { value: 'shout_out', label: 'Shout-outs' },
  { value: 'memory', label: 'Memories' },
]

const wallPoints = ['Posts go live instantly', 'Tag your chapter to climb the board', 'React to the stories that move you']

function EmptyWall() {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border-2 border-dashed border-pad-purple-700/20 bg-white/60 p-8 text-center sm:p-12">
      <span aria-hidden="true" className="font-[family-name:var(--font-display)] text-7xl leading-none text-pad-gold-500/40">
        &ldquo;
      </span>
      <p className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold text-pad-purple-950 sm:text-3xl">
        The Wall is open.
      </p>
      <p className="mx-auto mt-3 max-w-sm text-pad-purple-800/70">
        Be the first voice of the Week of Giving. Share why you give, shout out your chapter, or post a favorite P.A.D. memory.
      </p>
      <a
        href="#wall-composer"
        className="mt-6 inline-flex rounded-full bg-pad-purple-900 px-6 py-3 text-sm font-bold text-pad-gold-300 transition-transform hover:scale-105 lg:hidden"
      >
        Add your voice
      </a>
      <p className="mt-6 hidden text-sm font-semibold text-pad-purple-700/60 lg:block">Add yours on the right &rarr;</p>
    </div>
  )
}

export function CommunityWall() {
  const { posts, loaded, hasMore, loadMore, post, react } = useWall()
  const { polls, vote } = usePolls()
  const { score } = useScoreboard()
  const [filter, setFilter] = useState<WallKind | 'all'>('all')
  const [featured, ...rest] = posts
  const shown = filter === 'all' ? rest : rest.filter((p) => p.kind === filter)
  const total = Math.max(score?.wall_posts ?? 0, posts.length)

  return (
    <section id="wall" className="relative overflow-hidden bg-pad-cream px-6 py-24 lg:px-8 lg:py-32">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            eyebrow="The Wall"
            title={
              <>
                This is <span className="mr-[0.12em] italic text-pad-gold-600">our</span> week. Say it loud.
              </>
            }
            description="Tell us why you give, shout out your chapter, or share a P.A.D. memory."
          />
          <ul className="flex flex-wrap gap-2 lg:max-w-xs lg:justify-end">
            {wallPoints.map((t) => (
              <li
                key={t}
                className="rounded-full bg-pad-purple-900/5 px-3.5 py-1.5 text-xs font-semibold text-pad-purple-800"
              >
                {t}
              </li>
            ))}
          </ul>
        </div>

        {isSupabaseConfigured ? (
          <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-8">
            <aside id="wall-composer" className="scroll-mt-24 lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1">
              <Composer onPost={post} />
            </aside>

            {/* Fixed-height feed: the section stays the same size however many posts come in. */}
            <div className="space-y-4 lg:col-start-1 lg:row-start-1">
              <div className="flex items-center gap-2.5 text-xs font-extrabold uppercase tracking-[0.25em] text-pad-purple-700/70">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pad-gold-500 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-pad-gold-500" />
                </span>
                Live from the community
                {total > 0 && <span className="ml-auto tracking-normal normal-case">{total.toLocaleString()} posts</span>}
              </div>

              {featured ? (
                <AnimatePresence initial={false} mode="popLayout">
                  <PostCard key={featured.id} post={featured} featured onReact={(e) => react(featured.id, e)} />
                </AnimatePresence>
              ) : (
                loaded && <EmptyWall />
              )}

              {featured && (
                <div className="overflow-hidden rounded-3xl bg-white ring-1 ring-pad-purple-700/10">
                  <div className="flex gap-1.5 overflow-x-auto border-b border-pad-purple-700/10 px-4 py-3 sm:px-5" role="tablist" aria-label="Filter posts">
                    {filters.map((f) => (
                      <button
                        key={f.value}
                        role="tab"
                        aria-selected={filter === f.value}
                        onClick={() => setFilter(f.value)}
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                          filter === f.value
                            ? 'bg-pad-purple-900 text-pad-gold-300'
                            : 'bg-pad-purple-700/5 text-pad-purple-800 hover:bg-pad-purple-700/10'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <div className="max-h-[520px] divide-y divide-pad-purple-700/10 overflow-y-auto">
                      {shown.map((p) => (
                        <PostRow key={p.id} post={p} onReact={(e) => react(p.id, e)} />
                      ))}
                      {shown.length === 0 && (
                        <p className="px-5 py-10 text-center text-sm text-pad-purple-700/60">
                          {rest.length === 0 ? 'New posts will appear here.' : 'No posts of this kind yet.'}{' '}
                          <a href="#wall-composer" className="font-bold text-pad-purple-900 underline">
                            Add yours
                          </a>
                        </p>
                      )}
                      {hasMore && (
                        <div className="px-5 py-4 text-center">
                          <button
                            onClick={loadMore}
                            className="rounded-full border-2 border-pad-purple-700/20 px-6 py-2 text-sm font-semibold text-pad-purple-900 transition-colors hover:border-pad-purple-700"
                          >
                            Load older posts
                          </button>
                        </div>
                      )}
                    </div>
                    {shown.length > 4 && (
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent" />
                    )}
                  </div>
                </div>
              )}
            </div>

            {polls.length > 0 && (
              <div className="space-y-4 lg:col-span-2">
                {polls.map((p) => (
                  <Poll key={p.id} poll={p} onVote={(i) => vote(p.id, i)} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="mt-12 rounded-3xl bg-white p-8 text-center text-pad-purple-700/70">The Wall is warming up. Check back soon.</p>
        )}
      </div>
    </section>
  )
}
