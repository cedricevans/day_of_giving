import { useMemo, useState } from 'react'
import crest from '../assets/brand/pad-crest.png'
import { useAuth } from '../hooks/useAuth'
import { useAdminData } from '../hooks/useAdminData'
import { downloadCsv } from '../lib/csv'
import { CommunityAdmin } from './CommunityAdmin'
import { SubmissionsAdmin } from './SubmissionsAdmin'
import { YmImport } from './YmImport'

function formatCents(cents: number) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-pad-purple-700/10 bg-white p-6">
      <p className="text-sm font-medium text-pad-purple-700/60">{label}</p>
      <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-bold text-pad-purple-900">
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-pad-purple-700/40">{sub}</p>}
    </div>
  )
}

export function AdminDashboard() {
  const { signOut } = useAuth()
  const { sessions, events, leads, donations, loading, error, addDonation, importDonations, updateDonation, deleteDonation } =
    useAdminData()
  const [tab, setTab] = useState<'overview' | 'locations' | 'leads' | 'donations' | 'submissions' | 'community'>(
    'overview',
  )

  const kpis = useMemo(() => {
    const donateClicks = events.filter((e) => e.event_type === 'donate_click').length
    const joinClicks = events.filter((e) => e.event_type === 'join_click').length
    const totalRaised = donations.reduce((sum, d) => sum + d.amount_cents, 0)
    return {
      visits: sessions.length,
      donateClicks,
      joinClicks,
      leads: leads.length,
      totalRaised,
      donationCount: donations.length,
      conversionPct: sessions.length ? ((donateClicks + joinClicks) / sessions.length) * 100 : 0,
    }
  }, [sessions, events, leads, donations])

  return (
    <div className="min-h-screen bg-pad-cream">
      <header className="flex items-center justify-between border-b border-pad-purple-700/10 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <img src={crest} alt="" className="h-9 w-auto" />
          <div>
            <h1 className="font-semibold text-pad-purple-900">Week of Giving — Admin</h1>
            <p className="text-xs text-pad-purple-700/50">Live click/lead tracking · donations from the YM export</p>
          </div>
        </div>
        <button
          onClick={() => signOut()}
          className="rounded-full border border-pad-purple-700/15 px-4 py-2 text-sm font-medium text-pad-purple-700 hover:bg-pad-purple-700/5"
        >
          Sign out
        </button>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {error && (
          <div className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            Couldn't load data: {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <KpiCard label="Visits" value={loading ? '—' : String(kpis.visits)} />
          <KpiCard label="Donate clicks" value={loading ? '—' : String(kpis.donateClicks)} />
          <KpiCard label="Join clicks" value={loading ? '—' : String(kpis.joinClicks)} />
          <KpiCard label="Leads captured" value={loading ? '—' : String(kpis.leads)} />
          <KpiCard label="Click-through" value={loading ? '—' : `${kpis.conversionPct.toFixed(1)}%`} />
          <KpiCard
            label="Raised (from export)"
            value={loading ? '—' : formatCents(kpis.totalRaised)}
            sub={`${kpis.donationCount} gifts`}
          />
        </div>

        <nav className="mt-8 flex gap-1 overflow-x-auto border-b border-pad-purple-700/10">
          {(['locations', 'leads', 'donations', 'submissions', 'overview', 'community'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                tab === t
                  ? 'border-b-2 border-pad-gold-500 text-pad-purple-900'
                  : 'text-pad-purple-700/50 hover:text-pad-purple-700'
              }`}
            >
              {t}
            </button>
          ))}
        </nav>

        <div className="mt-6">
          {tab === 'overview' && <RecentEvents events={events} />}
          {tab === 'locations' && <LocationsBreakdown sessions={sessions} events={events} />}
          {tab === 'leads' && <LeadsTable leads={leads} />}
          {tab === 'donations' && (
            <DonationsTable
              donations={donations}
              onAdd={addDonation}
              onImport={importDonations}
              onUpdate={updateDonation}
              onDelete={deleteDonation}
            />
          )}
          {tab === 'submissions' && <SubmissionsAdmin />}
          {tab === 'community' && <CommunityAdmin />}
        </div>
      </main>
    </div>
  )
}

function RecentEvents({ events }: { events: ReturnType<typeof useAdminData>['events'] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-pad-purple-700/10 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-pad-purple-700/5 text-pad-purple-700/60">
          <tr>
            <th className="px-4 py-3 font-medium">Event</th>
            <th className="px-4 py-3 font-medium">When</th>
            <th className="px-4 py-3 font-medium">Detail</th>
          </tr>
        </thead>
        <tbody>
          {events.slice(0, 100).map((e) => (
            <tr key={e.id} className="border-t border-pad-purple-700/5">
              <td className="px-4 py-2.5 font-medium text-pad-purple-900">{e.event_type}</td>
              <td className="px-4 py-2.5 text-pad-purple-700/60">{new Date(e.created_at).toLocaleString()}</td>
              <td className="px-4 py-2.5 text-pad-purple-700/60">{JSON.stringify(e.metadata)}</td>
            </tr>
          ))}
          {events.length === 0 && (
            <tr>
              <td colSpan={3} className="px-4 py-8 text-center text-pad-purple-700/40">
                No events yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function LocationsBreakdown({
  sessions,
  events,
}: {
  sessions: ReturnType<typeof useAdminData>['sessions']
  events: ReturnType<typeof useAdminData>['events']
}) {
  const rows = useMemo(() => {
    const byRegion = new Map<
      string,
      { region: string; country: string; visits: number; donateClicks: number; joinClicks: number }
    >()

    const sessionRegion = new Map<string, string>()

    for (const s of sessions) {
      const key = s.geo_region_code
        ? `${s.geo_region_code}|${s.geo_country_code ?? ''}`
        : s.geo_country
          ? `?|${s.geo_country_code ?? ''}`
          : 'unknown'
      sessionRegion.set(s.id, key)

      const existing = byRegion.get(key)
      if (existing) {
        existing.visits += 1
      } else {
        byRegion.set(key, {
          region: s.geo_region || (s.geo_country ? '(region unknown)' : 'Unknown'),
          country: s.geo_country || '',
          visits: 1,
          donateClicks: 0,
          joinClicks: 0,
        })
      }
    }

    for (const e of events) {
      if (!e.session_id) continue
      const key = sessionRegion.get(e.session_id)
      if (!key) continue
      const row = byRegion.get(key)
      if (!row) continue
      if (e.event_type === 'donate_click') row.donateClicks += 1
      if (e.event_type === 'join_click') row.joinClicks += 1
    }

    return Array.from(byRegion.values()).sort((a, b) => b.visits - a.visits)
  }, [sessions, events])

  const geoCoverage = sessions.length ? sessions.filter((s) => s.geo_region).length / sessions.length : 0

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-pad-purple-700/60">
          Approximate location of visits and clicks, inferred from IP address. This is where interest comes from,
          not confirmed donations — PAD's donation records don't include location until entered from the weekly
          export.
        </p>
        <button
          onClick={() =>
            downloadCsv(
              'pad-locations.csv',
              rows.map((r) => ({
                region: r.region,
                country: r.country,
                visits: r.visits,
                donate_clicks: r.donateClicks,
                join_clicks: r.joinClicks,
              })),
            )
          }
          className="shrink-0 rounded-full border border-pad-purple-700/15 px-4 py-2 text-sm font-medium text-pad-purple-700 hover:bg-white"
        >
          Export CSV
        </button>
      </div>

      {sessions.length > 0 && geoCoverage < 0.5 && (
        <p className="mb-3 text-xs text-amber-600">
          Only {(geoCoverage * 100).toFixed(0)}% of visits have a resolved location so far — the lookup runs
          shortly after each visit and some may still be pending or failed silently (ad blockers, offline).
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-pad-purple-700/10 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-pad-purple-700/5 text-pad-purple-700/60">
            <tr>
              <th className="px-4 py-3 font-medium">Region</th>
              <th className="px-4 py-3 font-medium">Country</th>
              <th className="px-4 py-3 font-medium">Visits</th>
              <th className="px-4 py-3 font-medium">Donate clicks</th>
              <th className="px-4 py-3 font-medium">Join clicks</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.region}-${r.country}`} className="border-t border-pad-purple-700/5">
                <td className="px-4 py-2.5 font-medium text-pad-purple-900">{r.region}</td>
                <td className="px-4 py-2.5 text-pad-purple-700/60">{r.country || '—'}</td>
                <td className="px-4 py-2.5">{r.visits}</td>
                <td className="px-4 py-2.5">{r.donateClicks}</td>
                <td className="px-4 py-2.5">{r.joinClicks}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-pad-purple-700/40">
                  No visits yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function LeadsTable({ leads }: { leads: ReturnType<typeof useAdminData>['leads'] }) {
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button
          onClick={() =>
            downloadCsv(
              'pad-leads.csv',
              leads.map((l) => ({
                name: l.name ?? '',
                email: l.email,
                intent: l.intent,
                created_at: l.created_at,
              })),
            )
          }
          className="rounded-full border border-pad-purple-700/15 px-4 py-2 text-sm font-medium text-pad-purple-700 hover:bg-white"
        >
          Export CSV
        </button>
      </div>
      <div className="overflow-hidden rounded-2xl border border-pad-purple-700/10 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-pad-purple-700/5 text-pad-purple-700/60">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Intent</th>
              <th className="px-4 py-3 font-medium">Captured</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} className="border-t border-pad-purple-700/5">
                <td className="px-4 py-2.5">{l.name || '—'}</td>
                <td className="px-4 py-2.5 text-pad-purple-900">{l.email}</td>
                <td className="px-4 py-2.5 capitalize">{l.intent}</td>
                <td className="px-4 py-2.5 text-pad-purple-700/60">{new Date(l.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-pad-purple-700/40">
                  No leads captured yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DonationsTable({
  donations,
  onAdd,
  onImport,
  onUpdate,
  onDelete,
}: {
  donations: ReturnType<typeof useAdminData>['donations']
  onAdd: ReturnType<typeof useAdminData>['addDonation']
  onImport: ReturnType<typeof useAdminData>['importDonations']
  onUpdate: ReturnType<typeof useAdminData>['updateDonation']
  onDelete: ReturnType<typeof useAdminData>['deleteDonation']
}) {
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const publicCount = donations.filter((d) => d.list_publicly).length

  async function togglePublic(d: (typeof donations)[number]) {
    setBusyId(d.id)
    try {
      await onUpdate(d.id, { list_publicly: !d.list_publicly })
    } catch (err) {
      alert(`Couldn't update: ${(err as Error).message}`)
    } finally {
      setBusyId(null)
    }
  }

  async function remove(d: (typeof donations)[number]) {
    if (!confirm(`Remove the ${formatCents(d.amount_cents)} gift from ${d.donor_name || 'this donor'}? Use this for refunds or test gifts.`)) return
    setBusyId(d.id)
    try {
      await onDelete(d.id)
    } catch (err) {
      alert(`Couldn't remove: ${(err as Error).message}`)
    } finally {
      setBusyId(null)
    }
  }
  const [form, setForm] = useState({
    donor_name: '',
    donor_email: '',
    amount: '',
    is_recurring: false,
    referral_source: '',
    chapter: '',
  })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amountCents = Math.round(parseFloat(form.amount) * 100)
    if (!amountCents || amountCents <= 0) return
    setSaving(true)
    try {
      await onAdd({
        donor_name: form.donor_name || null,
        donor_email: form.donor_email || null,
        amount_cents: amountCents,
        is_recurring: form.is_recurring,
        referral_source: form.referral_source || null,
        chapter: form.chapter.replace(/\s+/g, ' ').trim() || null,
        ym_export_date: new Date().toISOString().slice(0, 10),
        matched_lead_id: null,
        notes: null,
      })
      setForm({ donor_name: '', donor_email: '', amount: '', is_recurring: false, referral_source: '', chapter: '' })
      setShowForm(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-pad-purple-700/60">
          Import the YourMembership Ecommerce export for the campaign fund. Re-importing the same or an overlapping
          file is safe. {publicCount} of {donations.length} gifts are listed on the public honor roll.
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() =>
              downloadCsv(
                'pad-donations.csv',
                donations.map((d) => ({
                  donor_name: d.donor_name ?? '',
                  donor_email: d.donor_email ?? '',
                  amount: (d.amount_cents / 100).toFixed(2),
                  recurring: d.is_recurring,
                  referral_source: d.referral_source ?? '',
                  chapter: d.chapter ?? '',
                  listed_publicly: d.list_publicly,
                  ym_transaction_id: d.ym_transaction_id ?? '',
                  donated_at: d.donated_at ?? '',
                  created_at: d.created_at,
                })),
              )
            }
            className="rounded-full border border-pad-purple-700/15 px-4 py-2 text-sm font-medium text-pad-purple-700 hover:bg-white"
          >
            Export CSV
          </button>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="rounded-full border border-pad-purple-700/15 px-4 py-2 text-sm font-medium text-pad-purple-700 hover:bg-white"
          >
            {showForm ? 'Cancel' : '+ Add one'}
          </button>
          <button
            onClick={() => setShowImport((s) => !s)}
            className="rounded-full bg-pad-gold-500 px-4 py-2 text-sm font-semibold text-pad-purple-950"
          >
            {showImport ? 'Close import' : 'Import YM export'}
          </button>
        </div>
      </div>

      {showImport && <YmImport onImport={onImport} onDone={() => setShowImport(false)} />}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 grid grid-cols-2 gap-3 rounded-2xl border border-pad-purple-700/10 bg-white p-5 sm:grid-cols-4">
          <input
            placeholder="Donor name"
            value={form.donor_name}
            onChange={(e) => setForm((f) => ({ ...f, donor_name: e.target.value }))}
            className="rounded-lg border border-pad-purple-700/15 px-3 py-2 text-sm"
          />
          <input
            placeholder="Donor email"
            value={form.donor_email}
            onChange={(e) => setForm((f) => ({ ...f, donor_email: e.target.value }))}
            className="rounded-lg border border-pad-purple-700/15 px-3 py-2 text-sm"
          />
          <input
            placeholder="Amount (USD)"
            type="number"
            step="0.01"
            required
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            className="rounded-lg border border-pad-purple-700/15 px-3 py-2 text-sm"
          />
          <input
            placeholder="Referral source"
            value={form.referral_source}
            onChange={(e) => setForm((f) => ({ ...f, referral_source: e.target.value }))}
            className="rounded-lg border border-pad-purple-700/15 px-3 py-2 text-sm"
          />
          <input
            placeholder="Chapter (if known)"
            maxLength={120}
            value={form.chapter}
            onChange={(e) => setForm((f) => ({ ...f, chapter: e.target.value }))}
            className="col-span-2 rounded-lg border border-pad-purple-700/15 px-3 py-2 text-sm"
          />
          <label className="col-span-2 flex items-center gap-2 text-sm text-pad-purple-700/70">
            <input
              type="checkbox"
              checked={form.is_recurring}
              onChange={(e) => setForm((f) => ({ ...f, is_recurring: e.target.checked }))}
            />
            Recurring (monthly) gift
          </label>
          <button
            type="submit"
            disabled={saving}
            className="col-span-2 rounded-lg bg-pad-purple-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save donation'}
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded-2xl border border-pad-purple-700/10 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-pad-purple-700/5 text-pad-purple-700/60">
            <tr>
              <th className="px-4 py-3 font-medium">Donor</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Chapter</th>
              <th className="px-4 py-3 font-medium">Given</th>
              <th className="px-4 py-3 font-medium">Honor roll</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {donations.map((d) => (
              <tr key={d.id} className="border-t border-pad-purple-700/5">
                <td className="px-4 py-2.5">
                  {d.donor_name || '—'}
                  {d.donor_email && <span className="block text-xs text-pad-purple-700/50">{d.donor_email}</span>}
                </td>
                <td className="px-4 py-2.5 font-semibold text-pad-purple-900">{formatCents(d.amount_cents)}</td>
                <td className="px-4 py-2.5">{d.is_recurring ? 'Monthly' : 'One-time'}</td>
                <td className="px-4 py-2.5">{d.referral_source || '—'}</td>
                <td className="px-4 py-2.5">{d.chapter || '—'}</td>
                <td className="px-4 py-2.5 text-pad-purple-700/60">
                  {new Date(d.donated_at ?? d.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-2.5">
                  <button
                    onClick={() => togglePublic(d)}
                    disabled={busyId === d.id}
                    title="Only donors who consented on PAD's form should be listed"
                    className={`rounded-full px-3 py-1 text-xs font-semibold disabled:opacity-50 ${
                      d.list_publicly ? 'bg-emerald-100 text-emerald-800' : 'bg-pad-purple-700/5 text-pad-purple-700/60'
                    }`}
                  >
                    {d.list_publicly ? 'Listed' : 'Private'}
                  </button>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => remove(d)}
                    disabled={busyId === d.id}
                    className="text-xs font-medium text-red-600/70 hover:text-red-700 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {donations.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-pad-purple-700/40">
                  No donations recorded yet. Import the YM export to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
