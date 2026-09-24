import { useEffect, useState } from 'react'
import crest from '../assets/brand/pad-crest.png'
import { campaign, withTracking } from '../lib/campaign'
import { logEvent } from '../lib/tracking'

const links = [
  { href: '#mission', label: 'Mission' },
  { href: '#heritage', label: 'Heritage' },
  { href: '#give-tiers', label: 'Give' },
  { href: '#moments', label: 'Moments' },
]

/** Transparent over the hero, turns into a frosted purple bar once the page scrolls. */
export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'border-b border-pad-gold-400/15 bg-pad-purple-950/85 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.5)] backdrop-blur-xl'
          : 'border-b border-transparent bg-transparent'
      }`}
    >
      <div
        className={`mx-auto flex max-w-6xl items-center justify-between px-6 transition-all duration-300 lg:px-8 ${
          scrolled ? 'h-16' : 'h-20'
        }`}
      >
        <a href="#top" className="flex items-center gap-3" aria-label="Phi Alpha Delta, back to top">
          <img
            src={crest}
            alt=""
            className={`w-auto drop-shadow-[0_0_16px_rgba(201,161,58,0.45)] transition-all duration-300 ${
              scrolled ? 'h-9' : 'h-11'
            }`}
          />
          <span className="leading-tight">
            <span className="block text-sm font-bold uppercase tracking-[0.25em] text-white">Phi Alpha Delta</span>
            <span className="block text-[10px] uppercase tracking-[0.3em] text-pad-gold-300/80">Day of Giving 2026</span>
          </span>
        </a>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Sections">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="group relative text-sm font-medium text-purple-100/80 transition-colors hover:text-white"
            >
              {l.label}
              <span className="absolute -bottom-1.5 left-0 h-px w-0 bg-pad-gold-400 transition-all duration-300 group-hover:w-full" />
            </a>
          ))}
        </nav>

        <a
          href={withTracking(campaign.donateUrl, { utm_campaign: 'header' })}
          onClick={() => logEvent('donate_click', { placement: 'header' })}
          className="btn-gold hidden rounded-full px-6 py-2.5 text-sm font-extrabold uppercase tracking-wider transition-transform hover:scale-105 active:scale-95 sm:inline-block"
        >
          Give Now
        </a>
      </div>
    </header>
  )
}
