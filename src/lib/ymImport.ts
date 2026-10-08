/**
 * Parses YourMembership's Ecommerce donation export in the browser and keeps
 * only what the campaign needs. Card, address and phone columns are read
 * past and never leave the admin's machine.
 */

const HONOR_ROLL_COLS = [
  'I_agree_to_list_my_name_on_the_honor_roll_of_donors_on_the_website.',
  'I_consent_to_list_my_name_as_a_donor_on_the_P.A.D._website_and_official_social_media_channels.',
]

const FAILED_STATUS = /declin|fail|void|refund|cancel|reject|error/i
const NO_VALUE = /^(no|n|false|0|off|unchecked|none|null)\b/i

export type YmDonation = {
  ym_transaction_id: string
  donor_name: string | null
  donor_email: string | null
  amount_cents: number
  donated_at: string | null
  fund: string | null
  chapter: string | null
  is_recurring: boolean
  list_publicly: boolean
  status: string
}

export type YmParseResult = {
  rows: YmDonation[]
  skipped: { reason: string; count: number }[]
  missingColumns: string[]
  consentValues: string[]
}

/** RFC 4180 CSV: quoted fields, doubled quotes, newlines inside quotes, optional BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const s = text.replace(/^﻿/, '')

  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') {
        quoted = false
      } else {
        field += c
      }
    } else if (c === '"') {
      quoted = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += c
    }
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ''))
}

function toCents(raw: string) {
  const n = parseFloat(raw.replace(/[$,\s]/g, ''))
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

/** YM dates look like "10/13/2026 3:45:12 PM"; Safari won't parse that with new Date(). */
function toIso(raw: string) {
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AP]M)?)?$/i)
  if (m) {
    let hour = Number(m[4] ?? 0)
    const ampm = m[7]?.toUpperCase()
    if (ampm === 'PM' && hour < 12) hour += 12
    if (ampm === 'AM' && hour === 12) hour = 0
    const d = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]), hour, Number(m[5] ?? 0), Number(m[6] ?? 0))
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  const d = new Date(raw)
  return raw.trim() && !Number.isNaN(d.getTime()) ? d.toISOString() : null
}

function said(value: string | undefined) {
  const v = (value ?? '').trim()
  return v !== '' && !NO_VALUE.test(v)
}

export function parseYmExport(text: string): YmParseResult {
  const [header = [], ...body] = parseCsv(text)
  const col = new Map(header.map((h, i) => [h.trim(), i]))
  const required = ['Transaction_ID', 'Amount', 'First_Name', 'Last_Name']
  const missingColumns = required.filter((h) => !col.has(h))
  const get = (r: string[], name: string) => {
    const i = col.get(name)
    return i === undefined ? '' : (r[i] ?? '').trim()
  }

  const skipped = new Map<string, number>()
  const skip = (reason: string) => skipped.set(reason, (skipped.get(reason) ?? 0) + 1)
  const consentValues = new Set<string>()
  const seen = new Set<string>()
  const rows: YmDonation[] = []

  for (const r of body) {
    const id = get(r, 'Transaction_ID')
    const status = get(r, 'Status')
    const amount = toCents(get(r, 'Amount'))
    if (!id) {
      skip('No Transaction_ID')
      continue
    }
    if (seen.has(id)) {
      skip('Duplicate row in this file')
      continue
    }
    if (FAILED_STATUS.test(status)) {
      skip(`Status "${status}"`)
      continue
    }
    if (amount <= 0) {
      skip('Amount is zero or missing')
      continue
    }
    seen.add(id)

    const consents = HONOR_ROLL_COLS.map((c) => get(r, c))
    consents.forEach((v) => consentValues.add(v === '' ? '(blank)' : v))
    const name = [get(r, 'First_Name'), get(r, 'Last_Name')].filter(Boolean).join(' ').replace(/\s+/g, ' ')

    rows.push({
      ym_transaction_id: id,
      donor_name: name || null,
      donor_email: get(r, 'Email').toLowerCase() || null,
      amount_cents: amount,
      donated_at: toIso(get(r, 'Date_Submitted')),
      fund: get(r, 'Fund') || get(r, 'Fund_Code') || null,
      chapter: get(r, 'Primary_Group').replace(/\s+/g, ' ').slice(0, 120) || null,
      is_recurring: /recur|month|schedul/i.test(get(r, 'Payment_Type')) || /recur|month/i.test(get(r, 'FundType')),
      list_publicly: consents.some(said),
      status,
    })
  }

  return {
    rows,
    skipped: [...skipped].map(([reason, count]) => ({ reason, count })),
    missingColumns,
    consentValues: [...consentValues],
  }
}
