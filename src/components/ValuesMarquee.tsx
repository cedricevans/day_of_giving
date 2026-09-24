import { padFacts } from '../lib/campaign'

export function ValuesMarquee() {
  const items = [...padFacts.values, ...padFacts.values]
  return (
    <div className="relative overflow-hidden border-y border-pad-gold-500/40 bg-gradient-to-r from-pad-gold-600 via-pad-gold-400 to-pad-gold-600 py-4">
      <div className="flex w-max animate-[marquee_40s_linear_infinite] gap-10 whitespace-nowrap">
        {items.map((v, i) => (
          <span key={i} className="flex items-center gap-10 font-[family-name:var(--font-display)] text-2xl font-bold italic text-pad-purple-950 md:text-3xl">
            {v}
            <span className="text-base not-italic text-pad-purple-800/60">◆</span>
          </span>
        ))}
      </div>
    </div>
  )
}
