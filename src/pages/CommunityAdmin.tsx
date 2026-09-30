import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { PollAdminRow, WallPostAdminRow } from '../lib/database.types'

const btn = 'rounded-full border border-pad-purple-700/15 px-3 py-1 text-xs font-semibold text-pad-purple-700 hover:bg-pad-purple-700/5'
const card = 'rounded-2xl border border-pad-purple-700/10 bg-white p-5'
const input = 'rounded-lg border border-pad-purple-700/15 px-3 py-2 text-sm'

function useLoad<T>(load: () => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const [loader] = useState(() => load)
  const [rows, setRows] = useState<T[]>([])
  const [error, setError] = useState<string | null>(null)
  const refresh = useCallback(async () => {
    const { data, error } = await loader()
    if (error) setError(error.message)
    else {
      setError(null)
      setRows(data ?? [])
    }
  }, [loader])
  useEffect(() => {
    void refresh()
  }, [refresh])
  return { rows, error, refresh }
}

function WallModeration() {
  const [filter, setFilter] = useState<'all' | 'published' | 'hidden'>('all')
  const { rows, error, refresh } = useLoad<WallPostAdminRow>(() =>
    supabase.from('wall_posts').select('*').order('created_at', { ascending: false }).limit(500),
  )
  const shown = rows.filter((r) => filter === 'all' || r.status === filter)

  async function setStatus(id: string, status: WallPostAdminRow['status']) {
    const { error } = await supabase
      .from('wall_posts')
      .update({ status, hidden_reason: status === 'hidden' ? 'admin' : null })
      .eq('id', id)
    if (error) alert(error.message)
    await refresh()
  }

  async function hideAllFrom(visitorId: string) {
    if (!confirm('Hide every post from this visitor?')) return
    const { error } = await supabase
      .from('wall_posts')
      .update({ status: 'hidden', hidden_reason: 'admin_bulk' })
      .eq('visitor_id', visitorId)
    if (error) alert(error.message)
    await refresh()
  }

  return (
    <div className={card}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-pad-purple-900">Wall posts</h3>
          <p className="text-xs text-pad-purple-700/50">Posts publish immediately. Hide anything that should not be there.</p>
        </div>
        <div className="flex gap-1">
          {(['all', 'published', 'hidden'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`${btn} capitalize ${filter === f ? 'bg-pad-purple-900 text-white hover:bg-pad-purple-900' : ''}`}
            >
              {f}
            </button>
          ))}
          <button onClick={refresh} className={btn}>
            Refresh
          </button>
        </div>
      </div>
      {error && <p className="mb-3 text-sm text-red-700">{error}</p>}
      <ul className="divide-y divide-pad-purple-700/5">
        {shown.map((p) => (
          <li key={p.id} className={`flex gap-4 py-3 ${p.status === 'hidden' ? 'opacity-50' : ''}`}>
            <div className="min-w-0 flex-1">
              <p className="whitespace-pre-line break-words text-sm text-pad-purple-950">{p.message}</p>
              <p className="mt-1 text-xs text-pad-purple-700/50">
                {p.display_name || 'Anonymous'}
                {p.chapter ? ` · ${p.chapter}` : ''} · {p.kind.replace(/_/g, ' ')} ·{' '}
                {new Date(p.created_at).toLocaleString()}
                {p.status === 'hidden' ? ` · hidden (${p.hidden_reason ?? 'admin'})` : ''}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {p.status === 'published' ? (
                <button onClick={() => setStatus(p.id, 'hidden')} className={`${btn} border-red-200 text-red-700`}>
                  Hide
                </button>
              ) : (
                <button onClick={() => setStatus(p.id, 'published')} className={btn}>
                  Restore
                </button>
              )}
              <button onClick={() => hideAllFrom(p.visitor_id)} className={`${btn} text-[10px]`}>
                Hide all from sender
              </button>
            </div>
          </li>
        ))}
        {shown.length === 0 && <li className="py-6 text-center text-sm text-pad-purple-700/40">No posts.</li>}
      </ul>
    </div>
  )
}

