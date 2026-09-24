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

  return { sessions, events, leads, donations, loading, error, refresh, addDonation }
}
