// Emails PAD when a story submission finishes. Called by /share with the new
// submission's id. The row is claimed by setting alerted_at, so repeat calls
// for the same submission send nothing.
//
// Secrets: PAD_RESEND_API_KEY (PAD's own Resend account, not the shared
// RESEND_API_KEY), and optionally PAD_ALERT_FROM / PAD_ALERT_TO.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('PAD_RESEND_API_KEY')
const FROM = Deno.env.get('PAD_ALERT_FROM') ?? 'PAD Story Alerts <contact@padgives.org>'
const TO = (Deno.env.get('PAD_ALERT_TO') ?? 'contact@padgives.org').split(',').map((s) => s.trim())
const ADMIN_URL = 'https://padgives.org/admin'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

type Row = {
  id: string
  name: string
  email: string
  chapter: string | null
  testimonial: string | null
  file_path: string | null
  duration_seconds: number | null
  created_at: string
}

function rest(query: string, init: RequestInit) {
  return fetch(`${SUPABASE_URL}/rest/v1/submissions?${query}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Accept-Profile': 'pad',
      'Content-Profile': 'pad',
      Prefer: 'return=representation',
      ...init.headers,
    },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  if (!RESEND_API_KEY) return json({ error: 'not configured' }, 500)

  const { id } = await req.json().catch(() => ({}))
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'bad id' }, 400)

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const claim = await rest(
    `id=eq.${id}&status=eq.received&alerted_at=is.null&created_at=gt.${since}` +
      '&select=id,name,email,chapter,testimonial,file_path,duration_seconds,created_at',
    { method: 'PATCH', body: JSON.stringify({ alerted_at: new Date().toISOString() }) },
  )
  if (!claim.ok) return json({ error: 'lookup failed' }, 500)
  const [row] = (await claim.json()) as Row[]
  if (!row) return json({ ok: true, sent: false })

  const video = row.file_path ? `Video, ${row.duration_seconds ?? '?'}s` : 'Written only'
  const subject = `New story submitted: ${row.name} (${row.file_path ? `video, ${row.duration_seconds ?? '?'}s` : 'written'})`
  const cell = 'padding:6px 12px 6px 0;vertical-align:top;'
  const html = `
    <div style="font-family:Arial,sans-serif;color:#2a1740;max-width:560px">
      <h2 style="margin:0 0 12px">New story submission</h2>
      <table style="border-collapse:collapse;font-size:14px">
        <tr><td style="${cell}color:#777">Name</td><td style="${cell}">${esc(row.name)}</td></tr>
        <tr><td style="${cell}color:#777">Email</td><td style="${cell}"><a href="mailto:${esc(row.email)}">${esc(row.email)}</a></td></tr>
        <tr><td style="${cell}color:#777">Chapter</td><td style="${cell}">${esc(row.chapter ?? 'Not given')}</td></tr>
        <tr><td style="${cell}color:#777">Submission</td><td style="${cell}">${video}</td></tr>
        <tr><td style="${cell}color:#777">Received</td><td style="${cell}">${new Date(row.created_at).toLocaleString('en-US', { timeZone: 'America/New_York' })} ET</td></tr>
      </table>
      ${row.testimonial ? `<p style="margin:16px 0 4px;color:#777;font-size:14px">Written testimonial</p><blockquote style="margin:0;padding:12px 16px;background:#f6f2fa;border-left:3px solid #c9a227;white-space:pre-line;font-size:14px">${esc(row.testimonial)}</blockquote>` : ''}
      <p style="margin:24px 0">
        <a href="${ADMIN_URL}" style="background:#2a1740;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:bold;font-size:14px">Review in admin</a>
      </p>
      <p style="color:#999;font-size:12px">In the admin, open the Submissions tab. Nothing appears on the site until you click Show on site.</p>
    </div>`

  const sent = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: FROM, to: TO, reply_to: row.email, subject, html }),
  })
  if (!sent.ok) {
    console.error('[pad-submission-alert] resend', sent.status, await sent.text())
    await rest(`id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ alerted_at: null }) })
    return json({ error: 'send failed' }, 502)
  }
  return json({ ok: true, sent: true })
})
