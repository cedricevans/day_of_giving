import { useState } from 'react'
import { campaign, withTracking } from '../lib/campaign'
import { captureLead, logEvent } from '../lib/tracking'
import type { LeadIntent } from '../lib/database.types'

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
    <section id="give" className="bg-pad-cream px-6 py-24">
      <div className="mx-auto max-w-xl rounded-3xl border border-pad-purple-700/10 bg-white p-8 shadow-[0_20px_60px_-15px_rgba(43,20,84,0.25)] sm:p-12">
        <h2 className="font-[family-name:var(--font-display)] text-3xl font-bold text-pad-purple-900">
          Ready to make an impact?
        </h2>
        <p className="mt-2 text-pad-purple-700/70">
          Leave your email so we can say thanks — totally optional, and it
          won't slow you down. You'll finish on PAD's secure donation page.
        </p>

        <div className="mt-6 flex flex-col gap-3">
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
    </section>
  )
}
