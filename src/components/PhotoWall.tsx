import { useRef } from 'react'
import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion'
import { Photo } from './Photo'
import { photos, type PhotoSlot } from '../lib/photos'

const columns: PhotoSlot[][] = [
  ['wall1', 'wall4'],
  ['wall2', 'wall5', 'wall7'],
  ['wall3', 'wall6'],
]

function Column({ slots, y, className = '' }: { slots: PhotoSlot[]; y: MotionValue<string>; className?: string }) {
  return (
    <motion.div style={{ y }} className={`flex flex-col gap-4 md:gap-6 ${className}`}>
      {slots.map((slot, i) => (
        <figure
          key={slot}
          className={`group relative overflow-hidden rounded-3xl shadow-xl ${i % 2 === 0 ? 'aspect-[4/5]' : 'aspect-square'}`}
        >
          <Photo slot={slot} className="absolute inset-0 h-full w-full transition-transform duration-700 group-hover:scale-110" />
          <figcaption className="absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-pad-purple-950/90 to-transparent p-5 pt-12 text-sm font-semibold text-white opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            {photos[slot].label}
          </figcaption>
        </figure>
      ))}
    </motion.div>
  )
}

export function PhotoWall() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const slow = useTransform(scrollYProgress, [0, 1], ['6%', '-6%'])
  const fast = useTransform(scrollYProgress, [0, 1], ['16%', '-16%'])

  return (
    <section ref={ref} className="relative overflow-hidden bg-pad-cream px-6 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-pad-gold-600">This is P.A.D.</p>
          <h2 className="mt-4 font-[family-name:var(--font-display)] text-5xl font-extrabold text-pad-purple-900 md:text-7xl">
            Moments you <span className="italic text-pad-gold-600">make possible.</span>
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6">
          <Column slots={columns[0]} y={slow} />
          <Column slots={columns[1]} y={fast} className="-mt-10 md:-mt-20" />
          <Column slots={columns[2]} y={slow} className="hidden md:flex" />
        </div>
      </div>
    </section>
  )
}