function BlockedWords() {
  const { rows, error, refresh } = useLoad<{ word: string }>(() => supabase.from('blocked_words').select('word').order('word'))
  const [word, setWord] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const clean = word.toLowerCase().replace(/\s+/g, ' ').trim()
    if (!/^[a-z0-9 ]{2,40}$/.test(clean)) {
      setMsg('Use 2 to 40 letters, numbers or spaces.')
      return
    }
    const { error } = await supabase.from('blocked_words').insert({ word: clean })
    setMsg(error ? error.message : null)
    setWord('')
    await refresh()
  }

  async function remove(w: string) {
    const { error } = await supabase.from('blocked_words').delete().eq('word', w)
    if (error) alert(error.message)
    await refresh()
  }

  return (
    <div className={card}>
      <h3 className="font-semibold text-pad-purple-900">Blocked words</h3>
      <p className="text-xs text-pad-purple-700/50">
        Posts containing these are rejected. They also keep a chapter name off the leaderboard. Whole words and phrases
        only, so "class" never trips "ass".
      </p>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      <form onSubmit={add} className="mt-3 flex gap-2">
        <input value={word} onChange={(e) => setWord(e.target.value)} placeholder="Add a word or phrase" className={`${input} flex-1`} />
        <button className="rounded-lg bg-pad-purple-900 px-4 py-2 text-sm font-semibold text-white">Add</button>
      </form>
      {msg && <p className="mt-2 text-xs text-red-700">{msg}</p>}
      <div className="mt-3 flex max-h-56 flex-wrap gap-1.5 overflow-y-auto">
        {rows.map((r) => (
          <button key={r.word} onClick={() => remove(r.word)} title="Remove" className={`${btn} blur-[3px] hover:blur-none`}>
            {r.word} ×
          </button>
        ))}
      </div>
    </div>
  )
}

function PollsAdmin() {
  const { rows, error, refresh } = useLoad<PollAdminRow>(() => supabase.from('polls').select('*').order('sort_order').order('created_at'))
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState('')

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const opts = options.split('\n').map((o) => o.trim()).filter(Boolean)
    if (question.trim().length < 5 || opts.length < 2 || opts.length > 8) {
      alert('Add a question and 2 to 8 options, one per line.')
      return
    }
    const { error } = await supabase.from('polls').insert({ question: question.trim(), options: opts, sort_order: rows.length })
    if (error) alert(error.message)
    setQuestion('')
    setOptions('')
    await refresh()
  }

  async function toggle(p: PollAdminRow) {
    const { error } = await supabase.from('polls').update({ is_active: !p.is_active }).eq('id', p.id)
    if (error) alert(error.message)
    await refresh()
  }

  return (
    <div className={card}>
      <h3 className="font-semibold text-pad-purple-900">Quick polls</h3>
      <p className="text-xs text-pad-purple-700/50">Active polls show next to the Wall. Results are visible to voters.</p>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      <ul className="mt-3 space-y-2">
        {rows.map((p) => (
          <li key={p.id} className="flex items-start justify-between gap-3 rounded-lg bg-pad-purple-700/5 px-3 py-2">
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-pad-purple-900">{p.question}</p>
              <p className="text-xs text-pad-purple-700/60">{p.options.join(' / ')}</p>
            </div>
            <button onClick={() => toggle(p)} className={btn}>
              {p.is_active ? 'Turn off' : 'Turn on'}
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="mt-4 grid gap-2">
        <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="New poll question" className={input} />
        <textarea
          value={options}
          onChange={(e) => setOptions(e.target.value)}
          rows={3}
          placeholder={'Options, one per line'}
          className={input}
        />
        <button className="rounded-lg bg-pad-purple-900 px-4 py-2 text-sm font-semibold text-white">Add poll</button>
      </form>
    </div>
  )
}

function ChaptersAdmin() {
  const { rows, error, refresh } = useLoad<{ id: string; name: string }>(() => supabase.from('chapters').select('id, name').order('name'))
  const [paste, setPaste] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  async function importList(e: React.FormEvent) {
    e.preventDefault()
    const existing = new Set(rows.map((r) => r.name.toLowerCase()))
    const names = [
      ...new Set(
        paste
          .split('\n')
          .map((n) => n.replace(/\s+/g, ' ').trim())
          .filter((n) => n.length >= 2 && n.length <= 120),
      ),
    ].filter((n) => !existing.has(n.toLowerCase()))
    if (!names.length) {
      setMsg('Nothing new to import.')
      return
    }
    const { error } = await supabase.from('chapters').insert(names.map((name) => ({ name })))
    setMsg(error ? error.message : `Imported ${names.length} chapters.`)
    setPaste('')
    await refresh()
  }

  return (
    <div className={card}>
      <h3 className="font-semibold text-pad-purple-900">Chapter list ({rows.length})</h3>
      <p className="text-xs text-pad-purple-700/50">
        Suggestions in the chapter picker, and the spelling the leaderboard uses. Visitors can still type any chapter.
      </p>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      <form onSubmit={importList} className="mt-3 grid gap-2">
        <textarea
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          rows={4}
          placeholder={'Paste chapter names, one per line'}
          className={input}
        />
        <button className="rounded-lg bg-pad-purple-900 px-4 py-2 text-sm font-semibold text-white">Import</button>
      </form>
      {msg && <p className="mt-2 text-xs text-pad-purple-700/70">{msg}</p>}
      {rows.length > 0 && (
        <p className="mt-3 max-h-32 overflow-y-auto text-xs text-pad-purple-700/60">{rows.map((r) => r.name).join(', ')}</p>
      )}
    </div>
  )
}

export function CommunityAdmin() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <WallModeration />
      <div className="space-y-4">
        <PollsAdmin />
        <BlockedWords />
        <ChaptersAdmin />
      </div>
    </div>
  )
}
