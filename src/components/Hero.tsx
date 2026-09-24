import { useEffect, useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import crest from '../assets/brand/pad-crest.png'
import { campaign, withTracking } from '../lib/campaign'
import { logEvent } from '../lib/tracking'

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  })

  // Parallax: background drifts slower than scroll, crest drifts faster + fades.
  const bgY = useTransform(scrollYProgress, [0, 1], ['0%', '35%'])
  const crestY = useTransform(scrollYProgress, [0, 1], ['0%', '60%'])
  const contentY = useTransform(scrollYProgress, [0, 1], ['0%', '20%'])
  const contentOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0])

  useEffect(() => {
    logEvent('page_view', { path: window.location.pathname })
  }, [])

  return (
    <section
      ref={sectionRef}
      className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-pad-purple-950"
    >
      {/* Parallax background layer: radial glow + gold texture lines */}
      <motion.div
        style={{ y: bgY }}
        className="absolute inset-0 -z-10"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--color-pad-purple-700)_0%,_var(--color-pad-purple-950)_65%)]" />
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'repeating-linear-gradient(135deg, var(--color-pad-gold-500) 0px, var(--color-pad-gold-500) 1px, transparent 1px, transparent 80px)',
          }}
        />
      </motion.div>

      {/* Large faint crest, parallaxing faster for depth */}
      <motion.img
        src={crest}
        alt=""
        aria-hidden="true"
        style={{ y: crestY }}
        className="pointer-events-none absolute -right-24 top-1/2 w-[420px] -translate-y-1/2 opacity-[0.08] md:w-[560px]"
      />

      <motion.div
        style={{ y: contentY, opacity: contentOpacity }}
        className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-6 text-center animate-fade-up"
      >
        <img src={crest} alt="Phi Alpha Delta crest" className="mb-6 h-24 w-auto drop-shadow-[0_0_24px_rgba(201,161,58,0.35)] md:h-28" />

        <span className="mb-4 inline-flex items-center rounded-full border border-pad-gold-400/40 bg-pad-gold-400/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-pad-gold-300">
          {campaign.org}
        </span>

        <h1 className="font-[family-name:var(--font-display)] text-5xl font-bold leading-[1.05] text-white sm:text-6xl md:text-7xl">
          {campaign.name.replace(' 2026', '')}
          <span className="block text-pad-gold-400">2026</span>
        </h1>

        <p className="mt-6 max-w-xl text-lg text-purple-100/80 md:text-xl">
          One day, one Fraternity, one mission. Every gift fuels scholarships,
          leadership, and the next generation of lawyers living Legal Justice
          for All.
        </p>

        <div className="mt-10 flex w-full flex-col gap-4 sm:w-auto sm:flex-row">
          <a
            href={withTracking(campaign.donateUrl, { utm_campaign: 'hero' })}
            onClick={() => logEvent('donate_click', { placement: 'hero' })}
            className="group relative overflow-hidden rounded-full bg-pad-gold-500 px-10 py-4 text-center text-lg font-bold text-pad-purple-950 shadow-[0_8px_30px_rgba(201,161,58,0.35)] transition-transform hover:scale-105 active:scale-95"
          >
            Give Now
          </a>
          <a
            href={withTracking(campaign.joinUrl, { utm_campaign: 'hero' })}
            onClick={() => logEvent('join_click', { placement: 'hero' })}
            className="rounded-full border-2 border-white/30 px-10 py-4 text-center text-lg font-semibold text-white transition-colors hover:border-pad-gold-400 hover:bg-white/5"
          >
            Join PAD
          </a>
        </div>
      </motion.div>

      {/* Scroll cue */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce text-pad-gold-300/70">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12l7 7 7-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </section>
  )
}
