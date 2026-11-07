import { useEffect, useState } from 'react'
import { youtubeId } from '../lib/campaign'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { SectionHeading } from './SectionHeading'

/** PAD's kickoff video. Shows only while an admin has it turned on (Admin, Community tab). */
export function KickoffVideo() {
  const [id, setId] = useState<string | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let cancelled = false
    supabase.rpc('kickoff_video').then(({ data, error }) => {
      if (error) console.warn('[kickoff] load failed', error)
      if (!cancelled) setId(youtubeId(data ?? null))
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!id) return null

  return (
    <section id="kickoff" className="relative scroll-mt-16 bg-pad-cream px-4 pt-24 sm:px-6 lg:px-8 lg:pt-32">
      <div className="mx-auto max-w-5xl">
        <SectionHeading
          align="center"
          eyebrow="Week of Giving kickoff"
          title={
            <>
              Watch the <span className="italic text-pad-gold-600">kickoff.</span>
            </>
          }
          description="Hear from P.A.D. leadership on why this week matters and where your gift goes."
        />
        <div className="mt-10 overflow-hidden rounded-[2rem] bg-pad-purple-950 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)] ring-1 ring-pad-gold-400/25">
          <div className="relative aspect-video">
            <iframe
              className="absolute inset-0 h-full w-full"
              src={`https://www.youtube-nocookie.com/embed/${id}?rel=0`}
              title="PAD Week of Giving kickoff video"
              loading="lazy"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </div>
      </div>
    </section>
  )
}
