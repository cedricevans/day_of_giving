import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Database } from '../lib/database.types'

type Session = Database['pad']['Tables']['sessions']['Row']
type Event = Database['pad']['Tables']['events']['Row']
type Lead = Database['pad']['Tables']['leads']['Row']
type Donation = Database['pad']['Tables']['donations']['Row']

export function useAdminData() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [donations, setDonations] = useState<Donation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [sessionsRes, eventsRes, leadsRes, donationsRes] = await Promise.all([
      supabase.from('sessions').select('*').order('created_at', { ascending: false }).limit(2000),
      supabase.from('events').select('*').order('created_at', { ascending: false }).limit(2000),
      supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(2000),
      supabase.from('donations').select('*').order('created_at', { ascending: false }).limit(2000),
    ])

    const firstError = sessionsRes.error || eventsRes.error || leadsRes.error || donationsRes.error
    if (firstError) {
      setError(firstError.message)
    } else {
      setSessions(sessionsRes.data ?? [])
      setEvents(eventsRes.data ?? [])
      setLeads(leadsRes.data ?? [])
      setDonations(donationsRes.data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function addDonation(input: Database['pad']['Tables']['donations']['Insert']) {
    const { error } = await supabase.from('donations').insert(input)
    if (error) throw error
    await refresh()
  }

  /** Inserts gifts not already imported (matched on YM Transaction_ID) and returns how many were new. */
  async function importDonations(rows: Database['pad']['Tables']['donations']['Insert'][]) {
    const { data, error } = await supabase
      .from('donations')
      .upsert(rows, { onConflict: 'ym_transaction_id', ignoreDuplicates: true })
      .select('id')
    if (error) throw error
    await refresh()
    return data?.length ?? 0
  }

  async function updateDonation(id: string, patch: Database['pad']['Tables']['donations']['Update']) {
    const { error } = await supabase.from('donations').update(patch).eq('id', id)
    if (error) throw error
    setDonations((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)))
  }

  async function deleteDonation(id: string) {
    const { error } = await supabase.from('donations').delete().eq('id', id)
    if (error) throw error
    setDonations((prev) => prev.filter((d) => d.id !== id))
  }

  return {
    sessions,
    events,
    leads,
    donations,
    loading,
    error,
    refresh,
    addDonation,
    importDonations,
    updateDonation,
    deleteDonation,
  }
}
