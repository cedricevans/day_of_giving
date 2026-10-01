import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import type { Feature, Geometry } from 'geojson'
import statesUrl from 'us-atlas/states-albers-10m.json?url'
import { usePolling } from '../lib/community'
import { loadSupporterMap, type SupporterMapData } from '../lib/supporterMap'
import type { SupporterMapRow } from '../lib/database.types'
import { fipsToPostal } from '../lib/usStates'
import { SectionHeading } from './SectionHeading'

type StateShape = { code: string; name: string; d: string; cx: number; cy: number }

const MAP_W = 975
const MAP_H = 610

// states-albers-10m is already projected to a 975x610 canvas, so no projection is needed.
const path = geoPath()

function useStateShapes() {
  const [shapes, setShapes] = useState<StateShape[]>([])
  useEffect(() => {
    let alive = true
    fetch(statesUrl)
      .then((r) => r.json())
      .then((topo: Topology<{ states: GeometryCollection<{ name: string }> }>) => {
        const fc = feature(topo, topo.objects.states)
        const next = fc.features
          .map((f: Feature<Geometry, { name: string }>) => {
            const [cx, cy] = path.centroid(f)
            return {
              code: fipsToPostal[String(f.id)] ?? '',
              name: f.properties.name,
              d: path(f) ?? '',
              cx,
              cy,
            }
          })
          .filter((s) => s.code && s.d)
        if (alive) setShapes(next)
      })
      .catch((err) => console.warn('[supporter-map] failed to load state shapes', err))
    return () => {
      alive = false
    }
  }, [])
  return shapes
}

/** Live US map: a state lights up gold once someone there taps Give. Clicks, not confirmed gifts. */
export function SupporterMap() {
  const shapes = useStateShapes()
  const [data, setData] = useState<SupporterMapData | null>(null)

  const [selected, setSelected] = useState<string | null>(null)
  const mapRef = useRef<HTMLDivElement>(null)

  usePolling(async () => setData(await loadSupporterMap()))

  useEffect(() => {
    if (!selected) return
    const onPointer = (e: PointerEvent) => {
      if (!mapRef.current?.contains(e.target as Node)) setSelected(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [selected])

  const rowFor = (code: string) => data?.byState.get(code)
  const gave = (code: string) => {
    const r = rowFor(code)
    return Boolean(r && (r.has_give_click || (r.give_clicks ?? 0) > 0))
  }
  const givingStates = shapes.filter((s) => gave(s.code)).length
  const visitingStates = shapes.filter((s) => rowFor(s.code)).length
  const selectedShape = shapes.find((s) => s.code === selected)
  const toggle = (code: string) => setSelected((cur) => (cur === code ? null : code))

  return (
    <section id="map" className="relative overflow-hidden bg-pad-purple-950 px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_0%,rgba(94,59,163,0.45),transparent_60%)]" />
      <div className="relative mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Giving across the country"
          tone="dark"
          align="center"
          title={
            <>
              Light up <span className="text-gold-gradient italic">your state.</span>
            </>
          }
          description="Every state turns gold when a supporter there taps Give. Share the page and help fill the map."
        />

        <div className="mt-10 grid grid-cols-2 gap-3 sm:mx-auto sm:max-w-md">
          <div className="rounded-2xl bg-pad-gold-400 px-3 py-4 text-center">
            <p className="font-[family-name:var(--font-display)] text-4xl font-black text-pad-purple-950">{givingStates}</p>
            <p className="mt-1 text-[10px] font-extrabold uppercase tracking-[0.15em] text-pad-purple-900/80 sm:text-xs">
              States giving
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 px-3 py-4 text-center ring-1 ring-white/10">
            <p className="font-[family-name:var(--font-display)] text-4xl font-black text-white">{visitingStates}</p>
            <p className="mt-1 text-[10px] font-extrabold uppercase tracking-[0.15em] text-purple-100/70 sm:text-xs">
              States visiting
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-[2rem] bg-white/[0.04] p-3 ring-1 ring-white/10 sm:p-8">
          <div ref={mapRef} className="relative">
            <svg viewBox="0 0 975 610" className="block h-auto w-full" role="img" aria-label={`Map of US states. ${givingStates} states with supporters who tapped Give.`}>
              <defs>
                <filter id="map-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="6" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              {shapes.map((s) => {
                const isGiving = gave(s.code)
                const isVisiting = Boolean(rowFor(s.code))
                return (
                  <path
                    key={s.code}
                    d={s.d}
                    role="button"
                    tabIndex={0}
                    aria-label={`${s.name}: ${isGiving ? 'supporters giving' : isVisiting ? 'supporters visiting' : 'not lit up yet'}. Show details.`}
                    aria-pressed={selected === s.code}
                    onClick={() => toggle(s.code)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        toggle(s.code)
                      }
                    }}
                    filter={isGiving ? 'url(#map-glow)' : undefined}
                    className={`cursor-pointer stroke-pad-purple-950 outline-none transition-colors duration-700 hover:brightness-125 focus-visible:brightness-125 ${
                      isGiving ? 'fill-pad-gold-400' : isVisiting ? 'fill-pad-purple-600' : 'fill-white/10'
                    }`}
                    strokeWidth={1}
                  />
                )
              })}
              {selectedShape && (
                <path d={selectedShape.d} className="pointer-events-none fill-none stroke-white" strokeWidth={2.5} />
              )}
            </svg>

            {selectedShape && (
              <StatePopover
                key={selectedShape.code}
                shape={selectedShape}
                row={rowFor(selectedShape.code)}
                giving={gave(selectedShape.code)}
                onClose={() => setSelected(null)}
              />
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-semibold text-purple-100/70">
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-pad-gold-400" /> Someone tapped Give
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-pad-purple-600" /> Visiting
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-white/10 ring-1 ring-white/20" /> Not yet
            </span>
          </div>
        </div>

        <p className="mt-4 text-center text-xs leading-relaxed text-purple-100/40">
          Locations are approximate, by state, from visitor IP address. Gold means a supporter there tapped Give; gifts
          themselves are completed on pad.org.
          {data?.isDemo ? ' Showing sample data.' : ''}
        </p>
      </div>
    </section>
  )
}

