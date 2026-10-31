// Emails the PAD team about site activity.
//   { type: 'submission', id } and { type: 'wall', id }: sent by the site right
//   after a story or wall post is created. The row is claimed by setting
//   alerted_at, so repeat calls for the same row send nothing.
//   { type: 'digest' }: sent each morning by pg_cron with the
//   x-pad-digest-secret header; summarizes the previous day (Eastern).
//
// Secrets: PAD_RESEND_API_KEY (PAD's own Resend account, not the shared
// RESEND_API_KEY), PAD_DIGEST_SECRET, and optionally PAD_ALERT_FROM /
// PAD_ALERT_TO (comma separated).

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('PAD_RESEND_API_KEY')
const DIGEST_SECRET = Deno.env.get('PAD_DIGEST_SECRET')
const FROM = Deno.env.get('PAD_ALERT_FROM') ?? 'PAD Week of Giving <contact@padgives.org>'
const TO = (Deno.env.get('PAD_ALERT_TO') ?? 'contact@padgives.org').split(',').map((s) => s.trim())
const SITE = 'https://www.padgives.org'
const TZ = 'America/New_York'

const PURPLE = '#2c1454'
const PURPLE_DEEP = '#1e0f33'
const GOLD = '#c9a13a'
const GOLD_LIGHT = '#e8cd85'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const money = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

const when = (iso: string) => `${new Date(iso).toLocaleString('en-US', { timeZone: TZ })} ET`

