import { useEffect, useRef, useState } from 'react'
import { animate, motion } from 'framer-motion'
import { campaign, withTracking } from '../lib/campaign'
import { useScoreboard } from '../lib/community'
import { logEvent } from '../lib/tracking'
import { ChapterInput } from './ChapterInput'

function dollars(cents: number) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

/** Counts up from wherever it was to the new value, so refreshes tick instead of jump. */
function Ticker({ value, format = (n: number) => n.toLocaleString() }: { value: number; format?: (n: number) => string }) {
  const [shown, setShown] = useState(0)
  const from = useRef(0)

  useEffect(() => {
    const controls = animate(from.current, value, {
      duration: 1.6,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setShown(Math.round(v)),
    })
    from.current = value
    return () => controls.stop()
  }, [value])

  return <span className="tabular-nums">{format(shown)}</span>
}

const milestones = [25, 50, 75]

export function Scoreboard() {
  const { score, leaders } = useScoreboard()
  const raised = score?.raised_cents ?? 0
  const pct = Math.min(100, (raised / campaign.goalCents) * 100)
  const topRaised = Math.max(1, ...leaders.map((l) => l.raised_cents))
  const rankByDollars = leaders.some((l) => l.raised_cents > 0)
  const topSupporters = Math.max(1, ...leaders.map((l) => l.supporters + l.posts))

  const tiles = [
    { label: 'Donors', value: score?.donor_count ?? 0 },
    { label: 'Chapters in', value: score?.chapters_participating ?? 0 },
    { label: 'Wall posts', value: score?.wall_posts ?? 0 },
  ]

  return (
    <section id="scoreboard" className="relative overflow-hidden bg-pad-purple-700 px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_15%_0%,rgba(232,205,133,0.35),transparent_55%),radial-gradient(ellipse_at_100%_100%,rgba(30,15,51,0.8),transparent_60%)]" />
      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-pad-gold-600 via-pad-gold-300 to-pad-gold-600" />

      <div className="relative mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="inline-flex items-center gap-2.5 rounded-full bg-pad-purple-950 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.25em] text-pad-gold-300">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pad-gold-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-pad-gold-400" />
            </span>
            The Scoreboard
          </p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.35fr_1fr] lg:gap-8">
          {/* Money + progress */}
          <div className="rounded-[2rem] bg-pad-purple-950 p-6 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)] ring-1 ring-pad-gold-400/25 sm:p-10">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-purple-100/70">Raised so far</p>
            <p className="mt-2 break-words font-[family-name:var(--font-display)] text-6xl font-black leading-none text-white sm:text-8xl">
              <Ticker value={raised} format={(n) => dollars(n)} />
            </p>
            <p className="mt-3 text-lg font-semibold text-pad-gold-300">
              of our {dollars(campaign.goalCents)} goal
            </p>

            <div className="relative mt-8">
              <div className="h-9 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${Math.max(pct, 3)}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.4, ease: 'easeOut' }}
                  className="relative h-full rounded-full bg-[linear-gradient(90deg,#a37f1f,#e8cd85,#fbe8b0)] shadow-[0_0_30px_rgba(232,205,133,0.7)]"
                >
                  <div className="absolute inset-0 animate-[shimmer_2.5s_linear_infinite] rounded-full bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.35)_0_12px,transparent_12px_24px)] bg-[length:200%_100%]" />
                </motion.div>
              </div>
              {milestones.map((m) => (
                <span
                  key={m}
                  className="absolute top-0 h-9 w-0.5 bg-pad-purple-950/60"
                  style={{ left: `${m}%` }}
                  aria-hidden="true"
                />
              ))}
              <div className="mt-2 flex justify-between text-xs font-bold text-purple-100/50">
                <span>$0</span>
                <span className="text-2xl font-black text-pad-gold-300 sm:text-3xl">{Math.floor(pct)}%</span>
                <span>{dollars(campaign.goalCents)}</span>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-3">
              {tiles.map((t) => (
                <div key={t.label} className="rounded-2xl bg-pad-gold-400 px-3 py-4 text-center sm:py-5">
                  <p className="font-[family-name:var(--font-display)] text-3xl font-black text-pad-purple-950 sm:text-5xl">
                    <Ticker value={t.value} />
                  </p>
                  <p className="mt-1 text-[10px] font-extrabold uppercase tracking-[0.15em] text-pad-purple-900/80 sm:text-xs">
                    {t.label}
                  </p>
                </div>
              ))}
            </div>

            <p className="mt-6 text-xs leading-relaxed text-purple-100/50">
              Dollar totals update as gifts are recorded from PAD's giving records
              {score?.last_recorded_at ? `, last on ${new Date(score.last_recorded_at).toLocaleDateString()}` : ''}.
              Chapters in counts chapters named by givers and Wall posters.
            </p>
          </div>

          {/* Chapter challenge */}
          <div className="flex flex-col rounded-[2rem] bg-pad-cream p-6 text-pad-purple-950 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)] sm:p-8">
            <h3 className="font-[family-name:var(--font-display)] text-3xl font-black leading-tight sm:text-4xl">
              Chapter <span className="italic text-pad-gold-600">Challenge</span>
            </h3>
            <p className="mt-1 text-sm font-medium text-pad-purple-700/70">
              {rankByDollars ? 'Ranked by dollars raised.' : 'Ranked by members showing up. Put your chapter on the board.'}
            </p>

            {leaders.length > 0 ? (
              <ol className="mt-5 space-y-2.5">
                {leaders.map((l, i) => {
                  const metric = rankByDollars ? l.raised_cents / topRaised : (l.supporters + l.posts) / topSupporters
                  return (
                    <li key={l.chapter} className="relative overflow-hidden rounded-xl bg-white px-3 py-2.5 ring-1 ring-pad-purple-700/10">
                      <div
                        className="absolute inset-y-0 left-0 bg-pad-gold-300/40"
                        style={{ width: `${Math.max(4, metric * 100)}%` }}
                        aria-hidden="true"
                      />
                      <div className="relative flex items-center gap-3">
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                            i === 0 ? 'bg-pad-gold-500 text-pad-purple-950' : 'bg-pad-purple-900 text-white'
                          }`}
                        >
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-bold">{l.chapter}</span>
                        <span className="shrink-0 text-sm font-extrabold tabular-nums text-pad-purple-800">
                          {rankByDollars
                            ? dollars(l.raised_cents)
                            : `${l.supporters + l.posts} ${l.supporters + l.posts === 1 ? 'supporter' : 'supporters'}`}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ol>
            ) : (
              <div className="mt-5 flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-pad-purple-700/20 px-6 py-10 text-center">
                <p className="font-[family-name:var(--font-display)] text-5xl font-black text-pad-gold-500">#1</p>
                <p className="mt-2 font-bold">This spot is open.</p>
                <p className="mt-1 text-sm text-pad-purple-700/70">Name your chapter and give. First one on the board leads it.</p>
              </div>
            )}

            <div className="mt-auto pt-6">
              <ChapterInput label="Repping a chapter?" />
              <a
                href={withTracking(campaign.donateUrl, { utm_campaign: 'scoreboard' })}
                onClick={() => logEvent('donate_click', { placement: 'scoreboard' })}
                className="btn-gold mt-3 block rounded-full py-4 text-center text-lg font-extrabold uppercase tracking-wider transition-transform hover:scale-[1.02] active:scale-95"
              >
                Give for your chapter
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
