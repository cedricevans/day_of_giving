import { useEffect, useRef, useState } from 'react'
import crest from '../assets/brand/pad-crest.png'
import { ChapterInput } from '../components/ChapterInput'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { getVisitorId, useChapter } from '../lib/visitor'
import { ACCEPTED_TYPES, capturePoster, compressVideo, loadVideo, videoMime } from '../lib/videoCompress'

const MAX_SECONDS = 25
const MAX_BYTES = 50 * 1024 * 1024

const friendlyErrors: Record<string, string> = {
  submit_bad_name: 'Please enter your name.',
  submit_bad_email: 'Please enter a valid email so we can follow up.',
  submit_too_long: 'Your testimonial is a little long. Please keep it under 1,500 characters.',
  submit_no_consent: 'Please tick the permission box so PAD can share your story.',
  submit_empty: 'Add a video, a written testimonial, or both.',
  submit_file_too_large: 'That video is too large. Please trim it to 20 seconds.',
  submit_bad_type: 'Please upload an MP4, MOV or WebM video.',
  submit_too_long_video: `Videos can be up to ${MAX_SECONDS} seconds. Please trim it and try again.`,
  submit_storage_full: 'We have received a lot of videos and uploads are paused for now. Please send a written testimonial instead, or check back later.',
  submit_rate_limited: 'You have sent several submissions already. Please try again tomorrow.',
}

function friendly(message?: string) {
  const code = Object.keys(friendlyErrors).find((k) => message?.includes(k))
  return code ? friendlyErrors[code] : 'Something went wrong. Please try again.'
}

const inputClass =
  'w-full rounded-xl border border-pad-purple-700/15 bg-white px-4 py-3 text-base text-pad-purple-950 outline-none transition-colors placeholder:text-pad-purple-700/40 focus:border-pad-gold-500 focus:ring-2 focus:ring-pad-gold-400/30 sm:text-sm'

type Phase = { step: 'form' } | { step: 'compressing'; pct: number } | { step: 'uploading' } | { step: 'done' }

