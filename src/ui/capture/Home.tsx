import { useMemo, useState } from 'react'
import { ArrowRight, Cube } from '@phosphor-icons/react'
import { resolveGeometry, type Box } from '../../domain/design/resolve'
import { BASES, exampleDesign, type Base, type BaseCategory } from '../../domain/furniture/examples'
import { useServices } from '../services'
import { Button, Chip } from '../system/components'
import { Logo, Emblem } from '../system/Brand'
import { useStore } from '../store'
import { sketch, type Face } from './sketch'

const CATEGORIES: [BaseCategory | 'all', string][] = [
  ['all', 'Todos'],
  ['bedroom', 'Recámara'],
  ['storage', 'Guardar'],
  ['tables', 'Mesas'],
]
/** Filters pay off only past six bases, two rows on a desk. */
const FILTERED = BASES.length > 6

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
      className="group flex flex-col gap-1.5 rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
    >
      <span className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border border-line bg-kraft p-3 transition group-hover:bg-kraft-2 group-active:scale-[0.98]">
        {boxes ? <Thumbnail boxes={boxes} /> : <Cube className="size-6 text-graphite-2" />}
      </span>
      <span className="text-sm font-medium text-graphite">{base.name}</span>
      <span className="numerals text-xs text-graphite-2" aria-label={`${height} de alto, ${width} de ancho, ${depth} de fondo, en milímetros`}>
        {Math.round(height)} × {Math.round(width)} × {Math.round(depth)}
      </span>
    </button>
  )
}

export function Home() {
  const startCapture = useStore((s) => s.startCapture)
  const fromExample = useStore((s) => s.fromExample)
  const [category, setCategory] = useState<BaseCategory | 'all'>('all')
  return (
    <main className="mx-auto flex min-h-full max-w-5xl flex-col items-center justify-center gap-10 px-6 py-12 md:flex-row md:gap-16">
      <div className="flex max-w-md flex-col gap-6">
        <div className="flex items-center gap-3">
          <Emblem className="size-10 shadow-[0_8px_20px_-10px_rgba(43,40,37,.6)]" />
          <p className="numerals text-sm text-graphite-2">Muebles de triplay · DIY</p>
        </div>
        <h1 className="text-6xl leading-[0.95] md:text-7xl">
          <Logo />
        </h1>
        <p className="text-lg leading-relaxed text-graphite">
          Toma fotos de un mueble y un carpintero experto lo convierte en un diseño de triplay que puedes explorar, ajustar platicando y armar tú mismo. Al final sabes cómo se arma y cuántas hojas comprar.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button variant="primary" className="min-h-12 px-6 text-base" onClick={startCapture}>
            Nuevo diseño <ArrowRight weight="bold" />
          </Button>
        </div>
      </div>
      <section className="flex w-full max-w-md flex-col gap-4 md:max-w-xl" aria-labelledby="bases-title">
        <div className="flex flex-col gap-1">
          <h2 id="bases-title" className="font-display text-2xl leading-tight font-semibold">
            O empieza de una base
          </h2>
          <p className="text-sm text-graphite-2">Ya tienen ficha: cambias medidas y opciones al instante, sin el experto.</p>
        </div>
        {FILTERED && (
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(([id, label]) => (
              <Chip key={id} active={category === id} aria-pressed={category === id} onClick={() => setCategory(id)}>
                {label}
              </Chip>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-x-3 gap-y-5 md:grid-cols-3">
          {BASES.filter((b) => category === 'all' || b.category === category).map((base) => (
            <BaseCard key={base.id} base={base} onOpen={fromExample} />
          ))}
        </div>
      </section>
    </main>
  )
}
