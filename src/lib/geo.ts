/**
 * Approximate visitor location, inferred client-side from IP via a free
 * geolocation API (ipwho.is — no key, HTTPS, ~1000 req/day/domain). This
 * is where visits and Donate/Join clicks come from, NOT confirmed
 * donations — PAD's actual donation records live on pad.org and are
 * still entered manually via the donations table (see tracking.ts).
 *
 * Runs in the background after a session row is created and patches that
 * row in place. Never blocks the page, and fails completely silently —
 * a lookup failure should never be visible to a visitor or break tracking.
 */

export interface GeoResult {
  geo_country: string | null
  geo_country_code: string | null
  geo_region: string | null
  geo_region_code: string | null
  geo_city: string | null
}

interface IpWhoIsResponse {
  success: boolean
  country?: string
  country_code?: string
  region?: string
  region_code?: string
  city?: string
}

export async function lookupGeo(): Promise<GeoResult | null> {
  try {
    const res = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(4000) })
    if (!res.ok) return null
    const data: IpWhoIsResponse = await res.json()
    if (!data.success) return null

    return {
      geo_country: data.country ?? null,
      geo_country_code: data.country_code ?? null,
      geo_region: data.region ?? null,
      geo_region_code: data.region_code ?? null,
      geo_city: data.city ?? null,
    }
  } catch {
    // Network failure, timeout, ad blocker, offline — never surface this.
    return null
  }
}