export function SharePage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [chapter] = useChapter()
  const [testimonial, setTestimonial] = useState('')
  const [consent, setConsent] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [video, setVideo] = useState<HTMLVideoElement | null>(null)
  const [poster, setPoster] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>({ step: 'form' })
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    document.title = 'Share your story · P.A.D. Week of Giving'
  }, [])

  useEffect(() => () => void (previewUrl && URL.revokeObjectURL(previewUrl)), [previewUrl])

  function clearFile() {
    setFile(null)
    setVideo(null)
    setPoster(null)
    setPreviewUrl(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function pickFile(f: File | undefined) {
    setFileError(null)
    clearFile()
    if (!f) return
    if (!ACCEPTED_TYPES.includes(videoMime(f))) {
      setFileError('Please choose an MP4, MOV or WebM video.')
      return
    }
    try {
      const v = await loadVideo(f)
      if (v.duration > MAX_SECONDS + 0.5) {
        setFileError(`That clip is ${Math.round(v.duration)} seconds. Please trim it to 20 seconds or less and try again.`)
        if (inputRef.current) inputRef.current.value = ''
        return
      }
      setPoster(await capturePoster(v))
      setFile(f)
      setVideo(v)
      setPreviewUrl(URL.createObjectURL(f))
    } catch {
      setFileError("We couldn't read that video. Try recording it again, or choose a different file.")
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!consent) return setError(friendlyErrors.submit_no_consent)
    if (!file && !testimonial.trim()) return setError(friendlyErrors.submit_empty)

    // Starts playback inside the click so Safari lets us capture audio.
    const job = video ? compressVideo(video, (pct) => setPhase({ step: 'compressing', pct })) : null
    if (job) setPhase({ step: 'compressing', pct: 0 })
    void submit(job?.promise ?? null)
  }

  async function submit(compressing: Promise<Blob | null> | null) {
    let upload: Blob | null = file
    let mime = file ? videoMime(file) : null
    const duration = video?.duration ?? null

    if (compressing) {
      const small = await compressing
      if (small && file && small.size < file.size) {
        upload = small
        mime = small.type
      }
      // The element is now wired to a closed audio graph; load a fresh one in
      // case the visitor needs to retry.
      if (file) loadVideo(file).then(setVideo, () => setVideo(null))
    }

    if (upload && upload.size > MAX_BYTES) {
      setPhase({ step: 'form' })
      return setError(
        'This video is still over 50 MB after shrinking. Please trim it to 20 seconds, or record at 1080p instead of 4K, and try again.',
      )
    }

    setPhase({ step: 'uploading' })
    const visitor = getVisitorId()
    const { data, error: startError } = await supabase.rpc('start_submission', {
      p_visitor_id: visitor,
      p_name: name,
      p_email: email,
      p_chapter: chapter || null,
      p_testimonial: testimonial || null,
      p_consent: consent,
      p_file_bytes: upload ? upload.size : null,
      p_file_mime: upload ? mime : null,
      p_duration_seconds: upload ? duration : null,
      p_poster_bytes: upload && poster ? poster.size : null,
    })
    const row = data?.[0]
    if (startError || !row) {
      setPhase({ step: 'form' })
      return setError(friendly(startError?.message))
    }

    if (upload && row.file_path) {
      const { error: uploadError } = await supabase.storage
        .from('pad-submissions')
        .upload(row.file_path, upload, { contentType: mime ?? 'video/mp4' })
      // The thumbnail is a nice-to-have; a failed one doesn't block the story.
      if (!uploadError && poster && row.poster_path) {
        const { error: posterError } = await supabase.storage
          .from('pad-submissions')
          .upload(row.poster_path, poster, { contentType: 'image/jpeg' })
        if (posterError) console.warn('[share] poster upload failed', posterError)
      }
      const finished = uploadError ? null : await supabase.rpc('finish_submission', { p_id: row.id, p_visitor_id: visitor })
      if (uploadError || finished?.error) {
        console.warn('[share] upload failed', uploadError ?? finished?.error)
        setPhase({ step: 'form' })
        return setError('Your video did not finish uploading. Check your connection and try again.')
      }
    }

    setPhase({ step: 'done' })
  }

  const busy = phase.step === 'compressing' || phase.step === 'uploading'

  return (
    <div className="min-h-screen bg-pad-cream">
      <header className="bg-pad-purple-950 px-4 py-4 sm:px-6">
        <a href="/" className="mx-auto flex max-w-2xl items-center gap-3">
          <img src={crest} alt="" className="h-9 w-auto" />
          <span className="text-sm font-bold uppercase tracking-[0.2em] text-pad-gold-300">P.A.D. Week of Giving</span>
        </a>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        {phase.step === 'done' ? (
          <div className="rounded-3xl bg-white p-8 text-center shadow-[0_30px_80px_-24px_rgba(43,20,84,0.35)] sm:p-12">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-pad-gold-600">Received</p>
            <h1 className="mt-4 font-[family-name:var(--font-display)] text-4xl font-extrabold text-pad-purple-900">
              Thank you, {name.split(' ')[0] || 'friend'}.
            </h1>
            <p className="mt-4 text-pad-purple-700/70">
              Your story is in. The P.A.D. team will review it and may reach out at {email} before it is shared.
            </p>
            <a
              href="/"
              className="btn-gold mt-8 inline-block rounded-full px-8 py-3 font-extrabold transition-transform hover:scale-[1.02]"
            >
              Back to Week of Giving
            </a>
          </div>
        ) : (
          <>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-pad-gold-600">Share your story</p>
            <h1 className="mt-4 font-[family-name:var(--font-display)] text-4xl font-extrabold leading-tight text-pad-purple-900 sm:text-5xl">
              Why does P.A.D. matter to you?
            </h1>
            <p className="mt-4 text-lg text-pad-purple-700/70">
              Send a short video, a written testimonial, or both. Selected stories will be featured during Week of
              Giving.
            </p>

            <div className="mt-8 rounded-2xl border border-pad-purple-700/10 bg-white p-5 text-sm text-pad-purple-900">
              <p className="font-semibold">Video tips</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-pad-purple-700/80">
                <li>Keep it to 15 to 20 seconds. Clips longer than {MAX_SECONDS} seconds can't be accepted.</li>
                <li>Hold your phone steady in a quiet, well lit spot. Vertical or horizontal both work.</li>
                <li>Say your name, your chapter, and what P.A.D. means to you.</li>
                <li>MP4, MOV or WebM. We shrink it on your device before sending, so keep this page open while it uploads.</li>
              </ul>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.2em] text-pad-purple-700/70">
                    Your name *
                  </span>
                  <input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.2em] text-pad-purple-700/70">
                    Email *
                  </span>
                  <input
                    required
                    type="email"
                    maxLength={200}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                  />
                </label>
              </div>

              <ChapterInput label="Your chapter" />

              <div>
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.2em] text-pad-purple-700/70">
                  Video (15 to 20 seconds)
                </span>
                {previewUrl ? (
                  <div className="rounded-2xl border border-pad-purple-700/10 bg-white p-3">
                    <video src={previewUrl} controls playsInline className="max-h-80 w-full rounded-xl bg-black" />
                    <div className="mt-2 flex items-center justify-between text-xs text-pad-purple-700/60">
                      <span>
                        {file?.name} · {Math.round(video?.duration ?? 0)}s
                      </span>
                      {!busy && (
                        <button type="button" onClick={clearFile} className="font-semibold text-pad-purple-700 underline">
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-pad-purple-700/20 bg-white px-4 py-8 text-center transition-colors hover:border-pad-gold-500">
                    <span className="font-semibold text-pad-purple-900">Record or choose a video</span>
                    <span className="mt-1 text-xs text-pad-purple-700/50">Up to {MAX_SECONDS} seconds</span>
                    <input
                      ref={inputRef}
                      type="file"
                      accept="video/mp4,video/quicktime,video/webm,video/x-m4v,.mov,.mp4,.m4v,.webm"
                      onChange={(e) => pickFile(e.target.files?.[0])}
                      className="sr-only"
                    />
                  </label>
                )}
                {fileError && <p className="mt-2 text-sm text-red-700">{fileError}</p>}
              </div>

              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.2em] text-pad-purple-700/70">
                  Written testimonial {file ? '(optional)' : ''}
                </span>
                <textarea
                  rows={5}
                  maxLength={1500}
                  value={testimonial}
                  onChange={(e) => setTestimonial(e.target.value)}
                  placeholder="What has P.A.D. meant to you, your career, or your chapter?"
                  className={inputClass}
                />
                <span className="mt-1 block text-right text-xs text-pad-purple-700/40">{testimonial.length}/1500</span>
              </label>

              <label className="flex items-start gap-3 rounded-2xl bg-white p-4 text-sm text-pad-purple-900">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-pad-gold-500"
                />
                <span>
                  I give Phi Alpha Delta Law Fraternity, International permission to use my video, testimonial, name and
                  chapter on the P.A.D. website and official social media channels. *
                </span>
              </label>

              {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

              {phase.step === 'compressing' && (
                <div>
                  <div className="h-2 overflow-hidden rounded-full bg-pad-purple-700/10">
                    <div className="h-full rounded-full bg-pad-gold-500 transition-all" style={{ width: `${phase.pct}%` }} />
                  </div>
                  <p className="mt-2 text-sm text-pad-purple-700/70">
                    Preparing your video ({Math.round(phase.pct)}%). Keep this page open.
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={busy || !isSupabaseConfigured}
                className="btn-gold w-full rounded-full px-8 py-4 text-lg font-extrabold transition-transform hover:scale-[1.01] active:scale-95 disabled:opacity-60"
              >
                {phase.step === 'compressing'
                  ? 'Preparing video…'
                  : phase.step === 'uploading'
                    ? 'Uploading…'
                    : 'Send my story'}
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  )
}
