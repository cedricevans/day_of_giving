import { useMemo, useState } from 'react'
import { parseYmExport, type YmDonation, type YmParseResult } from '../lib/ymImport'
import type { useAdminData } from '../hooks/useAdminData'

type Existing = ReturnType<typeof useAdminData>['donations'][number]

function formatCents(cents: number) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

const normName = (s: string | null) => (s ?? '').toLowerCase().replace(/[^a-z]/g, '')

/**
 * A gift entered by hand has no YM Transaction_ID, so the database can't tell
 * it apart from the same gift arriving later in an export. Pair each export
 * row with at most one hand-entered gift of the same amount from the same
 * donor (email, or name when either side has no email).
 */
function findManualMatches(rows: YmDonation[], existing: Existing[]) {
  const pool = existing.filter((d) => !d.ym_transaction_id)
  const matches = new Map<string, Existing>()
  for (const r of rows) {
    const i = pool.findIndex(
      (d) =>
        d.amount_cents === r.amount_cents &&
        (d.donor_email && r.donor_email
          ? d.donor_email.toLowerCase() === r.donor_email
          : normName(d.donor_name) !== '' && normName(d.donor_name) === normName(r.donor_name)),
    )
    if (i >= 0) matches.set(r.ym_transaction_id, pool.splice(i, 1)[0])
  }
  return matches
}

/**
 * Reads the YM export locally, shows what will be imported, and only sends
 * the whitelisted fields once the admin confirms.
 */
