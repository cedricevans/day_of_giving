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
    <section className="relative overflow-hidden bg-pad-purple-950 px-6 py-16 lg:px-8 lg:py-20">
      <div className="absolute left-1/2 top-1/2 h-[300px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-pad-gold-500/10 blur-[120px]" />
      <div className="relative mx-auto max-w-4xl rounded-3xl border border-pad-gold-400/20 bg-white/[0.03] p-8 backdrop-blur-sm sm:p-12">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <p className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.3em] text-pad-gold-300">
              <span className="h-px w-8 bg-pad-gold-400" />
              Raised so far
            </p>
            <p className="mt-4 font-[family-name:var(--font-display)] text-5xl font-extrabold text-white sm:text-6xl">
              {formatCents(campaign.raisedCents)}
              <span className="ml-3 font-sans text-lg font-medium text-purple-200/60">
                of {formatCents(campaign.goalCents)} goal
              </span>
            </p>
          </div>
          <p className="text-gold-gradient font-[family-name:var(--font-display)] text-4xl font-extrabold tabular-nums">
            {Math.round(pct)}%
          </p>
        </div>

        <div className="mt-8 h-3 w-full overflow-hidden rounded-full bg-white/10">
          <motion.div
            initial={{ width: 0 }}
            whileInView={{ width: `${Math.max(pct, 1.5)}%` }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            className="h-full rounded-full bg-gradient-to-r from-pad-gold-600 via-pad-gold-400 to-pad-gold-300 shadow-[0_0_20px_rgba(232,205,133,0.6)]"
          />
        </div>
        <p className="mt-4 text-sm text-purple-200/50">Updated regularly from PAD's donation records.</p>
      </div>
    </section>
  )
}