function db(path: string, init: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
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

/** Sets alerted_at on a fresh row that hasn't alerted yet and returns it, or null. */
async function claim<T>(table: string, id: string, extra: string, select: string): Promise<T | null> {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const res = await db(`${table}?id=eq.${id}&alerted_at=is.null&created_at=gt.${since}${extra}&select=${select}`, {
    method: 'PATCH',
    body: JSON.stringify({ alerted_at: new Date().toISOString() }),
  })
  if (!res.ok) throw new Error(`claim ${table} ${res.status}`)
  const [row] = (await res.json()) as T[]
  return row ?? null
}

const release = (table: string, id: string) =>
  db(`${table}?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ alerted_at: null }) })

const cell = 'padding:7px 14px 7px 0;vertical-align:top;font-size:14px;'
const rows = (pairs: [string, string][]) =>
  `<table role="presentation" style="border-collapse:collapse;width:100%">${pairs
    .map(([k, v]) => `<tr><td style="${cell}color:#7a6a8f;white-space:nowrap;width:1%">${k}</td><td style="${cell}color:${PURPLE_DEEP}">${v}</td></tr>`)
    .join('')}</table>`

const quote = (label: string, text: string) =>
  `<p style="margin:18px 0 6px;color:#7a6a8f;font-size:13px">${label}</p><div style="padding:12px 16px;background:#f6f2fa;border-left:3px solid ${GOLD};white-space:pre-line;font-size:14px;color:${PURPLE_DEEP}">${esc(text)}</div>`

const button = (label: string, href: string) =>
  `<p style="margin:24px 0 4px"><a href="${href}" style="display:inline-block;background:${GOLD};color:${PURPLE_DEEP};padding:11px 22px;border-radius:999px;text-decoration:none;font-weight:bold;font-size:14px">${label}</a></p>`

function layout(eyebrow: string, title: string, body: string, footnote: string) {
  return `<!doctype html><html><body style="margin:0;background:#efe9f5;font-family:Georgia,'Times New Roman',serif">
<table role="presentation" width="100%" style="background:#efe9f5;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden">
  <tr><td style="background:${PURPLE};padding:22px 28px;border-bottom:4px solid ${GOLD}">
    <table role="presentation"><tr>
      <td style="padding-right:14px"><img src="${SITE}/email/pad-crest.png" width="34" height="56" alt="PAD crest" style="display:block"></td>
      <td><div style="color:${GOLD_LIGHT};font-size:12px;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif">${eyebrow}</div>
          <div style="color:#ffffff;font-size:20px;margin-top:4px">Phi Alpha Delta Week of Giving</div></td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:26px 28px 8px;font-family:Arial,sans-serif">
    <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:22px;color:${PURPLE_DEEP}">${title}</h1>
    ${body}
  </td></tr>
  <tr><td style="padding:18px 28px 26px;font-family:Arial,sans-serif;font-size:12px;color:#8b7d9c">
    ${footnote}<br><a href="${SITE}" style="color:#4b2e83">padgives.org</a>
  </td></tr>
</table></td></tr></table></body></html>`
}

async function send(subject: string, html: string, replyTo?: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: FROM, to: TO, subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
  })
  if (!res.ok) console.error('[pad-alerts] resend', res.status, await res.text())
  return res.ok
}

type Submission = {
  id: string
  name: string
  email: string
  chapter: string | null
  testimonial: string | null
  file_path: string | null
  duration_seconds: number | null
  created_at: string
}

async function submissionAlert(id: string) {
  const row = await claim<Submission>(
    'submissions',
    id,
    '&status=eq.received',
    'id,name,email,chapter,testimonial,file_path,duration_seconds,created_at',
  )
  if (!row) return false
  const kind = row.file_path ? `Video, ${row.duration_seconds ?? '?'} seconds` : 'Written story'
  const body =
    rows([
      ['Name', esc(row.name)],
      ['Email', `<a href="mailto:${esc(row.email)}" style="color:#4b2e83">${esc(row.email)}</a>`],
      ['Chapter', esc(row.chapter ?? 'Not given')],
      ['Submitted', kind],
      ['Received', when(row.created_at)],
    ]) +
    (row.testimonial ? quote('Their story', row.testimonial) : '') +
    button('Review in admin', `${SITE}/admin`)
  const html = layout(
    'New member story',
    `${esc(row.name)} shared a story`,
    body,
    'In the admin, open the Submissions tab. Nothing appears on the site until someone clicks Show on site. Reply to this email to reach the sender.',
  )
  const ok = await send(`New story: ${row.name} (${row.file_path ? 'video' : 'written'})`, html, row.email)
  if (!ok) await release('submissions', id)
  return ok
}

type WallPost = {
  id: string
  display_name: string | null
  chapter: string | null
  message: string
  kind: string
  created_at: string
}

const wallKind: Record<string, string> = { why_i_give: 'Why I give', shout_out: 'Shout out', memory: 'Memory' }

async function wallAlert(id: string) {
  const row = await claim<WallPost>('wall_posts', id, '', 'id,display_name,chapter,message,kind,created_at')
  if (!row) return false
  const body =
    rows([
      ['Name', esc(row.display_name ?? 'Anonymous')],
      ['Chapter', esc(row.chapter ?? 'Not given')],
      ['Type', esc(wallKind[row.kind] ?? row.kind)],
      ['Posted', when(row.created_at)],
    ]) +
    quote('Message', row.message) +
    button('Open the wall admin', `${SITE}/admin`)
  const html = layout(
    'New wall post',
    `${esc(row.display_name ?? 'Someone')} posted on the wall`,
    body,
    'Wall posts go live right away. In the admin, open the Community tab to hide one if needed.',
  )
  const ok = await send(`New wall post: ${row.display_name ?? 'Anonymous'}`, html)
  if (!ok) await release('wall_posts', id)
  return ok
}

type Digest = {
  visits: number
  page_views: number
  give_taps: number
  join_taps: number
  poll_votes: number
  submissions: number
  wall_posts: number
  gifts: { name: string | null; amount_cents: number | null; chapter: string | null; state: string | null; recurring: boolean | null }[]
  top_locations: { place: string; n: number }[]
  top_sources: { src: string; n: number }[]
  give_locations: { place: string; n: number }[]
  campaign: { gifts: number; total_cents: number }
}

function yesterdayEastern() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: TZ })
  const d = new Date(`${today}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

const list = (items: { label: string; n: number }[], empty: string) =>
  items.length
    ? `<table role="presentation" style="border-collapse:collapse;width:100%">${items
        .map((i) => `<tr><td style="${cell}color:${PURPLE_DEEP}">${esc(i.label)}</td><td style="${cell}text-align:right;color:#7a6a8f">${i.n}</td></tr>`)
        .join('')}</table>`
    : `<p style="font-size:14px;color:#8b7d9c;margin:4px 0">${empty}</p>`

const section = (title: string, inner: string) =>
  `<h2 style="margin:24px 0 8px;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:${GOLD};font-family:Arial,sans-serif">${title}</h2>${inner}`

async function digest(day: string) {
  const res = await db('rpc/daily_digest', { method: 'POST', body: JSON.stringify({ p_day: day }) })
  if (!res.ok) throw new Error(`digest ${res.status} ${await res.text()}`)
  const d = (await res.json()) as Digest
  const giftTotal = d.gifts.reduce((s, g) => s + (g.amount_cents ?? 0), 0)
  const label = new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })

  const stat = (n: number | string, l: string) =>
    `<td style="padding:12px 8px;text-align:center;background:#f6f2fa;border-radius:10px"><div style="font-family:Georgia,serif;font-size:24px;color:${PURPLE}">${n}</div><div style="font-size:12px;color:#7a6a8f;margin-top:2px">${l}</div></td>`
  const stats = `<table role="presentation" width="100%" style="border-collapse:separate;border-spacing:6px"><tr>${stat(d.visits, 'Visits')}${stat(d.give_taps, 'Give taps')}${stat(d.gifts.length, 'Gifts recorded')}</tr><tr>${stat(d.join_taps, 'Join taps')}${stat(d.submissions + d.wall_posts, 'Stories and posts')}${stat(d.poll_votes, 'Poll votes')}</tr></table>`

  const gifts = d.gifts.length
    ? rows(
        d.gifts.map((g) => [
          money(g.amount_cents ?? 0) + (g.recurring ? ' monthly' : ''),
          esc([g.name ?? 'Anonymous', g.chapter, g.state].filter(Boolean).join(' · ')),
        ]),
      ) + `<p style="font-size:14px;color:${PURPLE_DEEP};margin:8px 0 0"><b>${money(giftTotal)}</b> recorded for the day.</p>`
    : `<p style="font-size:14px;color:#8b7d9c;margin:4px 0">No gifts recorded for this day. Gifts appear here once they're imported from YourMembership or added in the admin.</p>`

  const body =
    stats +
    section('Gifts', gifts) +
    section('Where visitors came from', list(d.top_locations.map((x) => ({ label: x.place, n: x.n })), 'No visits.')) +
    section('Where Give taps came from', list(d.give_locations.map((x) => ({ label: x.place, n: x.n })), 'No Give taps.')) +
    section('How they found the site', list(d.top_sources.map((x) => ({ label: x.src, n: x.n })), 'No visits.')) +
    section(
      'Campaign so far',
      `<p style="font-size:14px;color:${PURPLE_DEEP};margin:4px 0"><b>${money(d.campaign.total_cents)}</b> from ${d.campaign.gifts} recorded gift${d.campaign.gifts === 1 ? '' : 's'}.</p>`,
    ) +
    button('Open the dashboard', `${SITE}/admin`)

  const html = layout(
    'Daily summary',
    label,
    body,
    `${d.page_views} page views. A Give tap means a visitor opened PAD's YourMembership donation page; the gift itself is counted once it's recorded.`,
  )
  return send(`PAD daily summary for ${label}: ${d.visits} visits, ${d.give_taps} Give taps, ${d.gifts.length} gifts`, html)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  if (!RESEND_API_KEY) return json({ error: 'not configured' }, 500)

  const body = await req.json().catch(() => ({}))
  try {
    if (body.type === 'digest') {
      if (!DIGEST_SECRET || req.headers.get('x-pad-digest-secret') !== DIGEST_SECRET) return json({ error: 'forbidden' }, 403)
      const day = typeof body.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.day) ? body.day : yesterdayEastern()
      return json({ ok: true, sent: await digest(day) })
    }
    const id = body.id
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'bad id' }, 400)
    if (body.type === 'wall') return json({ ok: true, sent: await wallAlert(id) })
    return json({ ok: true, sent: await submissionAlert(id) })
  } catch (err) {
    console.error('[pad-alerts]', err)
    return json({ error: 'failed' }, 500)
  }
})
