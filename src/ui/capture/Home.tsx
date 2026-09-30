import { useMemo, useState } from 'react'
import { ArrowRight, Cube, Plus } from '@phosphor-icons/react'
import { resolveGeometry, type Box } from '../../domain/design/resolve'
import { exampleDesign, type Base } from '../../domain/furniture/examples'
import { useServices } from '../services'
import { Button, Chip } from '../system/components'
import { AppFooter } from '../shell/AppFooter'
import { AppHeader } from '../shell/AppHeader'
import { useExpertStatus } from '../shell/expertStatus'
import { basesOfFilter, countLine, FILTERS, onlyOneNote, type CategoryFilter } from './catalog'
import { useStore } from '../store'
import { sketch, type Face } from './sketch'

const FACE: Record<Face, string> = { front: 'fill-birch', top: 'fill-[color-mix(in_srgb,var(--color-birch)_60%,white)]', side: 'fill-pine' }

/** The base as Knotty builds it, drawn from its pieces. */
function Thumbnail({ boxes }: { boxes: Map<string, Box> }) {
  const { polygons, width, height } = useMemo(() => sketch(boxes), [boxes])
  const pad = Math.max(width, height) * 0.08
  return (
    <svg viewBox={`${-pad} ${-pad} ${width + 2 * pad} ${height + 2 * pad}`} className="size-full" aria-hidden>
      {polygons.map((p, i) => (
        <polygon key={i} points={p.points.map(([x, y]) => `${x},${y}`).join(' ')} className={`${FACE[p.face]} stroke-walnut/80 [stroke-linejoin:round] [stroke-width:0.8] [vector-effect:non-scaling-stroke]`} />
      ))}
    </svg>
  )
}

function BaseCard({ base, onOpen }: { base: Base; onOpen: (base: Base) => void }) {
  const { catalog } = useServices()
  const { design, boxes } = useMemo(() => {
    const { design } = exampleDesign(base, catalog)
    const geo = resolveGeometry(design, catalog)
    return { design, boxes: geo.ok ? geo.value.boxes : null }
  }, [base, catalog])
  const { height, width, depth } = design.dimensions
  return (
    <button
      type="button"
      onClick={() => onOpen(base)}
      className="group flex flex-col gap-1.5 rounded-2xl text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
    >
      <span className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-2xl border border-line bg-kraft p-4 md:p-6 transition group-hover:bg-kraft-2 group-active:scale-[0.98]">
        {boxes ? <Thumbnail boxes={boxes} /> : <Cube className="size-6 text-graphite-2" />}
      </span>
      <span className="text-base font-medium text-graphite md:text-lg">{base.name}</span>
      <span className="numerals text-sm text-graphite-2" aria-label={`${height} de alto, ${width} de ancho, ${depth} de fondo, en milímetros`}>
        {Math.round(height)} × {Math.round(width)} × {Math.round(depth)}
      </span>
    </button>
  )
}

function OwnDoor({ onOpen, layout }: { onOpen: () => void; layout: 'cell' | 'row' }) {
  const cell = layout === 'cell'
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group items-center gap-4 rounded-2xl border border-line bg-kraft text-left transition hover:bg-kraft-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber ${
        cell ? 'hidden min-h-full flex-col justify-center px-6 py-8 text-center md:flex' : 'col-span-2 flex p-5 md:hidden'
      }`}
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-full border border-line bg-bone">
        <Plus className="size-5" />
      </span>
      <span className={`flex flex-col gap-1 ${cell ? 'items-center' : 'flex-1'}`}>
        <span className="font-display text-xl leading-tight font-semibold md:text-2xl">¿No está el tuyo?</span>
        <span className="text-sm text-graphite-2 md:text-base">Cuéntanos qué es, con fotos o una descripción.</span>
        {cell && (
          <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium">
            Diseña el tuyo <ArrowRight weight="bold" />
          </span>
        )}
      </span>
      {!cell && <ArrowRight className="size-5 shrink-0" />}
    </button>
  )
}

export function Home() {
  const startCapture = useStore((s) => s.startCapture)
  const fromExample = useStore((s) => s.fromExample)
  const openSettings = useStore((s) => s.openSettings)
  const { references } = useServices()
  const { connected } = useExpertStatus()
  const bases = useMemo(() => references.home(), [references])
  const [filter, setFilter] = useState<CategoryFilter>('featured')
  const shown = basesOfFilter(bases, filter)
  const designYourOwn = connected ? startCapture : () => openSettings(true)
  return (
    <div className="flex min-h-full flex-col">
      <AppHeader />
      <div className="bg-kraft">
        <section className="mx-auto flex w-full max-w-[1280px] flex-col gap-5 px-5 pt-4 pb-6 md:flex-row md:items-center md:justify-between md:gap-12 md:px-8 md:py-10" aria-labelledby="home-title">
          <div className="flex max-w-3xl flex-col gap-3">
            <h1 id="home-title" className="font-display font-semibold tracking-tight text-4xl leading-[1.05] md:text-6xl md:leading-[1.05]">
              Elige un mueble. Ajústalo. Ármalo tú mismo.
            </h1>
            <p className="text-base text-graphite-2 md:text-xl">Al final sabes cómo se arma y cuántas hojas comprar.</p>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-bone p-4 md:w-[420px] md:shrink-0 md:flex-col md:items-stretch md:gap-4 md:rounded-3xl md:p-7">
            <div className="flex flex-col gap-1 md:gap-3">
              <h2 className="font-display text-xl leading-tight font-semibold md:text-2xl">Diseña el tuyo</h2>
              <p className="text-sm text-graphite-2 md:hidden">Con fotos o una descripción.</p>
              <p className="hidden text-base md:block">Toma fotos de un mueble y un carpintero experto lo convierte en un diseño de triplay.</p>
            </div>
            <Button variant={connected ? 'primary' : 'secondary'} className="min-h-11 shrink-0 px-5 text-base md:min-h-12" onClick={designYourOwn}>
              {connected ? 'Nuevo diseño' : 'Conectar experto'} <ArrowRight weight="bold" className="hidden md:block" />
            </Button>
            {!connected && <p className="hidden text-sm text-graphite-2 md:block">Necesita tu experto conectado; las bases no.</p>}
          </div>
        </section>
      </div>
      <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-5 px-5 py-8 md:px-8 md:py-12">
        <section className="flex flex-col gap-5" aria-labelledby="bases-title">
          <div className="flex flex-col gap-1">
            <h2 id="bases-title" className="font-display text-3xl leading-tight font-semibold md:text-4xl">
              Empieza de una base
            </h2>
            <p className="text-base text-graphite-2 md:text-lg">Ya tienen ficha: cambias medidas y opciones al instante, sin el experto.</p>
            <p className="numerals text-sm text-graphite-2">{countLine(shown.length, filter)}</p>
          </div>
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
            {FILTERS.map(([id, label]) => (
              <Chip key={id} active={filter === id} aria-pressed={filter === id} className={`min-h-11 shrink-0 px-5 text-sm! ${filter === id ? 'font-bold!' : ''}`} onClick={() => setFilter(id)}>
                {label}
              </Chip>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 md:gap-x-6 md:gap-y-8">
            {shown.map((base) => (
              <BaseCard key={base.id} base={base} onOpen={fromExample} />
            ))}
            <OwnDoor onOpen={designYourOwn} layout="cell" />
            <OwnDoor onOpen={designYourOwn} layout="row" />
          </div>
          {onlyOneNote(shown.length, filter) && <p className="text-base text-graphite-2">{onlyOneNote(shown.length, filter)}</p>}
        </section>
      </main>
      <AppFooter />
    </div>
  )
}
