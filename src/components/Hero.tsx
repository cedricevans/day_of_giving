import { useEffect, useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import crest from '../assets/brand/pad-crest.png'
import { campaign, padFacts, withTracking } from '../lib/campaign'
import { logEvent } from '../lib/tracking'
import { Photo } from './Photo'
import { Countdown } from './Countdown'

const rise = {
  hidden: { opacity: 0, y: 40 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: 0.15 + i * 0.12, duration: 0.8, ease: [0.22, 1, 0.36, 1] as const } }),
}

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end start'] })

  const photoY = useTransform(scrollYProgress, [0, 1], ['0%', '30%'])
  const photoScale = useTransform(scrollYProgress, [0, 1], [1.1, 1.25])
  const crestY = useTransform(scrollYProgress, [0, 1], ['0%', '80%'])
  const crestRotate = useTransform(scrollYProgress, [0, 1], [0, 12])
  const contentY = useTransform(scrollYProgress, [0, 1], ['0%', '25%'])
  const contentOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0])

  useEffect(() => {
    logEvent('page_view', { path: window.location.pathname })
  }, [])

  return (
    <section id="top" ref={sectionRef} className="grain relative flex min-h-[100svh] items-center overflow-hidden bg-pad-purple-950">
      <motion.div style={{ y: photoY, scale: photoScale }} className="absolute inset-0">
        <Photo slot="hero" plain className="h-full w-full" alt="Phi Alpha Delta members together" />
      </motion.div>

      {/* Brand wash over the photo so type always reads */}
      <div className="absolute inset-0 bg-gradient-to-b from-pad-purple-950/70 via-pad-purple-900/60 to-pad-purple-950" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_30%,rgba(94,59,163,0.55),transparent_60%)]" />

      <motion.img
        src={crest}
        alt=""
        aria-hidden="true"
        style={{ y: crestY, rotate: crestRotate }}
        className="pointer-events-none absolute -right-40 top-16 hidden w-[640px] opacity-[0.06] lg:block"
      />

      <motion.div
        style={{ y: contentY, opacity: contentOpacity }}
        className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-28 pt-32 lg:px-8 lg:pt-36"
      >
        <motion.div custom={0} variants={rise} initial="hidden" animate="show" className="mb-8 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-pad-gold-400/40 bg-pad-purple-950/40 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.25em] text-pad-gold-300 backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-pad-gold-400 shadow-[0_0_10px_rgba(232,205,133,0.9)]" />
            2026 Campaign
          </span>
          <span className="hidden text-[11px] uppercase tracking-[0.25em] text-purple-100/60 sm:inline">
            Law Fraternity, International · Est. {padFacts.founded}
          </span>
        </motion.div>

        <motion.h1
          custom={1}
          variants={rise}
          initial="hidden"
          animate="show"
          className="font-[family-name:var(--font-display)] text-[19vw] font-extrabold leading-[0.88] tracking-tight text-white sm:text-[12vw] lg:text-[9rem]"
        >
          Day of
          <br />
          <span className="text-gold-gradient italic">Giving</span>
        </motion.h1>

        <motion.p custom={2} variants={rise} initial="hidden" animate="show" className="mt-8 max-w-xl border-l-2 border-pad-gold-400/60 pl-5 text-lg leading-relaxed text-purple-100/85 md:text-xl">
          {padFacts.members.toLocaleString()} members. {padFacts.chapters} chapters. One day to invest in the next
          generation of lawyers, from first-year pre-law students to the bench.
        </motion.p>

        {campaign.dayOfGivingDate && (
          <motion.div custom={3} variants={rise} initial="hidden" animate="show" className="mt-8">
            <Countdown iso={campaign.dayOfGivingDate} />
          </motion.div>
        )}

        <motion.div custom={4} variants={rise} initial="hidden" animate="show" className="mt-10 flex flex-col gap-4 sm:flex-row">
          <a
            href={withTracking(campaign.donateUrl, { utm_campaign: 'hero' })}
            onClick={() => logEvent('donate_click', { placement: 'hero' })}
            className="btn-gold rounded-full px-12 py-5 text-center text-lg font-extrabold uppercase tracking-wider transition-transform hover:scale-105 active:scale-95"
          >
            Give Now
          </a>
          <a
            href={withTracking(campaign.joinUrl, { utm_campaign: 'hero' })}
            onClick={() => logEvent('join_click', { placement: 'hero' })}
            className="rounded-full border-2 border-white/25 bg-white/5 px-10 py-5 text-center text-lg font-semibold text-white backdrop-blur-sm transition-colors hover:border-pad-gold-400 hover:text-pad-gold-300"
          >
            Join P.A.D.
          </a>
        </motion.div>
      </motion.div>

      <div className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-pad-gold-300/70 md:flex">
        <span className="text-[10px] uppercase tracking-[0.3em]">Scroll</span>
        <span className="h-10 w-px animate-pulse bg-gradient-to-b from-pad-gold-300 to-transparent" />
      </div>
    </section>
  )
}
