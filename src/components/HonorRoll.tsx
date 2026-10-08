import { useHonorRoll } from '../lib/community'
import { SectionHeading } from './SectionHeading'

/**
 * Donors who ticked PAD's "list my name" box on the donation form. Names and
 * chapters only; amounts are never shown. Hidden until the first one lands.
 */
export function HonorRoll() {
  const donors = useHonorRoll()
  if (donors.length === 0) return null

  return (
    <section id="honor-roll" className="bg-pad-cream px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Honor roll"
          title={
            <>
              Thank you to our <span className="italic text-pad-gold-600">donors</span>
            </>
          }
          description={`${donors.length} ${donors.length === 1 ? 'member has' : 'members have'} given to Week of Giving and chosen to be recognized.`}
        />
        <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {donors.map((d) => (
            <li
              key={`${d.display_name}-${d.donated_at}`}
              className="rounded-2xl border border-pad-purple-700/10 bg-white px-4 py-3 shadow-[0_10px_30px_-20px_rgba(43,20,84,0.4)]"
            >
              <p className="truncate font-bold text-pad-purple-900">{d.display_name}</p>
              <p className="truncate text-xs font-medium text-pad-purple-700/60">{d.chapter || 'P.A.D. member'}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
