import { motion } from 'framer-motion'
import { campaign, withTracking } from '../lib/campaign'
import { logEvent } from '../lib/tracking'
import { TiltCard } from './TiltCard'
import { SectionHeading } from './SectionHeading'

// Tier names are campaign flavor only. 25-1000 are PAD's donate.asp preset
// amounts; 2500/10000 route to PAD's custom-amount field (see campaign.ts).
const tierNames: Record<number, string> = {
  25: 'Supporter',
  50: 'Friend',
  100: 'Advocate',
  250: 'Counselor',
  500: 'Barrister',
  1000: 'Justice Circle',
  2500: "Founder's Circle",
  10000: 'Legacy Society',
}
const presetAmounts = new Set([25, 50, 100, 250, 500, 1000])
const featured = 100

export function GivingTiers() {
  return (
    <section id="give-tiers" className="relative overflow-hidden bg-pad-purple-950 px-6 py-24 lg:px-8 lg:py-32">
      <div className="absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-pad-purple-600/30 blur-[140px]" />
      <div className="relative mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Pick your impact"
          tone="dark"
          align="center"
          title={
            <>
              Every gift <span className="text-gold-gradient italic">counts.</span>
            </>
          }
          description="Tap an amount to head to PAD's secure donation page, then enter the same amount there. One-time or monthly."
        />

        <div className="mt-16 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
          {campaign.giftAmounts.map((amount, i) => {
            const isFeatured = amount === featured
            return (
              <motion.div
                key={amount}
                initial={{ opacity: 0, y: 40, scale: 0.95 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
              >
                <TiltCard
                  className={`h-full rounded-3xl p-[1.5px] ${
                    isFeatured
                      ? 'bg-gradient-to-br from-pad-gold-300 via-pad-gold-500 to-pad-gold-600 shadow-[0_20px_60px_-10px_rgba(201,161,58,0.6)]'
                      : 'bg-gradient-to-br from-white/20 to-white/5 hover:from-pad-gold-300 hover:to-pad-gold-600'
                  } transition-colors duration-300`}
                >
                  <a
                    href={withTracking(campaign.donateUrl, { utm_campaign: `tier_${amount}` })}
                    onClick={() => logEvent('donate_click', { placement: 'tiers', amount })}
                    className={`flex h-full flex-col rounded-[calc(1.5rem-1.5px)] p-6 md:p-8 ${
                      isFeatured ? 'bg-gradient-to-br from-pad-purple-700 to-pad-purple-900' : 'bg-pad-purple-900/90 backdrop-blur'
                    }`}
                  >
                    {isFeatured && (
                      <span className="mb-4 self-start rounded-full bg-pad-gold-400 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.2em] text-pad-purple-950">
                        Suggested
                      </span>
                    )}
                    <p className="text-xs font-bold uppercase tracking-[0.25em] text-pad-gold-300/90">{tierNames[amount]}</p>
                    <p className="mt-2 font-[family-name:var(--font-display)] text-4xl font-extrabold text-white md:text-5xl">
                      ${amount.toLocaleString()}
                    </p>
                    {!presetAmounts.has(amount) && (
                      <p className="mt-1 text-xs text-purple-200/50">Enter as a custom amount on PAD's form</p>
                    )}
                    <span className="mt-6 inline-flex items-center gap-2 whitespace-nowrap text-sm font-bold text-pad-gold-300 transition-transform group-hover:translate-x-1">
                      Give ${amount.toLocaleString()} <span aria-hidden="true">→</span>
                    </span>
                  </a>
                </TiltCard>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
