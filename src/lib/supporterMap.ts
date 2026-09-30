import { isSupabaseConfigured, supabase } from './supabase'
import type { SupporterMapRow } from './database.types'

export interface SupporterMapData {
  byState: Map<string, SupporterMapRow>
  totalUs: number
  totalIntl: number
  isDemo: boolean
}

/**
 * Aggregate-only supporter (visit) counts per US state, from
 * pad.supporter_map(). These are page visits, not donations. States with
 * fewer than 3 supporters come back with few = true and no numbers.
 *
 * In local dev only, ?demoMap shows sample data so the design can be
 * previewed before real traffic exists. Never active in a production build.
 */
export async function loadSupporterMap(): Promise<SupporterMapData> {
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('demoMap')) {
    return demoData()
  }

  const empty: SupporterMapData = { byState: new Map(), totalUs: 0, totalIntl: 0, isDemo: false }
  if (!isSupabaseConfigured) return empty

  const { data, error } = await supabase.rpc('supporter_map')
  if (error || !data) {
    if (error) console.warn('[supporter-map] failed to load', error)
    return empty
  }

  const byState = new Map(data.map((r) => [r.region_code, r]))
  return {
    byState,
    totalUs: data[0]?.total_us ?? 0,
    totalIntl: data[0]?.total_intl ?? 0,
    isDemo: false,
  }
}

function demoData(): SupporterMapData {
  const sample: [string, string, number][] = [
    ['CA', 'California', 212], ['TX', 'Texas', 188], ['FL', 'Florida', 164], ['NY', 'New York', 151],
    ['GA', 'Georgia', 97], ['IL', 'Illinois', 88], ['DC', 'District of Columbia', 74], ['MD', 'Maryland', 69],
    ['VA', 'Virginia', 61], ['NC', 'North Carolina', 57], ['PA', 'Pennsylvania', 52], ['OH', 'Ohio', 41],
    ['MI', 'Michigan', 36], ['WA', 'Washington', 33], ['AZ', 'Arizona', 29], ['LA', 'Louisiana', 27],
    ['NJ', 'New Jersey', 25], ['CO', 'Colorado', 19], ['TN', 'Tennessee', 18], ['MA', 'Massachusetts', 16],
    ['MO', 'Missouri', 12], ['AL', 'Alabama', 11], ['OR', 'Oregon', 9], ['MN', 'Minnesota', 8],
    ['SC', 'South Carolina', 7], ['NV', 'Nevada', 6], ['OK', 'Oklahoma', 5], ['KY', 'Kentucky', 4],
    ['UT', 'Utah', 2], ['NM', 'New Mexico', 1], ['WY', 'Wyoming', 1],
  ]
  const totalUs = sample.reduce((s, [, , n]) => s + n, 0)
  const byState = new Map<string, SupporterMapRow>(
    sample.map(([code, name, n]) => [
      code,
      {
        region_code: code,
        region: name,
        supporters: n >= 3 ? n : null,
        give_clicks: n >= 3 ? Math.round(n * 0.3) : null,
        share: n >= 3 ? Math.round((n * 1000) / totalUs) / 10 : null,
        few: n < 3,
        total_us: totalUs,
        total_intl: 23,
      },
    ]),
  )
  return { byState, totalUs, totalIntl: 23, isDemo: true }
}
