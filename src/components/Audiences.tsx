import { motion } from 'framer-motion'
import { Photo } from './Photo'
import { TiltCard } from './TiltCard'
import type { PhotoSlot } from '../lib/photos'

const audiences: { slot: PhotoSlot; kicker: string; title: string; body: string; archival?: boolean }[] = [
  {
    slot: 'students',
    kicker: 'The future',
    title: 'Students',
    body: 'Pre-law and law students finding mentors, scholarships, and a network from their first semester on.',
  },
  {
    slot: 'founders',
    kicker: 'Since 1902',
    title: 'Founders',
    body: 'A legacy that started in Chicago and became the first law fraternity open to every gender, race, creed, and nation.',
    archival: true,
  },
  {
    slot: 'alumni',
    kicker: 'The bench & bar',
    title: 'Alumni',
    body: 'Attorneys, judges, and leaders who give back so the next member walks in with a head start.',
  },
]

export function Audiences() {
  return (
    <section className="relative overflow-hidden bg-pad-cream px-6 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <h2 className="max-w-2xl font-[family-name:var(--font-display)] text-5xl font-extrabold leading-[0.95] text-pad-purple-900 md:text-7xl">
            One fraternity.
            <br />
            <span className="italic text-pad-gold-600">Every generation.</span>
          </h2>
          <p className="max-w-sm text-lg text-pad-purple-700/70">
            Your gift reaches every stage of a P.A.D. member's journey, from the first pre-law meeting to the courtroom.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {audiences.map((a, i) => (
            <motion.div
              key={a.title}
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.7, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
              className={i === 1 ? 'md:mt-16' : ''}
            >
              <TiltCard className="h-[480px] overflow-hidden rounded-[2rem] shadow-[0_30px_80px_-20px_rgba(43,20,84,0.55)] ring-1 ring-pad-purple-900/10 transition-shadow duration-500 hover:shadow-[0_40px_100px_-20px_rgba(201,161,58,0.55)] hover:ring-2 hover:ring-pad-gold-400 md:h-[540px]">
                <Photo
                  slot={a.slot}
                  tone={a.archival ? 'archival' : 'none'}
                  className="absolute inset-0 h-full w-full transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-pad-purple-950 via-pad-purple-950/50 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-8">
                  <p className="text-xs font-bold uppercase tracking-[0.3em] text-pad-gold-300">{a.kicker}</p>
                  <h3 className="mt-2 font-[family-name:var(--font-display)] text-5xl font-extrabold text-white">{a.title}</h3>
                  <div className="mt-3 h-1 w-12 rounded-full bg-pad-gold-400 transition-all duration-500 group-hover:w-24" />
                  <p className="mt-4 text-purple-100/85">{a.body}</p>
                </div>
                <span className="absolute right-6 top-6 font-[family-name:var(--font-display)] text-6xl font-extrabold text-white/15">
                  0{i + 1}
                </span>
              </TiltCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
