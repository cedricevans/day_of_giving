import { useEffect, useRef, useState } from 'react'
import { animate, useInView } from 'framer-motion'
import { padFacts } from '../lib/campaign'

function Counter({ to, suffix = '' }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.5 })
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!inView) return
    const controls = animate(0, to, { duration: 2, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => setValue(Math.round(v)) })
    return () => controls.stop()
  }, [inView, to])

  return (
    <span ref={ref} className="tabular-nums">
      {value.toLocaleString()}
      {suffix}
    </span>
  )
}

const stats = [
  { value: padFacts.members, suffix: '+', label: 'Members worldwide' },
  { value: padFacts.chapters, suffix: '', label: 'Pre-law, law & alumni chapters' },
  { value: padFacts.newMembersPerYear, suffix: '', label: 'New members every year' },
  { value: padFacts.supremeCourtJustices, suffix: '', label: 'Sitting U.S. Supreme Court Justices' },
]

export function Stats() {
  return (
    <section className="relative border-b border-white/5 bg-pad-purple-950 px-6 py-16 lg:px-8 lg:py-20">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="border-l-2 border-pad-gold-500/60 pl-5">
            <p className="text-gold-gradient font-[family-name:var(--font-display)] text-4xl font-extrabold md:text-6xl">
              <Counter to={s.value} suffix={s.suffix} />
            </p>
            <p className="mt-2 text-sm uppercase tracking-[0.15em] text-purple-100/60">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
