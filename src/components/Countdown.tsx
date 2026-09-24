import { useEffect, useState } from 'react'

function remaining(target: number) {
  const ms = Math.max(0, target - Date.now())
  return {
    days: Math.floor(ms / 86_400_000),
    hours: Math.floor((ms / 3_600_000) % 24),
    minutes: Math.floor((ms / 60_000) % 60),
    seconds: Math.floor((ms / 1000) % 60),
    done: ms === 0,
  }
}

export function Countdown({ iso }: { iso: string }) {
  const target = new Date(iso).getTime()
  const [t, setT] = useState(() => remaining(target))

  useEffect(() => {
    const id = setInterval(() => setT(remaining(target)), 1000)
    return () => clearInterval(id)
  }, [target])

  if (Number.isNaN(target)) return null
  if (t.done) {
    return (
      <p className="rounded-full bg-pad-gold-400/15 px-5 py-2 text-sm font-bold uppercase tracking-[0.25em] text-pad-gold-300">
        Giving is live today
      </p>
    )
  }

  return (
    <div className="flex gap-2 sm:gap-3">
      {(
        [
          ['Days', t.days],
          ['Hrs', t.hours],
          ['Min', t.minutes],
          ['Sec', t.seconds],
        ] as const
      ).map(([label, value]) => (
        <div
          key={label}
          className="w-16 rounded-xl border border-pad-gold-400/30 bg-white/5 py-2 text-center backdrop-blur-md sm:w-20"
        >
          <div className="font-[family-name:var(--font-display)] text-2xl font-bold tabular-nums text-white sm:text-3xl">
            {String(value).padStart(2, '0')}
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-pad-gold-300/80">{label}</div>
        </div>
      ))}
    </div>
  )
}
