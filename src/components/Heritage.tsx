import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { Photo } from './Photo'
import { padFacts } from '../lib/campaign'
import { SectionHeading } from './SectionHeading'

// Sourced from pad.org/page/history and Wikipedia (founding city, 1972 merger).
const milestones = [
  { year: '1902', title: 'Founded in Chicago', body: 'Phi Alpha Delta is established on November 8, 1902.' },
  {
    year: '1972',
    title: 'Phi Delta Delta joins',
    body: "Phi Delta Delta Women's Legal Fraternity becomes part of P.A.D.",
  },
  {
    year: 'First',
    title: 'Open to all',
    body: 'The first law fraternity to open membership to all genders, races, creeds, and national origins.',
  },
  {
    year: 'First',
    title: 'Pre-law pioneer',
    body: 'The first law fraternity to establish a Pre-Law Program and hold P.A.D. Day at the Supreme Court.',
  },
  {
    year: 'Today',
    title: `${padFacts.members.toLocaleString()} strong`,
    body: `${padFacts.chapters} chartered chapters across pre-law, law, and alumni.`,
  },
]

export function Heritage() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const photoY = useTransform(scrollYProgress, [0, 1], ['-12%', '12%'])
  const lineScale = useTransform(scrollYProgress, [0.15, 0.65], [0, 1])
  const bigYearX = useTransform(scrollYProgress, [0, 1], ['10%', '-30%'])

  return (
    <section id="heritage" ref={ref} className="grain relative overflow-hidden bg-pad-purple-900 px-6 py-24 lg:px-8 lg:py-32">
      <motion.p
        style={{ x: bigYearX }}
        aria-hidden="true"
        className="pointer-events-none absolute -top-6 left-0 select-none whitespace-nowrap font-[family-name:var(--font-display)] text-[28vw] font-extrabold leading-none text-white/[0.04]"
      >
        Est. 1902
      </motion.p>

      <div className="relative mx-auto grid max-w-6xl items-start gap-16 md:grid-cols-2 lg:gap-24">
        <div className="md:sticky md:top-28">
          <SectionHeading
            eyebrow="Our heritage"
            tone="dark"
            title={
              <>
                Over a century of <span className="text-gold-gradient italic">firsts.</span>
              </>
            }
          />
          <div className="relative mt-10 aspect-[4/5] overflow-hidden rounded-[2rem] ring-1 ring-pad-gold-400/30">
            <motion.div style={{ y: photoY }} className="absolute -inset-y-[12%] inset-x-0">
              <Photo slot="heritage" tone="archival" className="h-full w-full" alt="Phi Alpha Delta history" />
            </motion.div>
            <div className="absolute inset-0 bg-gradient-to-t from-pad-purple-950/80 to-transparent" />
            <p className="absolute bottom-6 left-6 right-6 font-[family-name:var(--font-display)] text-xl italic text-pad-gold-300">
              "{padFacts.mission}"
            </p>
          </div>
        </div>

        <div className="relative pl-10">
          <div className="absolute bottom-0 left-3 top-0 w-px bg-white/10" />
          <motion.div style={{ scaleY: lineScale }} className="absolute bottom-0 left-3 top-0 w-px origin-top bg-gradient-to-b from-pad-gold-300 to-pad-gold-600" />
          {milestones.map((m, i) => (
            <motion.div
              key={m.title}
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.6, delay: i * 0.05 }}
              className="relative mb-14 last:mb-0"
            >
              <span className="absolute -left-[34px] top-3 h-4 w-4 rounded-full border-2 border-pad-gold-300 bg-pad-purple-900 shadow-[0_0_20px_rgba(232,205,133,0.8)]" />
              <p className="text-gold-gradient font-[family-name:var(--font-display)] text-5xl font-extrabold md:text-6xl">{m.year}</p>
              <h3 className="mt-2 text-2xl font-bold text-white">{m.title}</h3>
              <p className="mt-2 max-w-md text-purple-100/70">{m.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