export function YmImport({
  existing,
  onImport,
  onLink,
  onDone,
}: {
  existing: Existing[]
  onImport: ReturnType<typeof useAdminData>['importDonations']
  onLink: ReturnType<typeof useAdminData>['updateDonation']
  onDone: () => void
}) {
  const [fileName, setFileName] = useState('')
  const [parsed, setParsed] = useState<YmParseResult | null>(null)
  const [excludedFunds, setExcludedFunds] = useState<Set<string>>(new Set())
  const [unlinked, setUnlinked] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const funds = useMemo(() => {
    const counts = new Map<string, { gifts: number; cents: number }>()
    for (const r of parsed?.rows ?? []) {
      const key = r.fund ?? '(no fund)'
      const c = counts.get(key) ?? { gifts: 0, cents: 0 }
      counts.set(key, { gifts: c.gifts + 1, cents: c.cents + r.amount_cents })
    }
    return [...counts].sort((a, b) => b[1].gifts - a[1].gifts)
  }, [parsed])

  const inFund = (parsed?.rows ?? []).filter((r) => !excludedFunds.has(r.fund ?? '(no fund)'))
  const importedIds = useMemo(
    () => new Set(existing.map((d) => d.ym_transaction_id).filter((id): id is string => !!id)),
    [existing],
  )
  const alreadyIn = inFund.filter((r) => importedIds.has(r.ym_transaction_id))
  const fresh = inFund.filter((r) => !importedIds.has(r.ym_transaction_id))
  const manualMatches = findManualMatches(fresh, existing)
  const toLink = fresh.filter((r) => manualMatches.has(r.ym_transaction_id) && !unlinked.has(r.ym_transaction_id))
  const selected = fresh.filter((r) => !toLink.includes(r))
  const total = selected.reduce((sum, r) => sum + r.amount_cents, 0)
  const listed = selected.filter((r) => r.list_publicly).length
  const withChapter = selected.filter((r) => r.chapter).length

  async function handleFile(file: File | undefined) {
    setResult(null)
    setExcludedFunds(new Set())
    setUnlinked(new Set())
    if (!file) return setParsed(null)
    setFileName(file.name)
    setParsed(parseYmExport(await file.text()))
  }

  async function handleImport() {
    if (!selected.length && !toLink.length) return
    setSaving(true)
    try {
      // Stamp the YM Transaction_ID on the hand-entered gift so this and every
      // later export recognises it. Fields an admin already filled are kept.
      for (const r of toLink) {
        const d = manualMatches.get(r.ym_transaction_id)!
        await onLink(d.id, {
          ym_transaction_id: r.ym_transaction_id,
          donor_name: d.donor_name ?? r.donor_name,
          donor_email: d.donor_email ?? r.donor_email,
          donated_at: d.donated_at ?? r.donated_at,
          fund: d.fund ?? r.fund,
          chapter: d.chapter ?? r.chapter,
          donor_state: d.donor_state ?? r.donor_state,
        })
      }
      const today = new Date().toISOString().slice(0, 10)
      const added = !selected.length
        ? 0
        : await onImport(
        selected.map((r) => ({
          ym_transaction_id: r.ym_transaction_id,
          donor_name: r.donor_name,
          donor_email: r.donor_email,
          amount_cents: r.amount_cents,
          donated_at: r.donated_at,
          fund: r.fund,
          chapter: r.chapter,
          donor_state: r.donor_state,
          is_recurring: r.is_recurring,
          list_publicly: r.list_publicly,
          referral_source: null,
          ym_export_date: today,
        })),
      )
      const skipped = alreadyIn.length + (selected.length - added)
      setResult(
        [
          `Imported ${added} new gift${added === 1 ? '' : 's'}.`,
          toLink.length > 0 &&
            `Matched ${toLink.length} to gift${toLink.length === 1 ? '' : 's'} already entered by hand, so they were not added twice.`,
          skipped > 0 && `${skipped} were already in the system and were left as is.`,
        ]
          .filter(Boolean)
          .join(' '),
      )
      setParsed(null)
      setFileName('')
    } catch (err) {
      setResult(`Import failed: ${(err as Error).message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mb-4 rounded-2xl border border-pad-gold-500/40 bg-white p-5">
      <p className="text-sm font-semibold text-pad-purple-900">Import from YourMembership</p>
      <p className="mt-1 text-xs text-pad-purple-700/60">
        In YM, export the campaign fund's donations from the Ecommerce tab as CSV, then choose the file here. The file
        is read in this browser. Only the transaction ID, name, email, amount, date, fund, chapter (Primary_Group) and
        honor roll consent are saved. Card, address and phone columns are ignored.
      </p>

      <input
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => handleFile(e.target.files?.[0])}
        className="mt-4 block text-sm text-pad-purple-700 file:mr-3 file:rounded-full file:border-0 file:bg-pad-purple-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
      />

      {result && <p className="mt-4 rounded-xl bg-pad-purple-700/5 p-3 text-sm text-pad-purple-900">{result}</p>}

      {parsed && (
        <div className="mt-5 space-y-4 text-sm">
          {parsed.missingColumns.length > 0 && (
            <p className="rounded-xl bg-red-50 p-3 text-red-700">
              {fileName} is missing {parsed.missingColumns.join(', ')}. Is this the Ecommerce donation export?
            </p>
          )}

          {parsed.rows.length === 0 && parsed.missingColumns.length === 0 && (
            <p className="rounded-xl bg-amber-50 p-3 text-amber-800">No gifts found in {fileName}.</p>
          )}

          {funds.length > 0 && (
            <div>
              <p className="font-medium text-pad-purple-900">Funds in this file</p>
              <p className="text-xs text-pad-purple-700/60">Untick any fund that isn't the Week of Giving fund.</p>
              <div className="mt-2 space-y-1">
                {funds.map(([fund, c]) => (
                  <label key={fund} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!excludedFunds.has(fund)}
                      onChange={(e) =>
                        setExcludedFunds((prev) => {
                          const next = new Set(prev)
                          if (e.target.checked) next.delete(fund)
                          else next.add(fund)
                          return next
                        })
                      }
                    />
                    <span className="text-pad-purple-900">{fund}</span>
                    <span className="text-pad-purple-700/50">
                      {c.gifts} gifts, {formatCents(c.cents)}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {parsed.skipped.length > 0 && (
            <div>
              <p className="font-medium text-pad-purple-900">Skipped rows</p>
              <ul className="mt-1 list-disc pl-5 text-pad-purple-700/70">
                {parsed.skipped.map((s) => (
                  <li key={s.reason}>
                    {s.count} × {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {alreadyIn.length > 0 && (
            <p className="rounded-xl bg-pad-purple-700/5 p-3 text-pad-purple-900">
              {alreadyIn.length} gift{alreadyIn.length === 1 ? ' is' : 's are'} already in the system from an earlier
              import and will be skipped, including any edits made since.
            </p>
          )}

          {manualMatches.size > 0 && (
            <div className="rounded-xl bg-amber-50 p-3 text-amber-900">
              <p className="font-medium">Possible duplicates of gifts entered by hand</p>
              <p className="mt-1 text-xs">
                Same donor and amount as a gift added with "+ Add one". Ticked ones are treated as the same gift: the YM
                record is attached to it instead of adding it again. Untick only if they really are two separate gifts.
              </p>
              <div className="mt-2 space-y-1">
                {fresh
                  .filter((r) => manualMatches.has(r.ym_transaction_id))
                  .map((r) => {
                    const d = manualMatches.get(r.ym_transaction_id)!
                    return (
                      <label key={r.ym_transaction_id} className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={!unlinked.has(r.ym_transaction_id)}
                          onChange={(e) =>
                            setUnlinked((prev) => {
                              const next = new Set(prev)
                              if (e.target.checked) next.delete(r.ym_transaction_id)
                              else next.add(r.ym_transaction_id)
                              return next
                            })
                          }
                        />
                        <span>
                          {r.donor_name || r.donor_email || 'Unnamed'}, {formatCents(r.amount_cents)} (entered{' '}
                          {new Date(d.created_at).toLocaleDateString()} as {d.donor_name || d.donor_email || 'unnamed'})
                        </span>
                      </label>
                    )
                  })}
              </div>
            </div>
          )}

          {parsed.rows.length > 0 && (
            <>
              <p className="text-xs text-pad-purple-700/60">
                Honor roll consent values seen in this file: {parsed.consentValues.map((v) => `"${v}"`).join(', ')}.
                Blank, No, False and 0 count as not consenting.
              </p>

              <div className="overflow-x-auto rounded-xl border border-pad-purple-700/10">
                <table className="w-full text-left text-xs">
                  <thead className="bg-pad-purple-700/5 text-pad-purple-700/60">
                    <tr>
                      <th className="px-3 py-2 font-medium">Donor</th>
                      <th className="px-3 py-2 font-medium">Amount</th>
                      <th className="px-3 py-2 font-medium">Chapter</th>
                      <th className="px-3 py-2 font-medium">Date</th>
                      <th className="px-3 py-2 font-medium">Honor roll</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.slice(0, 8).map((r) => (
                      <tr key={r.ym_transaction_id} className="border-t border-pad-purple-700/5">
                        <td className="px-3 py-2">{r.donor_name || '—'}</td>
                        <td className="px-3 py-2">{formatCents(r.amount_cents)}</td>
                        <td className="px-3 py-2">{r.chapter || '—'}</td>
                        <td className="px-3 py-2">{r.donated_at ? new Date(r.donated_at).toLocaleDateString() : '—'}</td>
                        <td className="px-3 py-2">{r.list_publicly ? 'Listed' : 'Private'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {selected.length > 8 && (
                  <p className="border-t border-pad-purple-700/5 px-3 py-2 text-xs text-pad-purple-700/50">
                    and {selected.length - 8} more
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-pad-purple-900">
                  <strong>{selected.length}</strong> new gifts, <strong>{formatCents(total)}</strong>. {listed} listed
                  publicly, {withChapter} with a chapter.
                  {toLink.length > 0 && ` ${toLink.length} matched to hand-entered gifts.`}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={onDone}
                    className="rounded-full border border-pad-purple-700/15 px-4 py-2 text-sm font-medium text-pad-purple-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={saving || (selected.length === 0 && toLink.length === 0)}
                    className="rounded-full bg-pad-purple-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {saving
                      ? 'Importing…'
                      : selected.length === 0 && toLink.length === 0
                        ? 'Nothing new to import'
                        : `Import ${selected.length} gifts`}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
