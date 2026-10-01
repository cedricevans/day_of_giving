import { campaign, withTracking } from '../lib/campaign'
import { logEvent } from '../lib/tracking'

/** Always-visible thumb-reachable Give + Join CTAs on mobile; the header carries both on larger screens. */
export function StickyMobileCta() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-[1.4fr_1fr] gap-2.5 border-t border-pad-gold-500/20 bg-pad-purple-950/95 p-3 backdrop-blur sm:hidden">
      <a
        href={withTracking(campaign.donateUrl, { utm_campaign: 'sticky_mobile' })}
        target="_blank"
        rel="noopener"
        onClick={() => logEvent('donate_click', { placement: 'sticky_mobile' })}
        className="btn-gold block rounded-full py-3.5 text-center text-base font-extrabold uppercase tracking-wider active:scale-95"
      >
        Give Now
      </a>
      <a
        href={withTracking(campaign.joinUrl, { utm_campaign: 'sticky_mobile' })}
        target="_blank"
        rel="noopener"
        onClick={() => logEvent('join_click', { placement: 'sticky_mobile' })}
        className="block rounded-full border-2 border-white/25 py-3 text-center text-base font-bold uppercase tracking-wider text-white active:scale-95"
      >
        Join
      </a>
    </div>
  )
}
