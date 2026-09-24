import crest from '../assets/brand/pad-crest.png'
import { campaign } from '../lib/campaign'

export function Footer() {
  return (
    <footer className="bg-pad-purple-950 px-6 py-12 pb-20 text-center sm:pb-12">
      <img src={crest} alt="Phi Alpha Delta crest" className="mx-auto h-14 w-auto opacity-80" />
      <p className="mt-4 text-sm text-purple-200/60">{campaign.org}</p>
      <p className="mt-1 text-xs text-purple-200/40">
        All gifts are processed securely on pad.org. This page does not
        collect or store payment information. We log approximate visit
        location (state/country, from IP address) to understand where
        support for this campaign is coming from.
      </p>
      <a
        href="/admin"
        className="mt-6 inline-block text-xs text-purple-200/25 transition-colors hover:text-pad-gold-400"
      >
        Campaign team login
      </a>
    </footer>
  )
}
