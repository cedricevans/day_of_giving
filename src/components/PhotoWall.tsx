import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { Photo } from './Photo'
import { photos, type PhotoSlot } from '../lib/photos'

// Even 4-column grid, uniform aspect ratio, one shared parallax drift so
// every tile moves together instead of columns racing at different speeds.
const tiles: PhotoSlot[] = ['wall1', 'wall4', 'wall2', 'wall7', 'wall3', 'wall5', 'wall6']

function Tile({ slot, index }: { slot: PhotoSlot; index: number }) {
  return (
    <motion.figure
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6, delay: (index % 4) * 0.08, ease: [0.22, 1, 0.36, 1] }}
      className="group relative aspect-square overflow-hidden rounded-2xl shadow-lg"
    >
      <Photo slot={slot} className="absolute inset-0 h-full w-full transition-transform duration-700 group-hover:scale-110" />
      <div className="absolute inset-0 bg-gradient-to-t from-pad-purple-950/80 via-pad-purple-950/0 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <figcaption className="absolute inset-x-0 bottom-0 translate-y-2 p-4 text-sm font-semibold text-white opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
        {photos[slot].label}
      </figcaption>
    </motion.figure>
  )
}

export function PhotoWall() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const drift = useTransform(scrollYProgress, [0, 1], ['3%', '-3%'])

  return (
    <section ref={ref} className="relative overflow-hidden bg-pad-cream px-6 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-pad-gold-600">This is P.A.D.</p>
          <h2 className="mt-4 font-[family-name:var(--font-display)] text-5xl font-extrabold text-pad-purple-900 md:text-7xl">
            Moments you <span className="italic text-pad-gold-600">make possible.</span>
          </h2>
        </div>
        <motion.div style={{ y: drift }} className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 md:gap-5">
          {tiles.map((slot, i) => (
            <Tile key={slot} slot={slot} index={i} />
          ))}
        </motion.div>
      </div>
    </section>
  )
}
