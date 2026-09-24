import { motion } from 'framer-motion'
import { campaign } from '../lib/campaign'

function formatCents(cents: number) {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}

/**
 * "Raised so far" bar — updated manually from campaign.raisedCents after each
 * weekly YM export (see Step 8 in pad-landing-page-plan.md) until the API is
 * live and this can be wired to real-time data.
 */
export function ProgressBar() {
  const pct = Math.min(100, (campaign.raisedCents / campaign.goalCents) * 100)

  return (
    <section className="relative overflow-hidden bg-pad-purple-900 px-6 py-16">
      <div
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            'repeating-linear-gradient(-45deg, var(--color-pad-gold-500) 0px, var(--color-pad-gold-500) 1px, transparent 1px, transparent 60px)',
        }}
      />
      <div className="relative mx-auto max-w-3xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-pad-gold-300">
          Raised so far
        </p>
        <p className="mt-2 font-[family-name:var(--font-display)] text-5xl font-bold text-white">
          {formatCents(campaign.raisedCents)}
          <span className="text-2xl font-normal text-purple-200/60">
            {' '}
            of {formatCents(campaign.goalCents)}
          </span>
        </p>

        <div className="mt-6 h-4 w-full overflow-hidden rounded-full bg-white/10">
          <motion.div
            initial={{ width: 0 }}
            whileInView={{ width: `${pct}%` }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            className="h-full rounded-full bg-gradient-to-r from-pad-gold-500 to-pad-gold-300"
          />
        </div>
        <p className="mt-3 text-sm text-purple-200/50">
          Updated regularly from PAD's donation records.
        </p>
      </div>
    </section>
  )
}
