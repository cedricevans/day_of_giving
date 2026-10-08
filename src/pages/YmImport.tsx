import { useMemo, useState } from 'react'
import { parseYmExport, type YmParseResult } from '../lib/ymImport'
import type { useAdminData } from '../hooks/useAdminData'

function formatCents(cents: number) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

/**
 * Reads the YM export locally, shows what will be imported, and only sends
 * the whitelisted fields once the admin confirms.
 */
export function YmImport({
  onImport,
  onDone,
}: {
  onImport: ReturnType<typeof useAdminData>['importDonations']
  onDone: () => void
}) {
  const [fileName, setFileName] = useState('')
  const [parsed, setParsed] = useState<YmParseResult | null>(null)
  const [excludedFunds, setExcludedFunds] = useState<Set<string>>(new Set())
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

  const selected = (parsed?.rows ?? []).filter((r) => !excludedFunds.has(r.fund ?? '(no fund)'))
  const total = selected.reduce((sum, r) => sum + r.amount_cents, 0)
  const listed = selected.filter((r) => r.list_publicly).length
  const withChapter = selected.filter((r) => r.chapter).length

  async function handleFile(file: File | undefined) {
    setResult(null)
    setExcludedFunds(new Set())
    if (!file) return setParsed(null)
    setFileName(file.name)
    setParsed(parseYmExport(await file.text()))
  }

  async function handleImport() {
    if (!selected.length) return
    setSaving(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const added = await onImport(
        selected.map((r) => ({
          ym_transaction_id: r.ym_transaction_id,
          donor_name: r.donor_name,
          donor_email: r.donor_email,
          amount_cents: r.amount_cents,
          donated_at: r.donated_at,
          fund: r.fund,
          chapter: r.chapter,
          is_recurring: r.is_recurring,
          list_publicly: r.list_publicly,
          referral_source: null,
          ym_export_date: today,
        })),
      )
      setResult(
        `Imported ${added} new gift${added === 1 ? '' : 's'}. ${selected.length - added} were already in the system and were left as is.`,
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
                  <strong>{selected.length}</strong> gifts, <strong>{formatCents(total)}</strong>. {listed} listed
                  publicly, {withChapter} with a chapter.
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
                    disabled={saving || selected.length === 0}
                    className="rounded-full bg-pad-purple-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {saving ? 'Importing…' : `Import ${selected.length} gifts`}
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
