import { campaign, withTracking } from '../lib/campaign'
import { logEvent } from '../lib/tracking'

/** Always-visible thumb-reachable donate CTA on mobile, hidden on desktop where the hero/lead-capture buttons are already in view. */
export function StickyMobileCta() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-pad-gold-500/20 bg-pad-purple-950/95 p-3 backdrop-blur sm:hidden">
      <a
        href={withTracking(campaign.donateUrl, { utm_campaign: 'sticky_mobile' })}
        onClick={() => logEvent('donate_click', { placement: 'sticky_mobile' })}
        className="block rounded-full bg-pad-gold-500 py-3 text-center text-base font-bold text-pad-purple-950 shadow-lg active:scale-95"
      >
        Give Now
      </a>
    </div>
  )
}
