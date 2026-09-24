import { isSupabaseConfigured, supabase } from './supabase'
import { lookupGeo } from './geo'
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
    const { data, error } = await supabase
      .from('sessions')
      .insert({
        ...utm,
        referrer: document.referrer || null,
        landing_path: window.location.pathname + window.location.search,
        user_agent: navigator.userAgent,
      })
      .select('id')
      .single()

    if (error || !data) {
      console.warn('[tracking] failed to create session', error)
      return null
    }
    sessionStorage.setItem(SESSION_KEY, data.id)
    attachGeo(data.id)
    return data.id
  })()

  return sessionIdPromise
}

/** Fire-and-forget: resolves approximate location and patches it onto the session row. Runs once per browser tab. */
function attachGeo(sessionId: string) {
  if (sessionStorage.getItem(GEO_DONE_KEY)) return
  sessionStorage.setItem(GEO_DONE_KEY, '1')

  lookupGeo().then((geo) => {
    if (!geo) return
    supabase
      .from('sessions')
      .update(geo)
      .eq('id', sessionId)
      .then(({ error }) => {
        if (error) console.warn('[tracking] failed to attach geo', error)
      })
  })
}

export async function logEvent(eventType: EventType, metadata: Record<string, unknown> = {}) {
  if (!isSupabaseConfigured) return
  const sessionId = await getSessionId()
  const { error } = await supabase.from('events').insert({
    session_id: sessionId,
    event_type: eventType,
    metadata,
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
