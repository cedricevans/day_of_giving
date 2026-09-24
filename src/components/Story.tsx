import { motion } from 'framer-motion'

const pillars = [
  {
    title: 'Scholarships',
    body: 'Direct support for law students carrying the cost of tuition, books, and bar prep.',
  },
  {
    title: 'Leadership',
    body: 'Funding chapter programming, national conferences, and mentorship across every district.',
  },
  {
    title: 'Justice for All',
    body: "Sustaining PAD's founding mission: Legal Justice for All, in courtrooms and communities.",
  },
]

export function Story() {
  return (
    <section className="bg-white px-6 py-24">
      <div className="mx-auto max-w-5xl text-center">
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="font-[family-name:var(--font-display)] text-4xl font-bold text-pad-purple-900 md:text-5xl"
        >
          Why one day matters
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mx-auto mt-4 max-w-2xl text-lg text-pad-purple-700/70"
        >
          For one day, brothers and friends of Phi Alpha Delta across every
          chapter come together to fund what makes this Fraternity run —
          every gift, every size, counted toward one goal.
        </motion.p>

        <div className="mt-16 grid gap-8 sm:grid-cols-3">
          {pillars.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
              className="rounded-2xl border border-pad-purple-700/10 bg-pad-cream p-8 text-left"
            >
              <div className="mb-4 h-1 w-10 rounded-full bg-pad-gold-500" />
              <h3 className="font-[family-name:var(--font-display)] text-xl font-bold text-pad-purple-900">
                {p.title}
              </h3>
              <p className="mt-2 text-pad-purple-700/70">{p.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
