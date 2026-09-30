import { useId, useState } from 'react'
import { useChapterList } from '../lib/community'
import { useChapter } from '../lib/visitor'

/**
 * "Which chapter are you repping?" field. Free text, with suggestions from
 * the official list once it's imported. The value is shared across the page
 * (Scoreboard, Wall) and rides along on Give clicks.
 */
export function ChapterInput({
  tone = 'light',
  className = '',
  label = 'Your chapter',
  hideLabel = false,
  placeholder = 'e.g. Story Chapter, Howard Law',
}: {
  tone?: 'light' | 'dark'
  className?: string
  label?: string
  hideLabel?: boolean
  placeholder?: string
}) {
  const listId = useId()
  const names = useChapterList()
  const [chapter, setChapter] = useChapter()
  // null while not editing, so the field always mirrors the shared value
  // (e.g. when the other picker on the page changes it).
  const [draft, setDraft] = useState<string | null>(null)

  const dark = tone === 'dark'

  return (
    <label className={`block ${className}`}>
      <span
        className={`mb-1 block text-[10px] font-bold uppercase ${hideLabel ? 'sr-only' : ''} tracking-[0.2em] ${
          dark ? 'text-pad-gold-300' : 'text-pad-purple-700/70'
        }`}
      >
        {label}
      </span>
      <input
        list={names.length ? listId : undefined}
        value={draft ?? chapter}
        maxLength={120}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== null && draft !== chapter) setChapter(draft)
          setDraft(null)
        }}
        className={`w-full rounded-xl border px-4 py-2.5 text-base outline-none sm:text-sm transition-colors ${
          dark
            ? 'border-white/15 bg-white/10 text-white placeholder:text-purple-100/40 focus:border-pad-gold-400'
            : 'border-pad-purple-700/15 bg-white text-pad-purple-950 placeholder:text-pad-purple-700/40 focus:border-pad-gold-500 focus:ring-2 focus:ring-pad-gold-400/30'
        }`}
      />
      {names.length > 0 && (
        <datalist id={listId}>
          {names.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      )}
    </label>
  )
}
