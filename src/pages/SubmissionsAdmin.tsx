import { useCallback, useEffect, useState } from 'react'
import { downloadCsv } from '../lib/csv'
import { supabase } from '../lib/supabase'
import type { SubmissionRow, SubmissionStatus } from '../lib/database.types'

const BUCKET = 'pad-submissions'
// Mirrors c_quota_bytes in pad.start_submission; uploads stop at this point.
const QUOTA_BYTES = 800 * 1024 * 1024

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [playing, setPlaying] = useState<{ id: string; url: string } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [loadedAt, setLoadedAt] = useState(0)

  const shareUrl = `${window.location.origin}/share`

  const load = useCallback(async () => {
    setLoading(true)
    const [list, used] = await Promise.all([
      supabase.from('submissions').select('*').order('created_at', { ascending: false }).limit(1000),
      supabase.rpc('submission_storage_bytes'),
    ])
    setError(list.error?.message ?? used.error?.message ?? null)
    if (!list.error) setRows(list.data ?? [])
    if (!used.error) setUsedBytes(Number(used.data ?? 0))
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

  const removeVideo = (r: SubmissionRow) => {
    if (!confirm(`Remove ${r.name}'s video from storage? Download it first if PAD wants to keep it. The written details stay.`)) return
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
        const { error } = await supabase.storage.from(BUCKET).remove([r.file_path])
        if (error) throw error
      }
      const { error } = await supabase.from('submissions').delete().eq('id', r.id)
      if (error) throw error
      await load()
    })
  }

  const pct = Math.min(100, (usedBytes / QUOTA_BYTES) * 100)
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
        </div>
      </div>

      {error && <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">Couldn't load submissions: {error}</p>}

      <div className="flex items-center justify-between">
        <p className="text-sm text-pad-purple-700/60">
          {visible.length} submission{visible.length === 1 ? '' : 's'}
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

              <div className="mt-4 flex flex-wrap gap-2 text-sm">
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
