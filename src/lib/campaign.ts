/**
 * Single source of truth for this campaign's copy + outbound links.
 * PAD processes all payments and membership on pad.org (YourMembership) —
 * we never touch card data. See ../../pad-landing-page-plan.md for the
 * no-API tracking workflow this page plugs into.
 */

const utmSource = import.meta.env.VITE_CAMPAIGN_UTM_SOURCE || 'day-of-giving-2026'

export const campaign = {
  name: 'PAD Day of Giving 2026',
  org: 'Phi Alpha Delta Law Fraternity, International',
  goalCents: 5_000_000, // $50,000 — update after Step 1 in the plan doc
  raisedCents: 0, // updated manually from the weekly YM export until the API is live
  // Fallbacks are real PAD pages so the app never crashes/dead-links when
  // .env isn't set up yet — override with VITE_PAD_DONATE_URL / VITE_PAD_JOIN_URL
  // once this campaign's fund id is created (see README + plan doc Step 1).
  donateUrl: import.meta.env.VITE_PAD_DONATE_URL || 'https://www.pad.org/donations/donate.asp?id=20711',
  joinUrl: import.meta.env.VITE_PAD_JOIN_URL || 'https://www.pad.org/general/register_start.asp',
}

/** Appends UTM + our click-id so a visit can be matched back to a lead/session later. */
export function withTracking(baseUrl: string, params: Record<string, string> = {}) {
  if (!baseUrl) {
    console.warn('[campaign] withTracking called with an empty URL')
    return '#'
  }
  const url = new URL(baseUrl)
  url.searchParams.set('utm_source', utmSource)
  url.searchParams.set('utm_medium', 'landing_page')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return url.toString()
}
