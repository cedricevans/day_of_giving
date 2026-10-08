import { useState } from 'react'
import { playStory, useMemberStories, type Story } from '../lib/community'
import { SectionHeading } from './SectionHeading'

const FIRST_PAGE = 6

function PlayIcon() {
  return (
    <span className="grid h-16 w-16 place-items-center rounded-full bg-pad-gold-400 text-pad-purple-950 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.6)] transition-transform group-hover:scale-110">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M8 5.5v13l11-6.5z" />
      </svg>
    </span>
  )
}

function Media({ story }: { story: Story }) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [youtube, setYoutube] = useState(false)
  const [state, setState] = useState<'idle' | 'loading' | 'unavailable'>('idle')

  if (story.youtube_id) {
    return youtube ? (
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${story.youtube_id}?autoplay=1&rel=0&playsinline=1`}
        title={`${story.name}'s story`}
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 h-full w-full"
      />
    ) : (
      <button type="button" onClick={() => setYoutube(true)} className="group absolute inset-0" aria-label={`Play ${story.name}'s story`}>
        <img
          src={`https://i.ytimg.com/vi/${story.youtube_id}/hqdefault.jpg`}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover opacity-90"
        />
        <span className="absolute inset-0 grid place-items-center">
          <PlayIcon />
        </span>
      </button>
    )
  }

  if (videoUrl) {
    return <video src={videoUrl} controls autoPlay playsInline className="absolute inset-0 h-full w-full bg-black object-contain" />
  }

  const canPlay = story.video_available && state !== 'unavailable'

  return (
    <button
      type="button"
      disabled={!canPlay || state === 'loading'}
      onClick={async () => {
        setState('loading')
        const url = await playStory(story)
        if (url) setVideoUrl(url)
        else setState('unavailable')
      }}
      className="group absolute inset-0 disabled:cursor-default"
      aria-label={canPlay ? `Play ${story.name}'s story` : undefined}
    >
      {story.posterUrl ? (
        <img src={story.posterUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <span className="block h-full w-full bg-[radial-gradient(ellipse_at_top,#4b2a85,#1e0f33)]" />
      )}
      <span className="absolute inset-0 grid place-items-center">
        {canPlay ? (
          state === 'loading' ? (
            <span className="h-12 w-12 animate-spin rounded-full border-4 border-pad-gold-300 border-t-transparent" />
          ) : (
            <PlayIcon />
          )
        ) : (
          <span className="rounded-full bg-pad-purple-950/80 px-4 py-2 text-xs font-semibold text-purple-100">
            Video coming back soon
          </span>
        )}
      </span>
    </button>
  )
}

function StoryCard({ story }: { story: Story }) {
  const [expanded, setExpanded] = useState(false)
  const hasMedia = Boolean(story.youtube_id || story.video_path)
  const long = (story.testimonial?.length ?? 0) > 220

  return (
    <article className="relative flex flex-col overflow-hidden rounded-[1.75rem] bg-white text-pad-purple-950 shadow-[0_30px_70px_-30px_rgba(0,0,0,0.7)]">
      {story.preview && (
        <span className="absolute left-3 top-3 z-10 rounded-full bg-red-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
          Preview, not public
        </span>
      )}
      {hasMedia && (
        <div className="relative aspect-[4/5] overflow-hidden bg-pad-purple-950">
          <Media story={story} />
        </div>
      )}
      <div className="flex flex-1 flex-col p-5">
        {story.testimonial && (
          <blockquote className={`${hasMedia ? 'text-sm' : 'font-[family-name:var(--font-display)] text-xl leading-snug'}`}>
            {!hasMedia && <span className="mb-2 block text-5xl leading-none text-pad-gold-500">“</span>}
            <p className={`whitespace-pre-line ${expanded || !long ? '' : 'line-clamp-5'}`}>{story.testimonial}</p>
            {long && (
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="mt-1 text-xs font-bold text-pad-gold-600 underline"
              >
                {expanded ? 'Show less' : 'Read more'}
              </button>
            )}
          </blockquote>
        )}
        <footer className="mt-auto pt-4">
          <p className="font-bold text-pad-purple-900">{story.name}</p>
          {story.chapter && <p className="text-xs font-medium text-pad-purple-700/60">{story.chapter}</p>}
        </footer>
      </div>
    </article>
  )
}

/**
 * Submissions an admin has switched to "On site". Hidden until there is at
 * least one. Shows posters only; a video downloads when someone taps play.
 */
export function MemberStories() {
  const stories = useMemberStories()
  const [showAll, setShowAll] = useState(false)
  if (stories.length === 0) return null

  const visible = showAll ? stories : stories.slice(0, FIRST_PAGE)

  return (
    <section id="stories" className="relative overflow-hidden bg-pad-purple-950 px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_85%_0%,rgba(232,205,133,0.18),transparent_55%)]" />
      <div className="relative mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            tone="dark"
            eyebrow="Member stories"
            title={
              <>
                Why P.A.D. <span className="italic text-pad-gold-300">matters</span>
              </>
            }
            description="In their own words: members on what the fraternity has meant to their careers, chapters and lives."
          />
          <a
            href="/share"
            className="btn-gold shrink-0 rounded-full px-6 py-3 font-extrabold transition-transform hover:scale-[1.02] active:scale-95"
          >
            Share your story
          </a>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((s) => (
            <StoryCard key={s.id} story={s} />
          ))}
        </div>

        {stories.length > FIRST_PAGE && !showAll && (
          <div className="mt-10 text-center">
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="rounded-full border-2 border-pad-gold-400/50 px-8 py-3 font-bold text-pad-gold-300 transition-colors hover:border-pad-gold-300"
            >
              More stories
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
