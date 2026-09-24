/**
 * Photo slots. Drop real PAD photos into public/photos/ using these exact
 * filenames and they appear automatically; until then each slot renders a
 * branded placeholder (see components/Photo.tsx). Filenames and suggested
 * shots are listed in public/photos/README.md.
 */
export const photos = {
  hero: { file: 'hero.jpg', label: 'PAD convention' },
  students: { file: 'students.jpg', label: 'Initiation at FAMU College of Law' },
  founders: { file: 'founders.jpg', label: '1970s Kolleck Chapter' },
  alumni: { file: 'alumni.jpg', label: 'Alumni: attorneys, judges, reception' },
  heritage: { file: 'heritage.jpg', label: 'Historic photo or charter document' },
  wall1: { file: 'wall-1.jpg', label: 'Initiation day' },
  wall2: { file: 'wall-2.jpg', label: 'Graduation day' },
  wall3: { file: 'wall-3.jpg', label: 'Mentorship conversation' },
  wall4: { file: 'wall-4.jpg', label: 'UC Merced Pre-Law Chapter' },
  wall5: { file: 'wall-5.jpg', label: 'The courthouse steps' },
  wall6: { file: 'wall-6.jpg', label: 'Mentorship over coffee' },
  wall7: { file: 'wall-7.jpg', label: 'Alumni reception' },
  cta: { file: 'cta.jpg', label: 'Final call: celebration / graduation' },
} as const

export type PhotoSlot = keyof typeof photos
