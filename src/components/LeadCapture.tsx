import { useState } from 'react'
import { campaign, withTracking } from '../lib/campaign'
import { captureLead, logEvent } from '../lib/tracking'
import type { LeadIntent } from '../lib/database.types'
import { SectionHeading } from './SectionHeading'

const trustPoints = [
  'Processed securely on pad.org',
  'One-time or monthly gifts',
  'Email is optional, never required',
]

/**
 * Low-friction capture: one email field (name optional), then straight on to
 * PAD. We never block or delay the donate/join links — this is "capture on
 * the way out," not a gate.
 */
export function LeadCapture() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [intent, setIntent] = useState<LeadIntent>('unspecified')
  const [status, setStatus] = useState<'idle' | 'saving' | 'done'>('idle')

  async function handleContinue(target: 'donate' | 'join') {
    const url = withTracking(target === 'donate' ? campaign.donateUrl : campaign.joinUrl, {
      utm_campaign: 'lead_capture',
    })

    if (email) {
      setStatus('saving')
      await captureLead({ name, email, intent: target })
      setStatus('done')
    } else {
      await logEvent(target === 'donate' ? 'donate_click' : 'join_click', { placement: 'lead_capture', skipped_email: true })
    }

    window.location.href = url
  }

  return (
    <section id="give" className="relative overflow-hidden bg-pad-cream px-6 pb-24 lg:px-8 lg:pb-32">
      <div className="mx-auto grid max-w-6xl items-center gap-12 border-t border-pad-purple-900/10 pt-16 lg:grid-cols-[1fr_1.05fr] lg:gap-20 lg:pt-20">
        <div>
          <SectionHeading
            eyebrow="Make it count"
            title={
              <>
                Ready to make an <span className="italic text-pad-gold-600">impact?</span>
              </>
            }
            description="Leave your email so we can say thanks. It's optional and won't slow you down. You'll finish on PAD's secure donation page."
          />
          <ul className="mt-10 space-y-4">
            {trustPoints.map((t) => (
              <li key={t} className="flex items-center gap-4 text-pad-purple-900">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-pad-purple-900 text-pad-gold-300 shadow-[0_6px_16px_-6px_rgba(43,20,84,0.6)]">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                    <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="font-medium">{t}</span>
              </li>
            ))}
          </ul>
        </div>

      <div className="relative rounded-3xl border border-pad-purple-700/10 bg-white p-8 shadow-[0_30px_80px_-24px_rgba(43,20,84,0.35)] sm:p-10">
        <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-pad-gold-400 to-transparent" />
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-pad-purple-700/60">Your details</p>

        <div className="mt-5 flex flex-col gap-3">
          <input
            type="text"
            placeholder="Name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-xl border border-pad-purple-700/15 px-4 py-3 text-pad-purple-950 outline-none transition-colors focus:border-pad-gold-500 focus:ring-2 focus:ring-pad-gold-400/30"
          />
          <input
            type="email"
            placeholder="Email (optional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border border-pad-purple-700/15 px-4 py-3 text-pad-purple-950 outline-none transition-colors focus:border-pad-gold-500 focus:ring-2 focus:ring-pad-gold-400/30"
          />
          <fieldset className="mt-1 flex gap-4 text-sm text-pad-purple-700/70">
            <legend className="sr-only">I'm interested in</legend>
            {(['donate', 'join'] as const).map((opt) => (
              <label key={opt} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="intent"
                  checked={intent === opt}
                  onChange={() => setIntent(opt)}
                  className="accent-pad-gold-500"
                />
                {opt === 'donate' ? 'I want to give' : 'I want to join'}
              </label>
            ))}
          </fieldset>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => handleContinue('donate')}
            disabled={status === 'saving'}
            className="btn-gold flex-1 whitespace-nowrap rounded-full px-4 py-4 text-base font-extrabold transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60 sm:px-8 sm:text-lg"
          >
            Continue to Give →
          </button>
          <button
            type="button"
            onClick={() => handleContinue('join')}
            disabled={status === 'saving'}
            className="flex-1 whitespace-nowrap rounded-full border-2 border-pad-purple-700/20 px-4 py-4 text-base font-semibold text-pad-purple-900 transition-colors hover:border-pad-purple-700 disabled:opacity-60 sm:px-8 sm:text-lg"
          >
            Continue to Join →
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-pad-purple-700/50">
          When PAD asks "How did you hear about us?", choose{' '}
          <span className="font-semibold">Campaign website</span> — it helps
          us track the campaign's impact.
        </p>
      </div>
      </div>
    </section>
  )
}
