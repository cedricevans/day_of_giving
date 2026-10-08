import { useState } from 'react'
import { useHonorRoll } from '../lib/community'
import { SectionHeading } from './SectionHeading'

const FIRST = 60

/**
 * Donors who ticked PAD's "list my name" box on the donation form. Names and
 * chapters only; amounts are never shown. Hidden until the first one lands.
 * Plain text columns, like a printed donor wall, so hundreds of names stay
 * compact.
 */
export function HonorRoll() {
  const donors = useHonorRoll()
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)
  if (donors.length === 0) return null

  const q = query.trim().toLowerCase()
  const matches = q
    ? donors.filter((d) => d.display_name.toLowerCase().includes(q) || d.chapter?.toLowerCase().includes(q))
    : donors
  const visible = q || showAll ? matches : matches.slice(0, FIRST)

  return (
    <section id="honor-roll" className="bg-pad-cream px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            eyebrow="Honor roll"
            title={
              <>
                Thank you to our <span className="italic text-pad-gold-600">donors</span>
              </>
            }
            description={`${donors.length.toLocaleString()} ${donors.length === 1 ? 'member has' : 'members have'} given to Week of Giving and chosen to be recognized.`}
          />
          {donors.length > 12 && (
            <label className="block w-full lg:w-72">
              <span className="sr-only">Find a name or chapter</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a name or chapter"
                className="w-full rounded-full border border-pad-purple-700/15 bg-white px-5 py-2.5 text-base text-pad-purple-950 outline-none placeholder:text-pad-purple-700/40 focus:border-pad-gold-500 focus:ring-2 focus:ring-pad-gold-400/30 sm:text-sm"
              />
            </label>
          )}
        </div>

        <div className="mt-10 rounded-[2rem] bg-white px-6 py-8 ring-1 ring-pad-purple-700/10 sm:px-10">
          {visible.length > 0 ? (
            <ul className="columns-2 gap-8 sm:columns-3 lg:columns-4">
              {visible.map((d) => (
                <li key={`${d.display_name}-${d.donated_at}`} className="mb-3 break-inside-avoid">
                  <p className="truncate text-[15px] font-bold leading-tight text-pad-purple-900">{d.display_name}</p>
                  <p className="truncate text-xs text-pad-purple-700/60">{d.chapter || 'P.A.D. member'}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-center text-sm text-pad-purple-700/60">No donors match "{query}".</p>
          )}

          {!q && !showAll && matches.length > FIRST && (
            <div className="mt-6 border-t border-pad-purple-700/10 pt-6 text-center">
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="rounded-full border-2 border-pad-purple-700/20 px-6 py-2.5 text-sm font-bold text-pad-purple-900 transition-colors hover:border-pad-purple-700"
              >
                See all {matches.length.toLocaleString()} donors
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
