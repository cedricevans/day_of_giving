import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

/**
 * One heading treatment for every section: gold-ruled eyebrow, display
 * title, optional lead. `tone` flips colors for dark vs cream backgrounds.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
  tone = 'light',
  className = '',
}: {
  eyebrow: string
  title: ReactNode
  description?: ReactNode
  align?: 'left' | 'center'
  tone?: 'light' | 'dark'
  className?: string
}) {
  const centered = align === 'center'
  const dark = tone === 'dark'

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={`${centered ? 'mx-auto text-center' : ''} max-w-3xl ${className}`}
    >
      <p
        className={`flex items-center gap-3 text-xs font-bold uppercase tracking-[0.3em] ${
          centered ? 'justify-center' : ''
        } ${dark ? 'text-pad-gold-300' : 'text-pad-gold-600'}`}
      >
        <span className={`h-px w-8 ${dark ? 'bg-pad-gold-400' : 'bg-pad-gold-500'}`} />
        {eyebrow}
        {centered && <span className={`h-px w-8 ${dark ? 'bg-pad-gold-400' : 'bg-pad-gold-500'}`} />}
      </p>
      <h2
        className={`mt-5 text-balance font-[family-name:var(--font-display)] text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-5xl lg:text-6xl ${
          dark ? 'text-white' : 'text-pad-purple-900'
        }`}
      >
        {title}
      </h2>
      {description && (
        <p
          className={`mt-5 text-lg leading-relaxed ${centered ? 'mx-auto' : ''} max-w-2xl ${
            dark ? 'text-purple-100/70' : 'text-pad-purple-700/70'
          }`}
        >
          {description}
        </p>
      )}
    </motion.div>
  )
}
