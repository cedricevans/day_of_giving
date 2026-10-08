import { useCallback, useEffect, useState } from 'react'
import { downloadCsv } from '../lib/csv'
import { supabase } from '../lib/supabase'
import type { SubmissionRow, SubmissionStatus } from '../lib/database.types'

const BUCKET = 'pad-submissions'
// Mirror c_quota_bytes in pad.start_submission and the budget in
// pad.story_video_budget_left; the server enforces both.
const QUOTA_BYTES = 800 * 1024 * 1024
const EGRESS_BUDGET_BYTES = 1.5 * 1024 * 1024 * 1024

/** Accepts a full YouTube URL (watch, youtu.be, shorts, embed) or a bare id. */
function youtubeId(input: string) {
  const v = input.trim()
  if (/^[A-Za-z0-9_-]{11}$/.test(v)) return v
  const m = v.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([A-Za-z0-9_-]{11})/)
  return m?.[1] ?? null
}

function mb(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const statusLabel: Record<SubmissionStatus, string> = {
  pending_upload: 'Upload incomplete',
  received: 'New',
  approved: 'Approved',
  file_removed: 'Video removed',
}

/**
 * Videos are only ever opened through short-lived signed URLs, so storage
 * egress is spent on staff review, not public playback. Once a video has
 * been downloaded to PAD's own drive, "Remove video" frees the space.
 */
export function SubmissionsAdmin() {
  const [rows, setRows] = useState<SubmissionRow[]>([])
  const [usedBytes, setUsedBytes] = useState(0)
  const [egressBytes, setEgressBytes] = useState(0)
  const [posters, setPosters] = useState<Record<string, string>>({})
  const [ytDraft, setYtDraft] = useState<Record<string, string>>({})
  const [newStory, setNewStory] = useState({ name: '', chapter: '', testimonial: '', link: '' })
  const [adding, setAdding] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [playing, setPlaying] = useState<{ id: string; url: string } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [loadedAt, setLoadedAt] = useState(0)

  const shareUrl = `${window.location.origin}/share`

  const load = useCallback(async () => {
    setLoading(true)
    const [list, used, egress] = await Promise.all([
      supabase.from('submissions').select('*').order('created_at', { ascending: false }).limit(1000),
      supabase.rpc('submission_storage_bytes'),
      supabase.rpc('story_video_egress_this_month'),
    ])
    setError(list.error?.message ?? used.error?.message ?? egress.error?.message ?? null)
    if (!list.error) setRows(list.data ?? [])
    if (!used.error) setUsedBytes(Number(used.data ?? 0))
    if (!egress.error) setEgressBytes(Number(egress.data ?? 0))
    const paths = (list.data ?? []).map((r) => r.poster_path).filter((p): p is string => Boolean(p))
    if (paths.length) {
      const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600)
      setPosters(
        Object.fromEntries((data ?? []).flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl]] : []))),
      )
    }
    setLoadedAt(Date.now())
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function signedUrl(path: string, download?: string) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 600, download ? { download } : undefined)
    if (error || !data) throw error ?? new Error('No URL')
    return data.signedUrl
  }

  async function run(id: string, fn: () => Promise<void>) {
    setBusyId(id)
    try {
      await fn()
    } catch (err) {
      alert((err as Error).message || 'Something went wrong.')
    } finally {
      setBusyId(null)
    }
  }

  const watch = (r: SubmissionRow) =>
    run(r.id, async () => setPlaying(playing?.id === r.id ? null : { id: r.id, url: await signedUrl(r.file_path!) }))

  const download = (r: SubmissionRow) =>
    run(r.id, async () => {
      const ext = r.file_path!.split('.').pop()
      const name = `${r.name.replace(/[^a-z0-9]+/gi, '-')}-${r.created_at.slice(0, 10)}.${ext}`
      window.location.href = await signedUrl(r.file_path!, name)
    })

  const setStatus = (r: SubmissionRow, status: SubmissionStatus) =>
    run(r.id, async () => {
      const { error } = await supabase.from('submissions').update({ status }).eq('id', r.id)
      if (error) throw error
      setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, status } : x)))
    })

  async function addYoutubeStory(e: React.FormEvent) {
    e.preventDefault()
    const id = youtubeId(newStory.link)
    if (!id) return alert("That doesn't look like a YouTube link.")
    setAdding(true)
    try {
      const { data: auth } = await supabase.auth.getUser()
      const { error } = await supabase.from('submissions').insert({
        visitor_id: crypto.randomUUID(),
        name: newStory.name.trim(),
        email: auth.user?.email ?? 'admin@pad.org',
        chapter: newStory.chapter.trim() || null,
        testimonial: newStory.testimonial.trim() || null,
        consent: true,
        youtube_id: id,
        status: 'received',
      })
      if (error) throw error
      setNewStory({ name: '', chapter: '', testimonial: '', link: '' })
      await load()
    } catch (err) {
      alert(`Couldn't add the story: ${(err as Error).message}`)
    } finally {
      setAdding(false)
    }
  }

  const setOnSite = (r: SubmissionRow, on: boolean) =>
    run(r.id, async () => {
      const patch = { on_site: on, published_at: on ? new Date().toISOString() : null }
      const { error } = await supabase.from('submissions').update(patch).eq('id', r.id)
      if (error) throw error
      setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, ...patch } : x)))
    })

  const saveYoutube = (r: SubmissionRow) => {
    const raw = ytDraft[r.id]
    if (raw === undefined) return
    const id = raw.trim() ? youtubeId(raw) : null
    if (raw.trim() && !id) return alert("That doesn't look like a YouTube link.")
    if (id === r.youtube_id) return
    run(r.id, async () => {
      const { error } = await supabase.from('submissions').update({ youtube_id: id }).eq('id', r.id)
      if (error) throw error
      setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, youtube_id: id } : x)))
      setYtDraft((d) => {
        const next = { ...d }
        delete next[r.id]
        return next
      })
    })
  }

  const removeVideo = (r: SubmissionRow) => {
    const onSiteNote =
      r.on_site && !r.youtube_id ? ' It is on the site, so add a YouTube link first or the story will show without its video.' : ''
    if (!confirm(`Remove ${r.name}'s video from storage? Download it first if PAD wants to keep it. The written details stay.${onSiteNote}`)) return
    run(r.id, async () => {
      const { error } = await supabase.storage.from(BUCKET).remove([r.file_path!])
      if (error) throw error
      const upd = await supabase.from('submissions').update({ status: 'file_removed' }).eq('id', r.id)
      if (upd.error) throw upd.error
      if (playing?.id === r.id) setPlaying(null)
      await load()
    })
  }

  const remove = (r: SubmissionRow) => {
    if (!confirm(`Delete ${r.name}'s submission entirely? Use this for spam.`)) return
    run(r.id, async () => {
      if (r.file_path && r.status !== 'file_removed') {
        const { error } = await supabase.storage.from(BUCKET).remove([r.file_path, ...(r.poster_path ? [r.poster_path] : [])])
        if (error) throw error
      }
      const { error } = await supabase.from('submissions').delete().eq('id', r.id)
      if (error) throw error
      await load()
    })
  }

  const pct = Math.min(100, (usedBytes / QUOTA_BYTES) * 100)
  const egressPct = Math.min(100, (egressBytes / EGRESS_BUDGET_BYTES) * 100)
  const onSiteCount = rows.filter((r) => r.on_site).length
  const visible = rows.filter((r) => r.status !== 'pending_upload' || loadedAt - Date.parse(r.created_at) > 3_600_000)

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-pad-purple-700/10 bg-white p-5">
          <p className="text-sm font-semibold text-pad-purple-900">Submission link for outreach</p>
          <div className="mt-2 flex gap-2">
            <input readOnly value={shareUrl} className="min-w-0 flex-1 rounded-lg border border-pad-purple-700/15 px-3 py-2 text-sm" />
            <button
              onClick={() => {
                void navigator.clipboard.writeText(shareUrl).then(() => setCopied(true))
                setTimeout(() => setCopied(false), 2000)
              }}
              className="rounded-full bg-pad-purple-900 px-4 py-2 text-sm font-semibold text-white"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="mt-2 text-xs text-pad-purple-700/60">
            Name, email and permission are required. Chapter is optional. Videos up to 25 seconds; each is shrunk to 720p
            on the sender's device before upload.
          </p>
        </div>

        <div className="rounded-2xl border border-pad-purple-700/10 bg-white p-5">
          <p className="text-sm font-semibold text-pad-purple-900">Video storage</p>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-pad-purple-700/10">
            <div
              className={`h-full rounded-full ${pct > 85 ? 'bg-red-500' : pct > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.max(pct, 1)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-pad-purple-700/60">
            {mb(usedBytes)} of {mb(QUOTA_BYTES)} used. New video uploads pause automatically when this fills. Download
            videos to PAD's drive, then use Remove video to free space.
          </p>
          <p className="mt-4 text-sm font-semibold text-pad-purple-900">Video plays on the site this month</p>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-pad-purple-700/10">
            <div
              className={`h-full rounded-full ${egressPct > 85 ? 'bg-red-500' : egressPct > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.max(egressPct, 1)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-pad-purple-700/60">
            {mb(egressBytes)} of {mb(EGRESS_BUDGET_BYTES)}. When this fills, videos on the site stop playing until next
            month (thumbnails and text stay). Stories with a YouTube link play from YouTube and don't count.
          </p>
        </div>
      </div>

      <form onSubmit={addYoutubeStory} className="rounded-2xl border border-pad-purple-700/10 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-pad-purple-900">Add a story from a YouTube link</p>
          <a href="/?preview#stories" target="_blank" rel="noopener" className="text-sm font-semibold text-pad-gold-600 underline">
            Preview the Member Stories section
          </a>
        </div>
        <p className="mt-1 text-xs text-pad-purple-700/60">
          Any public YouTube video works, no channel access needed. It plays from YouTube, so it uses none of the Supabase
          budget. It starts hidden; use Show on site when ready. The preview link shows hidden stories to signed in admins
          only.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            required
            minLength={2}
            maxLength={80}
            placeholder="Name shown on the card"
            value={newStory.name}
            onChange={(e) => setNewStory((s) => ({ ...s, name: e.target.value }))}
            className="rounded-lg border border-pad-purple-700/15 px-3 py-2 text-sm"
          />
          <input
            maxLength={120}
            placeholder="Chapter or title (optional)"
            value={newStory.chapter}
            onChange={(e) => setNewStory((s) => ({ ...s, chapter: e.target.value }))}
            className="rounded-lg border border-pad-purple-700/15 px-3 py-2 text-sm"
          />
          <input
            required
            placeholder="https://youtu.be/..."
            value={newStory.link}
            onChange={(e) => setNewStory((s) => ({ ...s, link: e.target.value }))}
            className="rounded-lg border border-pad-purple-700/15 px-3 py-2 text-sm sm:col-span-2"
          />
          <textarea
            rows={2}
            maxLength={1500}
            placeholder="Short quote or caption (optional)"
            value={newStory.testimonial}
            onChange={(e) => setNewStory((s) => ({ ...s, testimonial: e.target.value }))}
            className="rounded-lg border border-pad-purple-700/15 px-3 py-2 text-sm sm:col-span-2"
          />
        </div>
        <button
          type="submit"
          disabled={adding}
          className="mt-3 rounded-full bg-pad-purple-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {adding ? 'Adding…' : 'Add story (hidden)'}
        </button>
      </form>

      {error && <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">Couldn't load submissions: {error}</p>}

      <div className="flex items-center justify-between">
        <p className="text-sm text-pad-purple-700/60">
          {visible.length} submission{visible.length === 1 ? '' : 's'}, {onSiteCount} on the site. Nothing appears on
          the landing page until you click Show on site.
        </p>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="rounded-full border border-pad-purple-700/15 px-4 py-2 text-sm font-medium text-pad-purple-700 hover:bg-white"
          >
            Refresh
          </button>
          <button
            onClick={() =>
              downloadCsv(
                'pad-submissions.csv',
                visible.map((r) => ({
                  name: r.name,
                  email: r.email,
                  chapter: r.chapter ?? '',
                  testimonial: r.testimonial ?? '',
                  has_video: Boolean(r.file_path),
                  video_seconds: r.duration_seconds ?? '',
                  status: statusLabel[r.status],
                  submitted: r.created_at,
                })),
              )
            }
            className="rounded-full border border-pad-purple-700/15 px-4 py-2 text-sm font-medium text-pad-purple-700 hover:bg-white"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {visible.map((r) => {
          const hasVideo = Boolean(r.file_path) && (r.status === 'received' || r.status === 'approved')
          const busy = busyId === r.id
          return (
            <div key={r.id} className="rounded-2xl border border-pad-purple-700/10 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  {r.poster_path && posters[r.poster_path] && (
                    <img src={posters[r.poster_path]} alt="" className="h-16 w-12 shrink-0 rounded-lg bg-black object-cover" />
                  )}
                  <div>
                  <p className="font-semibold text-pad-purple-900">
                    {r.name}
                    {r.chapter && <span className="font-normal text-pad-purple-700/60"> · {r.chapter}</span>}
                  </p>
                  <p className="text-xs text-pad-purple-700/50">
                    {r.email} · {new Date(r.created_at).toLocaleString()}
                    {r.file_bytes ? ` · ${r.duration_seconds ?? '?'}s video, ${mb(r.file_bytes)}` : ''}
                  </p>
                  </div>
                </div>
                {r.on_site && (
                  <span className="rounded-full bg-pad-purple-900 px-3 py-1 text-xs font-semibold text-pad-gold-300">On site</span>
                )}
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    r.status === 'approved'
                      ? 'bg-emerald-100 text-emerald-800'
                      : r.status === 'received'
                        ? 'bg-pad-gold-500/20 text-pad-purple-900'
                        : 'bg-pad-purple-700/5 text-pad-purple-700/60'
                  }`}
                >
                  {statusLabel[r.status]}
                </span>
              </div>

              {r.testimonial && <p className="mt-3 whitespace-pre-line text-sm text-pad-purple-900">{r.testimonial}</p>}

              {playing?.id === r.id && (
                <video src={playing.url} controls autoPlay playsInline className="mt-3 max-h-96 w-full rounded-xl bg-black" />
              )}

              {r.status !== 'pending_upload' && (
                <label className="mt-3 flex flex-wrap items-center gap-2 text-xs text-pad-purple-700/70">
                  YouTube link (optional, plays from YouTube and saves bandwidth)
                  <input
                    value={ytDraft[r.id] ?? (r.youtube_id ? `https://youtu.be/${r.youtube_id}` : '')}
                    onChange={(e) => setYtDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                    onBlur={() => saveYoutube(r)}
                    placeholder="https://youtu.be/..."
                    className="min-w-0 flex-1 rounded-lg border border-pad-purple-700/15 px-3 py-1.5 text-sm text-pad-purple-900"
                  />
                </label>
              )}

              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                {r.status !== 'pending_upload' && (
                  <button
                    onClick={() => setOnSite(r, !r.on_site)}
                    disabled={busy}
                    className={`rounded-full px-4 py-1.5 font-semibold disabled:opacity-50 ${
                      r.on_site ? 'border border-pad-purple-700/15 text-pad-purple-700' : 'bg-pad-gold-500 text-pad-purple-950'
                    }`}
                  >
                    {r.on_site ? 'Hide from site' : 'Show on site'}
                  </button>
                )}
                {hasVideo && (
                  <>
                    <button onClick={() => watch(r)} disabled={busy} className="rounded-full bg-pad-purple-900 px-4 py-1.5 font-semibold text-white disabled:opacity-50">
                      {playing?.id === r.id ? 'Close video' : 'Watch'}
                    </button>
                    <button onClick={() => download(r)} disabled={busy} className="rounded-full border border-pad-purple-700/15 px-4 py-1.5 font-medium text-pad-purple-700 disabled:opacity-50">
                      Download
                    </button>
                  </>
                )}
                {r.status === 'received' && (
                  <button onClick={() => setStatus(r, 'approved')} disabled={busy} className="rounded-full border border-emerald-600/30 px-4 py-1.5 font-medium text-emerald-700 disabled:opacity-50">
                    Approve
                  </button>
                )}
                {r.status === 'approved' && (
                  <button onClick={() => setStatus(r, 'received')} disabled={busy} className="rounded-full border border-pad-purple-700/15 px-4 py-1.5 font-medium text-pad-purple-700 disabled:opacity-50">
                    Unapprove
                  </button>
                )}
                {hasVideo && (
                  <button onClick={() => removeVideo(r)} disabled={busy} className="rounded-full border border-pad-purple-700/15 px-4 py-1.5 font-medium text-pad-purple-700 disabled:opacity-50">
                    Remove video
                  </button>
                )}
                <button onClick={() => remove(r)} disabled={busy} className="ml-auto text-xs font-medium text-red-600/70 hover:text-red-700 disabled:opacity-50">
                  Delete
                </button>
              </div>
            </div>
          )
        })}
        {!loading && visible.length === 0 && (
          <p className="rounded-2xl border border-pad-purple-700/10 bg-white px-4 py-8 text-center text-sm text-pad-purple-700/40">
            No submissions yet. Share the link above.
          </p>
        )}
      </div>
    </div>
  )
}
