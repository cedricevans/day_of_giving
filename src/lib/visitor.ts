import { useSyncExternalStore } from 'react'

const VISITOR_KEY = 'pad_visitor_id'
const CHAPTER_KEY = 'pad_chapter'
const CHAPTER_EVENT = 'pad-chapter-change'

// localStorage can throw (private mode, blocked storage). Everything here
// degrades to in-memory for the life of the tab instead of failing.
const memory: Record<string, string | null> = {}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return memory[key] ?? null
  }
}

function write(key: string, value: string | null) {
  memory[key] = value
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // memory fallback already set
  }
}

/**
 * Random per-browser id used by the Wall and polls to stop double reactions
 * and double votes. Not an identity and never tied to a name or email.
 */
export function getVisitorId(): string {
  let id = read(VISITOR_KEY)
  if (!id) {
    id = crypto.randomUUID()
    write(VISITOR_KEY, id)
  }
  return id
}

export function getChapter(): string | null {
  return read(CHAPTER_KEY)
}

export function setChapter(name: string) {
  const clean = name.replace(/\s+/g, ' ').trim().slice(0, 120)
  write(CHAPTER_KEY, clean || null)
  window.dispatchEvent(new Event(CHAPTER_EVENT))
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHAPTER_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(CHAPTER_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

/** The chapter this visitor is representing, shared by every picker on the page. */
export function useChapter() {
  const chapter = useSyncExternalStore(subscribe, getChapter, () => null)
  return [chapter ?? '', setChapter] as const
}
