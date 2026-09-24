import { useState } from 'react'
import crest from '../assets/brand/pad-crest.png'
import { photos, type PhotoSlot } from '../lib/photos'

type Tone = 'none' | 'archival'

/**
 * Renders public/photos/<file> when present; otherwise a branded placeholder
 * so the layout never looks broken while real PAD photos are being gathered.
 * The slot label only shows in dev, so production placeholders stay clean.
 */
export function Photo({
  slot,
  className = '',
  tone = 'none',
  alt = '',
  plain = false,
}: {
  slot: PhotoSlot
  className?: string
  tone?: Tone
  alt?: string
  /** Skip the crest watermark, for slots that already sit behind a crest. */
  plain?: boolean
}) {
  const [missing, setMissing] = useState(false)
  const { file, label } = photos[slot]
  const toneClass = tone === 'archival' ? 'grayscale sepia-[.35] contrast-110' : ''

  if (missing) {
    return (
      <div className={`relative overflow-hidden bg-pad-purple-800 ${className}`} aria-hidden={!alt} role={alt ? 'img' : undefined} aria-label={alt || undefined}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,var(--color-pad-purple-600)_0%,transparent_55%),radial-gradient(circle_at_80%_90%,rgba(201,161,58,0.35)_0%,transparent_50%)]" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(135deg, var(--color-pad-gold-300) 0 1px, transparent 1px 22px)',
          }}
        />
        {!plain && (
          <img
            src={crest}
            alt=""
            className="absolute left-1/2 top-1/2 w-[38%] max-w-[180px] -translate-x-1/2 -translate-y-1/2 opacity-[0.12]"
          />
        )}
        {import.meta.env.DEV && (
          <span className="absolute left-3 right-3 top-3 truncate rounded-md border border-dashed border-pad-gold-400/50 bg-black/40 px-2 py-1 font-mono text-[10px] text-pad-gold-300">
            photos/{file} · {label}
          </span>
        )}
      </div>
    )
  }

  return (
    <img
      src={`/photos/${file}`}
      alt={alt}
      loading={slot === 'hero' ? 'eager' : 'lazy'}
      onError={() => setMissing(true)}
      className={`object-cover ${toneClass} ${className}`}
    />
  )
}
