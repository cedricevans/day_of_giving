import { useEffect, useState } from 'react'

function remaining(target: number, now: number) {
  const ms = Math.max(0, target - now)
  return {
    days: Math.floor(ms / 86_400_000),
    hours: Math.floor((ms / 3_600_000) % 24),
    minutes: Math.floor((ms / 60_000) % 60),
    seconds: Math.floor((ms / 1000) % 60),
  }
}

export function Countdown({ start, end }: { start: string; end: string }) {
  const startMs = new Date(start).getTime()
  const endMs = new Date(end).getTime()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // PAD wants the clock gone once it reaches zero at the official kickoff.
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || now >= startMs) return null

  const t = remaining(startMs, now)
  const label = 'Giving is open now · Official kickoff Sunday, Nov 8'

  const digits = (
    <div className="flex gap-2 sm:gap-3">
      {(
        [
          ['Days', t.days],
          ['Hrs', t.hours],
          ['Min', t.minutes],
          ['Sec', t.seconds],
        ] as const
      ).map(([unit, value]) => (
        <div
          key={unit}
          className="w-16 rounded-xl border border-pad-gold-400/30 bg-white/5 py-2 text-center backdrop-blur-md sm:w-20"
        >
          <div className="font-[family-name:var(--font-display)] text-2xl font-bold tabular-nums text-white sm:text-3xl">
            {String(value).padStart(2, '0')}
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-pad-gold-300/80">{unit}</div>
        </div>
      ))}
    </div>
  )

  return (
    <div>
      <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.25em] text-pad-gold-300">{label}</p>
      {digits}
    </div>
  )
}
