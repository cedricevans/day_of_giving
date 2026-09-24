import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { Photo } from './Photo'
import { campaign, withTracking } from '../lib/campaign'
import { logEvent } from '../lib/tracking'

export function FinalCta() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], ['-15%', '15%'])

  return (
    <section ref={ref} className="grain relative flex min-h-[80vh] items-center overflow-hidden px-6 py-24">
      <motion.div style={{ y }} className="absolute -inset-y-[15%] inset-x-0">
        <Photo slot="cta" plain className="h-full w-full" />
      </motion.div>
      <div className="absolute inset-0 bg-gradient-to-r from-pad-purple-950 via-pad-purple-900/85 to-pad-purple-700/60" />

      <div className="relative mx-auto w-full max-w-6xl">
        <h2 className="max-w-4xl font-[family-name:var(--font-display)] text-6xl font-extrabold leading-[0.9] text-white md:text-8xl">
          Be the reason someone <span className="text-gold-gradient whitespace-nowrap italic">makes it.</span>
        </h2>
        <p className="mt-8 max-w-lg text-xl text-purple-100/80">
          One gift today opens doors for the next generation of Phi Alpha Delta.
        </p>
        <a
          href={withTracking(campaign.donateUrl, { utm_campaign: 'final_cta' })}
          onClick={() => logEvent('donate_click', { placement: 'final_cta' })}
          className="btn-gold mt-10 inline-block rounded-full px-14 py-6 text-xl font-extrabold uppercase tracking-wider transition-transform hover:scale-105 active:scale-95"
        >
          Give Now
        </a>
      </div>
    </section>
  )
}
