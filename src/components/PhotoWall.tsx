import { motion } from 'framer-motion'
import { Photo } from './Photo'
import { SectionHeading } from './SectionHeading'
import { photos, type PhotoSlot } from '../lib/photos'

// Bento layout on a 4-column grid: one 2x2 feature, four 1x1, two 2x1.
// 4 + 4 + 4 cells = three full rows, so there's never an empty trailing slot.
const tiles: { slot: PhotoSlot; span: string }[] = [
  { slot: 'wall4', span: 'col-span-2 row-span-2' },
  { slot: 'wall1', span: '' },
  { slot: 'wall2', span: '' },
  { slot: 'wall7', span: '' },
  { slot: 'wall3', span: '' },
  { slot: 'wall5', span: 'col-span-2' },
  { slot: 'wall6', span: 'col-span-2' },
]

export function PhotoWall() {
  return (
    <section id="moments" className="relative overflow-hidden bg-pad-cream px-6 pb-16 pt-24 lg:px-8 lg:pb-20 lg:pt-32">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="This is P.A.D."
          align="center"
          title={
            <>
              Moments you <span className="italic text-pad-gold-600">make possible.</span>
            </>
          }
          className="mb-14"
        />

        <div className="grid auto-rows-[150px] grid-cols-2 gap-3 sm:auto-rows-[190px] md:grid-cols-4 md:gap-4 lg:auto-rows-[220px]">
          {tiles.map(({ slot, span }, i) => (
            <motion.figure
              key={slot}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              className={`group relative overflow-hidden rounded-2xl bg-pad-purple-800 shadow-[0_12px_40px_-16px_rgba(43,20,84,0.45)] ring-1 ring-pad-purple-900/5 ${span}`}
            >
              <Photo
                slot={slot}
                className="absolute inset-0 h-full w-full transition-transform duration-700 ease-out group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-pad-purple-950/85 via-pad-purple-950/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <figcaption className="absolute inset-x-0 bottom-0 flex translate-y-2 items-center gap-2 p-4 text-sm font-semibold text-white opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                <span className="h-px w-5 bg-pad-gold-400" />
                {photos[slot].label}
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  )
}
