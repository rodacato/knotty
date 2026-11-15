import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Cube, FloppyDisk, Plus } from '@phosphor-icons/react'
import type { Base } from '../../domain/furniture/examples'
import { useServices } from '../services'
import { Button } from '../system/components'
import { Field, Input } from '../system/Field'
import { AppFooter } from '../shell/AppFooter'
import { AppHeader } from '../shell/AppHeader'
import { useExpertStatus } from '../shell/expertStatus'
import { cardsOf, type Card } from './cards'
import { STYLE_LABELS, matches, noMatchNote, roomChips } from './catalog'
import { useStore } from '../store'
import { packPlates, shapeOf, type Plate } from './plates'
import { RoomStrip } from './RoomStrip'
import { sketch } from './sketch'
import { Thumbnail } from './Thumbnail'
import { OpenDesignFile } from '../files/OpenDesignFile'

/** A numbered plate: the piece's drawing on plain paper and a ruled caption under it (UI-93). */
function BasePlate({ card: { base, size, boxes }, plate, onOpen }: { card: Card; plate: Plate; onOpen: (base: Base) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(base)}
      style={{ gridColumn: `${plate.column + 1} / span ${plate.columns}`, gridRow: `${plate.row + 1} / span ${plate.rows}` }}
      className="group relative flex min-h-72 flex-col border-r-2 border-b-2 border-graphite p-4 text-left focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-focus md:p-5"
    >
      {/* The number sits in the drawing's field, as on a printed plate, so the drawing keeps the plate's height. */}
      <span className="numerals absolute top-4 left-4 text-4xl leading-none font-bold md:top-5 md:left-5 md:text-5xl" aria-hidden>
        {String(plate.number).padStart(2, '0')}
      </span>
      <span className="flex min-h-0 flex-1 items-center justify-center px-2 pt-10 pb-2 transition group-hover:scale-[1.02] md:px-16 md:pt-4">{boxes ? <Thumbnail boxes={boxes} ink /> : <Cube className="size-6" />}</span>
      {/* The name on its own line and its style and measures under it, so a long name never strands a separator. */}
      <span className="block border-b-2 border-graphite pb-1.5 text-base md:text-lg">
        <span className="block font-display text-xl leading-tight font-bold group-hover:underline group-hover:decoration-2 group-hover:underline-offset-4 md:text-2xl">{base.name}</span>
        <span className="whitespace-nowrap">
          {STYLE_LABELS[base.style]}
          {' · '}
        </span>
        <span className="numerals whitespace-nowrap" aria-label={size.spoken}>
          {size.text}
        </span>
      </span>
    </button>
  )
}

const WIDE_SCREEN = '(min-width: 1024px)'
const MID_SCREEN = '(min-width: 640px)'

/** How many plate columns the screen holds: three on a laptop, two on a tablet, one on a phone. */
function useColumns() {
  const read = () => (typeof matchMedia === 'undefined' ? 3 : matchMedia(WIDE_SCREEN).matches ? 3 : matchMedia(MID_SCREEN).matches ? 2 : 1)
  const [columns, setColumns] = useState(read)
  useEffect(() => {
    const queries = [matchMedia(WIDE_SCREEN), matchMedia(MID_SCREEN)]
    const update = () => setColumns(read())
    queries.forEach((q) => q.addEventListener('change', update))
    return () => queries.forEach((q) => q.removeEventListener('change', update))
  }, [])
  return columns
}

function OwnDoor({ connected, onOpen }: { connected: boolean; onOpen: () => void }) {
  return (
    <section className="flex flex-col gap-4 border-t-[3px] border-graphite pt-6 md:flex-row md:items-center md:justify-between md:gap-8" aria-labelledby="own-title">
      <div className="flex flex-col gap-1">
        <h2 id="own-title" className="font-display text-2xl leading-tight font-semibold md:text-3xl">
          ¿Tienes otra idea?
        </h2>
        <p className="text-base md:text-lg">Describe el mueble que necesitas, con fotos o texto.</p>
        {!connected && <p className="text-base text-graphite-2">Conecta un experto para crear un diseño nuevo.</p>}
      </div>
      <button type="button" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 bg-graphite px-6 font-display text-xl font-semibold text-bone uppercase hover:bg-graphite/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" onClick={onOpen}>
        Crear un diseño <ArrowRight weight="bold" aria-hidden />
      </button>
    </section>
  )
}

/** Whether the bar that follows the mark is pinned to the top, so it can draw the edge the list slides under. */
function usePinned() {
  const mark = useRef<HTMLDivElement>(null)
  const [pinned, setPinned] = useState(false)
  useEffect(() => {
    if (!mark.current) return
    const observer = new IntersectionObserver(([entry]) => setPinned(!entry.isIntersecting && entry.boundingClientRect.top < 0))
    observer.observe(mark.current)
    return () => observer.disconnect()
  }, [])
  return { mark, pinned }
}

function useInView() {
  const target = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    if (!target.current) return
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting))
    observer.observe(target.current)
    return () => observer.disconnect()
  }, [])
  return { target, inView }
}

/** Where the list was when a base was opened, so coming back lands on the same card. */
let leftAt = 0

function useReturnToPlace() {
  useLayoutEffect(() => {
    window.scrollTo(0, leftAt)
    // Forgotten after this render settles: an effect that runs twice must find it both times.
    const forget = setTimeout(() => (leftAt = 0))
    return () => clearTimeout(forget)
  }, [])
}

