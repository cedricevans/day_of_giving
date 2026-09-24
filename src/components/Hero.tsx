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
    <section ref={sectionRef} className="grain relative flex min-h-[100svh] items-center overflow-hidden bg-pad-purple-950">
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
        className="pointer-events-none absolute -right-32 top-10 w-[520px] opacity-[0.13] md:-right-20 md:w-[720px]"
      />

      <motion.div
        style={{ y: contentY, opacity: contentOpacity }}
        className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-24 pt-28 md:pt-32"
      >
        <motion.div custom={0} variants={rise} initial="hidden" animate="show" className="mb-6 flex items-center gap-3">
          <img src={crest} alt="Phi Alpha Delta crest" className="h-14 w-auto drop-shadow-[0_0_24px_rgba(201,161,58,0.5)] md:h-16" />
          <div className="leading-tight">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-pad-gold-300">Phi Alpha Delta</p>
            <p className="text-xs uppercase tracking-[0.2em] text-purple-100/60">Law Fraternity, International · Est. {padFacts.founded}</p>
          </div>
        </motion.div>

        <motion.h1
          custom={1}
          variants={rise}
          initial="hidden"
          animate="show"
          className="font-[family-name:var(--font-display)] text-[19vw] font-extrabold leading-[0.85] tracking-tight text-white sm:text-[12vw] lg:text-[10rem]"
        >
          Day of
          <br />
          <span className="text-gold-gradient italic">Giving</span>
          <span className="mt-2 block font-sans text-[0.3em] sm:ml-5 sm:mt-0 sm:inline sm:align-top sm:text-[0.22em] font-black not-italic tracking-normal text-pad-gold-300">2026</span>
        </motion.h1>

        <motion.p custom={2} variants={rise} initial="hidden" animate="show" className="mt-8 max-w-xl text-lg leading-relaxed text-purple-100/85 md:text-xl">
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
