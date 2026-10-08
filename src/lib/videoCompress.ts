/**
 * Shrinks a phone video to 720p in the browser before upload, so a 20 second
 * clip lands around 5 to 7 MB instead of 40+ MB. It plays the clip through
 * a canvas and re-records it with MediaRecorder, so it takes roughly as long
 * as the clip itself. Audio is routed into the recording only, never to the
 * speakers.
 *
 * Returns null when the browser can't do this (older Safari, Firefox without
 * captureStream, etc.). The caller then falls back to the original file.
 */

const MAX_LONG_SIDE = 1280
const MAX_SHORT_SIDE = 720
const VIDEO_BPS = 2_000_000
const AUDIO_BPS = 96_000

// mp4 first: it opens everywhere PAD staff might edit. WebM is the fallback
// for browsers that can't record mp4.
const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.42E01F,mp4a.40.2',
  'video/mp4;codecs=avc1,mp4a',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
]

export const ACCEPTED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v']

export function pickRecorderMime() {
  if (typeof MediaRecorder === 'undefined' || !('captureStream' in HTMLCanvasElement.prototype)) return null
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? null
}

/** Browsers sometimes leave File.type empty for .mov/.m4v; fall back to the extension. */
export function videoMime(file: File) {
  if (file.type) return file.type === 'video/mov' ? 'video/quicktime' : file.type
  const ext = file.name.split('.').pop()?.toLowerCase()
  return ext === 'mov' ? 'video/quicktime' : ext === 'm4v' ? 'video/x-m4v' : ext === 'webm' ? 'video/webm' : 'video/mp4'
}

/** Loads a file into a video element and resolves once its duration and size are known. */
export function loadVideo(file: File): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'auto'
    video.playsInline = true
    video.setAttribute('playsinline', '')
    video.src = URL.createObjectURL(file)
    video.onloadedmetadata = () => {
      // Some recorders report Infinity until the browser scans to the end.
      if (Number.isFinite(video.duration)) return resolve(video)
      video.currentTime = 1e9
      video.ontimeupdate = () => {
        video.ontimeupdate = null
        video.currentTime = 0
        resolve(video)
      }
    }
    video.onerror = () => reject(new Error('unreadable'))
  })
}

type Job = { promise: Promise<Blob | null>; cancel: () => void }

/**
 * Must be called synchronously inside the click handler: Safari only allows
 * unmuted playback (needed to capture audio) that starts in a user gesture.
 */
export function compressVideo(video: HTMLVideoElement, onProgress: (pct: number) => void): Job | null {
  const mimeType = pickRecorderMime()
  if (!mimeType || !video.videoWidth || !video.videoHeight) return null

  const w = video.videoWidth
  const h = video.videoHeight
  const scale = Math.min(1, MAX_LONG_SIDE / Math.max(w, h), MAX_SHORT_SIDE / Math.min(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round((w * scale) / 2) * 2
  canvas.height = Math.round((h * scale) / 2) * 2
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const stream = canvas.captureStream(30)
  let audio: AudioContext | null = null
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    audio = new Ctor()
    const source = audio.createMediaElementSource(video)
    const dest = audio.createMediaStreamDestination()
    source.connect(dest)
    dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t))
    void audio.resume()
  } catch {
    // No Web Audio: record silent video rather than fail.
    video.muted = true
  }

  let recorder: MediaRecorder
  try {
    recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: VIDEO_BPS, audioBitsPerSecond: AUDIO_BPS })
  } catch {
    void audio?.close()
    return null
  }

  const chunks: Blob[] = []
  let done = false
  let frame = 0
  const rvfc = 'requestVideoFrameCallback' in video
  const draw = () => {
    if (done) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    onProgress(Math.min(99, (video.currentTime / video.duration) * 100))
    frame = rvfc
      ? (video as HTMLVideoElement & { requestVideoFrameCallback: (cb: () => void) => number }).requestVideoFrameCallback(draw)
      : requestAnimationFrame(draw)
  }

  let finish: (b: Blob | null) => void = () => {}
  const promise = new Promise<Blob | null>((resolve) => {
    finish = (b) => {
      if (done) return
      done = true
      if (!rvfc) cancelAnimationFrame(frame)
      video.pause()
      stream.getTracks().forEach((t) => t.stop())
      void audio?.close()
      resolve(b)
    }
  })

  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  recorder.onstop = () => finish(chunks.length ? new Blob(chunks, { type: mimeType.split(';')[0] }) : null)
  recorder.onerror = () => finish(null)
  video.onended = () => recorder.state !== 'inactive' && recorder.stop()

  const timeout = window.setTimeout(() => {
    if (recorder.state !== 'inactive') recorder.stop()
  }, (video.duration * 3 + 20) * 1000)
  void promise.then(() => window.clearTimeout(timeout))

  video.currentTime = 0
  recorder.start(1000)
  video.play().then(draw, () => {
    if (recorder.state !== 'inactive') recorder.stop()
    chunks.length = 0
    finish(null)
  })

  return {
    promise,
    cancel: () => {
      chunks.length = 0
      if (recorder.state !== 'inactive') recorder.stop()
      finish(null)
    },
  }
}