export function Home() {
  const startCapture = useStore((s) => s.startCapture)
  const saved = useStore((s) => s.state)
  const resumeDesign = useStore((s) => s.resumeDesign)
  const adjustBase = useStore((s) => s.adjustBase)
  const query = useStore((s) => s.browsing)
  const browse = useStore((s) => s.browse)
  const { references, catalog, library } = useServices()
  const openLibrary = useStore((s) => s.openLibrary)
  const { connected } = useExpertStatus()
  const cards = useMemo(() => cardsOf(references.home(), catalog), [references, catalog])
  const chips = useMemo(() => roomChips(cards.map((c) => c.base), query), [cards, query])
  const shown = cards.filter((c) => matches(c.base, query))
  const { mark, pinned } = usePinned()
  useReturnToPlace()
  const open = (base: Base) => {
    leftAt = window.scrollY
    adjustBase(base)
  }
  const { target: door, inView: doorInView } = useInView()
  const columns = useColumns()
  const shapes = useMemo(() => new Map(cards.map((c) => [c.base.id, c.boxes ? (({ width, height }) => shapeOf(width, height))(sketch(c.boxes)) : ('square' as const)])), [cards])
  const plates = useMemo(() => packPlates(shown.map((c) => shapes.get(c.base.id) ?? 'square'), columns), [shown, shapes, columns])
  // Outlined in ink like the site's buttons; `!` because the system button sets its own fill, border and size.
  const outlined = 'min-h-12 gap-2 border-2! border-graphite! bg-bone! px-5! font-display text-lg! font-semibold text-graphite! uppercase hover:bg-kraft! max-md:flex-1 max-md:px-2!'
  const actions = (
    <>
      {saved && <Button className={outlined} onClick={resumeDesign}>Continuar mi diseño <ArrowRight aria-hidden /></Button>}
      {library.available && (
        <Button className={outlined} onClick={() => openLibrary(true)}>
          <FloppyDisk aria-hidden /> Mis muebles
        </Button>
      )}
      <OpenDesignFile className={outlined} />
    </>
  )
  return (
    <div className="flex min-h-full flex-col">
      <AppHeader action={{ label: 'Crear un diseño', onClick: startCapture }} />
      <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-10 px-5 pt-5 pb-24 md:px-8 md:pt-6 md:pb-8">
        <section className="flex flex-col gap-4" aria-labelledby="home-title">
          <div className="flex flex-col gap-1">
            {/* The site's eyebrow: condensed, over a heavy rule. */}
            <p className="mb-2 border-b-[3px] border-graphite pb-2 font-display text-lg font-semibold md:text-[21px]">Catálogo de muebles</p>
            <h1 id="home-title" className="font-display text-4xl leading-[1.05] font-bold text-balance md:text-6xl md:leading-[1.05]">
              Encuentra tu próximo mueble.
            </h1>
            <p className="mt-1 text-lg md:text-xl">Elige una base de triplay y ajusta sus medidas, acabado y armado. Puedes empezar sin conectar un experto.</p>
          </div>
          {/* On a phone the actions stay above the search, so what pins to the top is only the search and the rooms. */}
          <div className="flex gap-3 md:hidden">{actions}</div>
          <div ref={mark} />
          <div className={`sticky top-0 z-10 -mx-5 -mt-4 flex flex-col gap-3 px-5 py-3 md:-mx-8 md:px-8 ${pinned ? 'border-b-2 border-graphite bg-bone' : ''}`}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
              <div className="flex gap-3 max-md:hidden">{actions}</div>
              <Field label="Buscar en el catálogo" hiddenLabel className="md:flex-1">
                <Input type="search" className="md:min-h-12 md:text-lg" placeholder="Nombre, cuarto, estilo o código" value={query.text} onChange={(e) => browse({ text: e.target.value })} />
              </Field>
            </div>
            <RoomStrip chips={chips} chosen={query.room} onChoose={(room) => browse({ room })} />
          </div>
          {shown.length ? (
            <>
              <p className="text-base md:text-lg">{shown.length} {shown.length === 1 ? 'mueble' : 'muebles'} · Medidas: ancho × fondo × alto.</p>
              <div className="grid auto-rows-[minmax(18rem,auto)] border-t-[3px] border-l-2 border-graphite md:auto-rows-[18rem]" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
                {plates.map((plate) => (
                  <BasePlate key={shown[plate.index].base.id} card={shown[plate.index]} plate={plate} onOpen={open} />
                ))}
              </div>
            </>
          ) : (
            <p className="py-4 text-base" role="status">
              {noMatchNote(query)}
            </p>
          )}
        </section>
        <div ref={door}>
          <OwnDoor connected={connected} onOpen={startCapture} />
        </div>
      </main>
      {/* On a phone the masthead has no room for the action, so it floats, printed square in ink. */}
      <button
        type="button"
        inert={doorInView}
        className={`fixed right-4 bottom-4 z-20 inline-flex min-h-14 items-center gap-2 border-2 border-bone bg-graphite px-6 font-display text-lg font-semibold text-bone uppercase transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus md:hidden ${doorInView ? 'opacity-0' : ''}`}
        onClick={startCapture}
      >
        <Plus weight="bold" aria-hidden /> Crear un diseño
      </button>
      <AppFooter />
    </div>
  )
}
