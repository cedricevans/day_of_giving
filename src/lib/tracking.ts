import { isSupabaseConfigured, supabase } from './supabase'
import { lookupGeo } from './geo'
import { getChapter, getVisitorId } from './visitor'
import type { EventType, LeadIntent } from './database.types'

const SESSION_KEY = 'pad_dog_session_id'
const GEO_DONE_KEY = 'pad_dog_geo_done'

let sessionIdPromise: Promise<string | null> | null = null

function parseUtm() {
  const params = new URLSearchParams(window.location.search)
  return {
    utm_source: params.get('utm_source'),
    utm_medium: params.get('utm_medium'),
    utm_campaign: params.get('utm_campaign'),
  }
}

/** Creates (or reuses) a session row for this browser tab. No-ops gracefully without Supabase configured. */
async function getSessionId(): Promise<string | null> {
  if (!isSupabaseConfigured) return null
  if (sessionIdPromise) return sessionIdPromise

  const existing = sessionStorage.getItem(SESSION_KEY)
  if (existing) {
    sessionIdPromise = Promise.resolve(existing)
    return sessionIdPromise
  }

  sessionIdPromise = (async () => {
    const utm = parseUtm()
    // Id is generated here rather than returned by the insert: anon has no
    // SELECT policy on sessions, so insert ... returning is rejected by RLS.
    const id = crypto.randomUUID()
    const { error } = await supabase.from('sessions').insert({
      id,
      ...utm,
      referrer: document.referrer || null,
      landing_path: window.location.pathname + window.location.search,
      user_agent: navigator.userAgent,
    })

    if (error) {
      console.warn('[tracking] failed to create session', error)
      return null
    }
    sessionStorage.setItem(SESSION_KEY, id)
    attachGeo(id)
    return id
  })()

  return sessionIdPromise
}

/**
 * Fire-and-forget: resolves approximate location and records it on the
 * session via pad.set_session_geo (anon can't UPDATE sessions directly).
 * Runs once per browser tab.
 */
function attachGeo(sessionId: string) {
  if (sessionStorage.getItem(GEO_DONE_KEY)) return
  sessionStorage.setItem(GEO_DONE_KEY, '1')

  lookupGeo().then((geo) => {
    if (!geo) return
    supabase
      .rpc('set_session_geo', {
        p_session_id: sessionId,
        p_country: geo.geo_country,
        p_country_code: geo.geo_country_code,
        p_region: geo.geo_region,
        p_region_code: geo.geo_region_code,
        p_city: geo.geo_city,
      })
      .then(({ error }) => {
        if (error) console.warn('[tracking] failed to attach geo', error)
      })
  })
}

export async function logEvent(eventType: EventType, metadata: Record<string, unknown> = {}) {
  if (!isSupabaseConfigured) return
  const sessionId = await getSessionId()
  // Give/Join clicks carry the visitor's chapter so the scoreboard can count
  // chapters participating before YM records chapter on the gift itself.
  const isClick = eventType === 'donate_click' || eventType === 'join_click'
  const chapter = isClick ? getChapter() : null
  const { error } = await supabase.from('events').insert({
    session_id: sessionId,
    event_type: eventType,
    metadata: isClick ? { ...metadata, visitor_id: getVisitorId(), ...(chapter ? { chapter } : {}) } : metadata,
  })
  if (error) console.warn('[tracking] failed to log event', eventType, error)
}

export async function captureLead(input: { name?: string; email: string; intent: LeadIntent }) {
  if (!isSupabaseConfigured) return { ok: false as const, reason: 'not_configured' as const }
  const sessionId = await getSessionId()
  const { error } = await supabase.from('leads').insert({
    session_id: sessionId,
    name: input.name || null,
    email: input.email,
    intent: input.intent,
  })
  if (error) {
    console.warn('[tracking] failed to capture lead', error)
    return { ok: false as const, reason: 'insert_failed' as const }
  }
  await logEvent('lead_captured', { intent: input.intent })
  return { ok: true as const }
}
