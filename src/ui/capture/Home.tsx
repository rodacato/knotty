import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Cube, Plus } from '@phosphor-icons/react'
import type { Base } from '../../domain/furniture/examples'
import { useServices } from '../services'
import { Button, Chip } from '../system/components'
import { Field, Input } from '../system/Field'
import { AppFooter } from '../shell/AppFooter'
import { AppHeader } from '../shell/AppHeader'
import { useExpertStatus } from '../shell/expertStatus'
import { cardsOf, type Card } from './cards'
import { STYLE_LABELS, matches, noMatchNote, roomChips } from './catalog'
import { useStore } from '../store'
import { Thumbnail } from './Thumbnail'

function BaseCard({ card: { base, size, boxes }, onOpen }: { card: Card; onOpen: (base: Base) => void }) {
  return (
    <button type="button" onClick={() => onOpen(base)} className="group flex flex-col gap-1.5 rounded-2xl text-left">
      <span className="drawing-surface flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-2xl border border-line p-4 transition group-hover:brightness-105 group-active:scale-[0.98] md:p-6">
        {boxes ? <Thumbnail boxes={boxes} /> : <Cube className="size-6" />}
      </span>
      <span className="text-base font-medium text-graphite md:text-lg">{base.name}</span>
      <span className="flex flex-col text-sm text-graphite-2 md:flex-row md:flex-wrap md:gap-x-1.5">
        <span>{STYLE_LABELS[base.style]}</span>
        <span className="hidden md:inline" aria-hidden>
          ·
        </span>
        <span className="numerals md:whitespace-nowrap" aria-label={size.spoken}>
          {size.text}
        </span>
      </span>
    </button>
  )
}

function OwnDoor({ connected, onOpen }: { connected: boolean; onOpen: () => void }) {
  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-line bg-kraft p-6 md:flex-row md:items-center md:justify-between md:gap-8 md:p-8" aria-labelledby="own-title">
      <div className="flex flex-col gap-1">
        <h2 id="own-title" className="font-display text-2xl leading-tight font-semibold md:text-3xl">
          ¿Tienes otra idea?
        </h2>
        <p className="text-base text-graphite-2 md:text-lg">Describe el mueble que necesitas, con fotos o texto.</p>
        {!connected && <p className="text-sm text-graphite-2">Conecta un experto para crear un diseño nuevo.</p>}
      </div>
      <Button variant="primary" className="min-h-12 shrink-0 px-6 text-base" onClick={onOpen}>
        Crear un diseño <ArrowRight weight="bold" />
      </Button>
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
  const { references, catalog } = useServices()
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
  return (
    <div className="flex min-h-full flex-col">
      <AppHeader />
      <div className="bg-kraft">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-3 px-5 py-10 md:gap-4 md:px-8 md:py-16">
          <p className="font-mono text-xs tracking-wider text-graphite-2">Catálogo de muebles</p>
          <h1 id="home-title" className="font-display text-4xl leading-[1.05] font-semibold tracking-tight text-balance md:text-6xl md:leading-[1.05]">
            Encuentra tu próximo mueble.
          </h1>
          <p className="max-w-3xl text-lg text-graphite-2 md:text-xl">Elige una base de triplay y ajusta sus medidas, acabado y armado. Puedes empezar sin conectar un experto.</p>
          {saved && <Button className="mt-2 w-fit gap-2 px-5" onClick={resumeDesign}>Continuar mi diseño <ArrowRight aria-hidden /></Button>}
        </div>
      </div>
      <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-8 px-5 py-4 md:px-8 md:py-6">
        <section className="flex flex-col gap-3" aria-labelledby="home-title">
          <div ref={mark} />
          <div className={`sticky top-0 z-10 -mx-5 flex flex-col gap-2 border-b px-5 py-3 transition-colors md:-mx-8 md:px-8 ${pinned ? 'border-line bg-bone' : 'border-transparent'}`}>
            <Field label="Buscar en el catálogo" hiddenLabel>
              <Input type="search" className="md:min-h-12 md:text-lg" placeholder="Nombre, cuarto, estilo o código" value={query.text} onChange={(e) => browse({ text: e.target.value })} />
            </Field>
            <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0" role="group" aria-label="Cuarto">
              {chips.map(({ room, label, count }) => (
                <Chip key={room} active={query.room === room} aria-pressed={query.room === room} className={`min-h-11 shrink-0 px-5 text-sm! ${query.room === room ? 'font-bold!' : ''}`} onClick={() => browse({ room })}>
                  {label} <span className="numerals font-normal text-graphite-2">{count}</span>
                </Chip>
              ))}
            </div>
          </div>
          {shown.length ? (
            <>
              <p className="text-sm text-graphite-2">{shown.length} {shown.length === 1 ? 'mueble' : 'muebles'} · Medidas: ancho × fondo × alto.</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 md:gap-x-6 md:gap-y-8 lg:grid-cols-4">
                {shown.map((card) => (
                  <BaseCard key={card.base.id} card={card} onOpen={open} />
                ))}
              </div>
            </>
          ) : (
            <p className="py-4 text-base text-graphite-2" role="status">
              {noMatchNote(query)}
            </p>
          )}
        </section>
        <div ref={door}>
          <OwnDoor connected={connected} onOpen={startCapture} />
        </div>
      </main>
      <Button
        variant="primary"
        inert={doorInView}
        className={`fixed right-4 bottom-4 z-20 min-h-14 rounded-full px-6 text-lg shadow-xl md:right-6 md:bottom-6 ${doorInView ? 'opacity-0' : ''}`}
        onClick={startCapture}
      >
        <Plus weight="bold" /> Crear un diseño
      </Button>
      <AppFooter />
    </div>
  )
}