function StatePopover({
  shape,
  row,
  giving,
  onClose,
}: {
  shape: StateShape
  row: SupporterMapRow | undefined
  giving: boolean
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const x = shape.cx / MAP_W
  const y = shape.cy / MAP_H
  // From sm up the card floats on the state, kept inside the map: anchored toward
  // the center horizontally, below states in the top half, above the rest.
  // Phones show it under the map instead, since the map is too short to hold it.
  const tx = x < 0.3 ? '-12%' : x > 0.7 ? '-88%' : '-50%'
  const ty = y < 0.45 ? '18px' : 'calc(-100% - 18px)'

  const status = giving ? 'Giving' : row ? 'Visiting' : 'Not lit up yet'
  const statusClass = giving
    ? 'bg-pad-gold-400 text-pad-purple-950'
    : row
      ? 'bg-pad-purple-600 text-white'
      : 'bg-pad-purple-950/10 text-pad-purple-900/70'

  const giveTaps =
    row?.give_clicks != null ? row.give_clicks.toLocaleString() : row?.has_give_click === false ? '0' : 'Under 3'

  async function share() {
    const url = `${window.location.origin}${window.location.pathname}#map`
    const text = `Help light up ${shape.name} for PAD Week of Giving.`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'PAD Week of Giving', text, url })
        return
      }
      await navigator.clipboard.writeText(`${text} ${url}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Share sheet dismissed or clipboard blocked; nothing to do.
    }
  }

  return (
    <div
      role="dialog"
      aria-label={`${shape.name} details`}
      className="relative mt-3 w-full rounded-2xl bg-white p-4 text-left text-pad-purple-950 shadow-2xl shadow-black/40 sm:absolute sm:left-[var(--px)] sm:top-[var(--py)] sm:z-10 sm:mt-0 sm:w-64 sm:[transform:translate(var(--tx),var(--ty))]"
      style={{ '--px': `${x * 100}%`, '--py': `${y * 100}%`, '--tx': tx, '--ty': ty } as CSSProperties}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-[family-name:var(--font-display)] text-xl font-black leading-tight">{shape.name}</p>
          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.12em] ${statusClass}`}>
            {status}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-1 -mt-1 rounded-full p-1 text-pad-purple-900/50 hover:bg-pad-purple-950/5 hover:text-pad-purple-950"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
            <path d="M5.3 4.3a1 1 0 0 0-1 1.4L8.6 10l-4.3 4.3a1 1 0 1 0 1.4 1.4L10 11.4l4.3 4.3a1 1 0 0 0 1.4-1.4L11.4 10l4.3-4.3a1 1 0 0 0-1.4-1.4L10 8.6 5.7 4.3a1 1 0 0 0-.4 0Z" />
          </svg>
        </button>
      </div>

      {row && !row.few ? (
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-pad-purple-950/5 px-1 py-2">
            <dt className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-pad-purple-900/60">Visitors</dt>
            <dd className="mt-0.5 text-lg font-black">{row.supporters?.toLocaleString()}</dd>
          </div>
          <div className="rounded-xl bg-pad-purple-950/5 px-1 py-2">
            <dt className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-pad-purple-900/60">Give taps</dt>
            <dd className="mt-0.5 text-lg font-black">{giveTaps}</dd>
          </div>
          <div className="rounded-xl bg-pad-purple-950/5 px-1 py-2">
            <dt className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-pad-purple-900/60">Of US</dt>
            <dd className="mt-0.5 text-lg font-black">{row.share != null ? `${row.share}%` : 'n/a'}</dd>
          </div>
        </dl>
      ) : (
        <p className="mt-3 text-sm leading-snug text-pad-purple-900/80">
          {row
            ? `A few supporters from ${shape.name} so far${giving ? ', and someone here tapped Give' : ''}. Exact counts show once 3 or more visit.`
            : `No one from ${shape.name} yet. Be the first to light it up.`}
        </p>
      )}

      <button
        type="button"
        onClick={share}
        className="mt-3 w-full rounded-full bg-pad-purple-950 px-4 py-2.5 text-xs font-extrabold uppercase tracking-[0.12em] text-white hover:bg-pad-purple-900"
      >
        {copied ? 'Link copied' : row ? 'Share with friends' : 'Be the first to share'}
      </button>
    </div>
  )
}
