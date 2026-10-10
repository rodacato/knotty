import { ArrowLeft, Printer, Warning } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { analyze } from '../../domain/checks/analysis'
import { counterLines } from '../../domain/estimate/counterList'
import { estimatePurchase } from '../../domain/estimate/purchase'
import { atTheYard, toolsFor, type Advice } from '../../domain/estimate/workshop'
import { outline } from '../../domain/design/slants'
import { applySettings } from '../../domain/materials/catalog'
import type { Way } from '../../domain/furniture/modules/guide'
import { moduleOf } from '../../domain/furniture/modules/plan'
import { currentDesign, type DesignState } from '../../domain/session/state'
import { currentPlan } from '../../application/useCases'
import { useServices } from '../services'
import { useStore } from '../store'
import { Button } from '../system/components'
import type { Offset } from '../scene/explode'
import { drawDiagram, spreadApart, VIEWS, type Angle, type Diagram, type Shape } from './diagram'

const INK = '#1d1b19'
/** What was already there when a phase begins. */
const FAINT = '#a8a29a'
const SHADES = { side: '#d9d2c7', front: '#efebe4', up: '#ffffff' }
const FAINT_SHADES = { side: '#f1eee9', front: '#f9f8f5', up: '#ffffff' }
/** How far from the middle each piece is drawn, against where it really goes. */
const SPREAD = 1.6
const SMALLER: Angle[] = ['left', 'back', 'front', 'top']
/** How far the pieces of a detail are drawn from its middle. */
const DETAIL_SPREAD = 1.35
/** How far from its place a piece on its way is drawn, against the longest side of the furniture. */
const ON_ITS_WAY = 0.2
const WAYS: Record<Way, Offset> = { back: [0, 0, -1], below: [0, -1, 0], front: [0, 0, 1], above: [0, 1, 0] }

const apartLabel = (view: string) => `Las piezas separadas, ${view.toLowerCase()}, cada una con el número de su renglón`

/** `hidden` says whether a piece nothing shows still gets its number: the pieces apart do, a phase leaves it to its detail. */
function Drawing({ diagram, label, className, hidden = true }: { diagram: Diagram; label: string; className: string; hidden?: boolean }) {
  const radius = diagram.dot
  const focused = diagram.pieces.some((p) => p.marked)
  // Two layers of one leg carry the same number on the same spot: it is written once.
  const numbers = diagram.pieces
    .filter((p) => p.number !== null && (hidden || p.seen))
    .filter((p, i, all) => !all.slice(0, i).some((q) => q.number === p.number && Math.hypot(q.badge[0] - p.badge[0], q.badge[1] - p.badge[1]) < 2 * radius))
  return (
    <svg viewBox={`0 0 ${diagram.width} ${diagram.height}`} className={className} role="img" aria-label={label}>
      {diagram.pieces.map((p) => (
        <g key={p.id}>
          {p.faces.map((face, i) => (
            <polygon key={i} points={face.points} fill={(focused && !p.marked ? FAINT_SHADES : SHADES)[face.looks]} stroke={focused && !p.marked ? FAINT : INK} strokeWidth={focused && p.marked ? 1.75 : 1} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          ))}
        </g>
      ))}
      {/* The numbers go over every board: one drawn with its piece is covered by the next piece. */}
      {numbers.map((p) => (
        <g key={p.id}>
          <circle cx={p.badge[0]} cy={p.badge[1]} r={radius} fill={INK} />
          <text x={p.badge[0]} y={p.badge[1]} fill="#ffffff" fontSize={radius * 1.15} fontWeight={600} textAnchor="middle" dominantBaseline="central">
            {p.number}
          </text>
        </g>
      ))}
    </svg>
  )
}

function Checklist({ title, lines }: { title: string; lines: Advice[] }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-2xl font-semibold [break-after:avoid]">{title}</h2>
      <ul className="flex flex-col gap-1.5 text-[15px] leading-snug">
        {lines.map((line) => (
          <li key={line.text} className="flex gap-2 [break-inside:avoid]">
            <span aria-hidden className="mt-0.5 size-4 shrink-0 rounded-sm border-2 border-[#1d1b19]" />
            {line.text}
          </li>
        ))}
      </ul>
    </section>
  )
}

/** The reviewed design on paper: what to check before cutting, the cut list with every piece by name, and the pieces apart with the number of their line. It only reads the design. */
export function TakeAway({ state }: { state: DesignState }) {
  const { catalog } = useServices()
  const settings = useStore((s) => s.catalogSettings)
  const openTakeAway = useStore((s) => s.openTakeAway)
  const design = currentDesign(state)
  const sheet = useMemo(() => {
    const effective = applySettings(catalog, settings)
    const analysis = analyze(design, catalog)
    if (!analysis.valid) return null
    const blocks = counterLines(design, analysis.geo, estimatePurchase(design, analysis.geo, effective))
    const numbers = new Map(blocks.flatMap((b) => b.lines.flatMap((l) => l.ids.map((id) => [id, l.number] as const))))
    const apart = spreadApart(analysis.geo.boxes, SPREAD)
    const { trim, kerf } = effective.layout
    // The guide is the module's, of the plan the design still is; a design with no plan, or one that left it behind, has none.
    const { plan, diverged } = currentPlan(state)
    const phases = (plan && !diverged ? moduleOf(plan).phases?.(plan, design) : null) ?? []
    const shapes = new Map(design.pieces.flatMap((p): [string, Shape][] => {
      const box = analysis.geo.boxes.get(p.id)
      return box && (p.slants?.length || p.rounds?.length) ? [[p.id, { normal: p.normal, points: outline(box, p.normal, p.slants ?? [], p.rounds) }]] : []
    }))
    const only = (ids: Iterable<string>) => {
      const wanted = new Set(ids)
      return new Map([...analysis.geo.boxes].filter(([id]) => wanted.has(id)))
    }
    const numbered = (ids: string[]) => new Map(ids.flatMap((id) => (numbers.has(id) ? [[id, numbers.get(id)!] as const] : [])))
    const reach = Math.max(design.dimensions.width, design.dimensions.height, design.dimensions.depth) * ON_ITS_WAY
    const onItsWay = (ids: string[], from?: Way) => new Map(from ? ids.map((id) => [id, WAYS[from].map((d) => d * reach) as Offset]) : [])
    const guide = phases.map((phase, i) => {
      const before = phases.slice(0, i).flatMap((p) => p.pieces)
      const detail = phase.detail && only(phase.detail.pieces)
      const lots = phase.lots ?? (phase.pieces.length ? [{ pieces: detail?.size === phase.pieces.length ? [] : phase.pieces, entersFrom: phase.entersFrom }] : [])
      return {
        ...phase,
        // Each lot over the ones before it; a phase that is one lot marks all its pieces, numbered or not.
        drawings: lots.map((lot, k) => {
          const marked = phase.lots ? lot.pieces : phase.pieces
          return drawDiagram(only([...before, ...(phase.lots ? lots.slice(0, k + 1).flatMap((l) => l.pieces) : phase.pieces)]), onItsWay(marked, lot.entersFrom), numbered(lot.pieces), phase.seenFrom ?? 'right', { marked: new Set(marked), shapes })
        }),
        detailDrawing: detail?.size ? drawDiagram(detail, spreadApart(detail, DETAIL_SPREAD), numbered(phase.detail!.pieces), 'right', { shapes }) : null,
      }
    })
    return { guide, yard: atTheYard(design), tools: toolsFor(design), blocks, saw: `${trim > 0 ? `Refilado de ${trim} mm por orilla` : 'Sin refilar'} · disco de ${kerf} mm`, drawn: (angle: Angle) => drawDiagram(analysis.geo.boxes, apart, numbers, angle, { shapes }) }
  }, [catalog, settings, design, state])
  const { height, width, depth } = design.dimensions
  const [today] = useState(() => new Date().toLocaleDateString('es-MX'))

  return (
    <div className="min-h-dvh bg-white text-[#1d1b19]">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-white/90 px-4 py-2 backdrop-blur print:hidden">
        <Button variant="ghost" className="min-h-11 px-3" onClick={() => openTakeAway(false)}>
          <ArrowLeft weight="bold" /> Volver al Estudio
        </Button>
        <Button variant="primary" className="min-h-11 px-5" onClick={() => window.print()}>
          <Printer weight="bold" /> Imprimir o guardar como PDF
        </Button>
      </div>

      <main className="mx-auto flex max-w-[190mm] flex-col gap-8 px-4 py-8 print:max-w-none print:p-0">
        <header className="flex flex-col gap-1">
          <h1 className="font-display text-3xl leading-tight font-semibold">{design.name}</h1>
          <p className="numerals text-sm">
            {height} × {width} × {depth} mm (alto, ancho, fondo) · Knotty · {today}
          </p>
        </header>

        <section role="note" className="flex gap-3 rounded-xl border-2 border-[#1d1b19] p-4 [break-inside:avoid]">
          <Warning size={24} weight="bold" className="mt-0.5 shrink-0" />
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">Revisa esta hoja antes de cortar</h2>
            <p className="text-[15px] leading-snug">
              Knotty calculó estas medidas a partir de tu diseño, pero no ha visto tu material ni tu espacio. Antes de cortar o de pedir los cortes, compara cada pieza con el diagrama, mide tu material y confirma que el mueble cabe donde va. Si
              algo no cuadra, no cortes: corrige el diseño o enséñale esta hoja a un carpintero.
            </p>
          </div>
        </section>

        {!sheet && <p>Este diseño tiene errores y todavía no se puede sacar su lista de corte. Regresa al Estudio y resuelve los avisos.</p>}

        {sheet && (
          <section className="flex flex-col gap-5">
            <div>
              <h2 className="font-display text-2xl font-semibold">Lista de corte</h2>
              <p className="text-sm">Medidas finales de cada pieza, en mm. El largo va con la veta. El número de cada renglón es el de sus piezas en el diagrama.</p>
            </div>
            {sheet.blocks.map((block) => (
              <div key={block.material.id} className="flex flex-col gap-2">
                <div className="[break-after:avoid]">
                  <h3 className="font-semibold">
                    {block.name} · {block.sheets} {block.sheets === 1 ? 'hoja' : 'hojas'} de {block.material.sheet.width} × {block.material.sheet.length}
                  </h3>
                  <p className="text-sm">Hojas calculadas con: {sheet.saw.toLowerCase()}.</p>
                  {block.unplaced.length > 0 && <p className="text-sm font-medium">No caben en una hoja: {block.unplaced.join(', ')}. Cuentan como hoja aparte.</p>}
                </div>
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b-2 border-[#1d1b19] text-left">
                      <th className="w-10 py-1 font-medium">N.º</th>
                      <th className="py-1 font-medium">Piezas</th>
                      <th className="py-1 font-medium whitespace-nowrap">Largo × ancho</th>
                      <th className="py-1 pl-3 font-medium">Cuántas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {block.lines.map((line) => (
                      <tr key={line.number} className="border-b border-[#1d1b19]/25 align-top [break-inside:avoid]">
                        <td className="py-1.5">
                          <span className="numerals grid size-6 place-items-center rounded-full bg-[#1d1b19] text-xs font-semibold text-white [print-color-adjust:exact]">{line.number}</span>
                        </td>
                        <td className="py-1.5 pr-3">
                          {line.names}
                          {[line.grain, line.banding, line.after].some(Boolean) && <span className="block text-xs">{[line.grain, line.banding, line.after].filter(Boolean).join(' · ')}</span>}
                        </td>
                        <td className="numerals py-1.5 whitespace-nowrap">
                          {line.length} × {line.width}
                          {line.rounded && ' (redondeado)'}
                        </td>
                        <td className="numerals py-1.5 pl-3 whitespace-nowrap">
                          {line.count} {line.count === 1 ? 'pieza' : 'piezas'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </section>
        )}

        {sheet && sheet.blocks.length > 0 && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 print:grid-cols-2">
            <Checklist title="Pídelo en la maderería" lines={sheet.yard} />
            <Checklist title="Lo que vas a ocupar" lines={sheet.tools} />
          </div>
        )}

        {sheet && sheet.blocks.length > 0 && (
          <section className="flex flex-col gap-4 [print-color-adjust:exact] [break-before:page]">
            <div>
              <h2 className="font-display text-2xl font-semibold">Las piezas, separadas</h2>
              <p className="text-sm">Cada pieza lleva el número de su renglón en la lista. Lo que una vista tapa se ve en otra.</p>
            </div>
            <figure className="flex flex-col gap-1 [break-inside:avoid]">
              <figcaption className="text-sm font-medium">{VIEWS.right.name}</figcaption>
              <Drawing diagram={sheet.drawn('right')} label={apartLabel(VIEWS.right.name)} className="max-h-[205mm] w-full" />
            </figure>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 print:grid-cols-2">
              {SMALLER.map((angle) => (
                <figure key={angle} className="flex flex-col gap-1 [break-inside:avoid]">
                  <figcaption className="text-sm font-medium">{VIEWS[angle].name}</figcaption>
                  <Drawing diagram={sheet.drawn(angle)} label={apartLabel(VIEWS[angle].name)} className="max-h-[105mm] w-full" />
                </figure>
              ))}
            </div>
          </section>
        )}
        {sheet && sheet.guide.length > 0 && (
          <section className="flex flex-col gap-6 [print-color-adjust:exact] [break-before:page]">
            <div>
              <h2 className="font-display text-2xl font-semibold">Armado por fases</h2>
              <p className="text-sm">El orden en que se arma. Cada dibujo muestra el mueble hasta esa fase, en claro, y las piezas que entran en ella, marcadas y con su número de la lista: las que llegan de atrás, de abajo o de frente van dibujadas en camino a su lugar.</p>
            </div>
            {sheet.guide.map((phase, i) => (
              <div key={phase.id} className="flex flex-col gap-2 [break-inside:avoid]">
                <h3 className="text-lg font-semibold">
                  {i + 1}. {phase.title}
                </h3>
                <ul className="flex list-disc flex-col gap-1 pl-5 text-[15px] leading-snug">
                  {phase.steps.map((s) => (
                    <li key={s.text}>{s.text}</li>
                  ))}
                </ul>
                {phase.drawings.length > 0 && phase.seenFrom && <p className="text-sm">{VIEWS[phase.seenFrom].name}</p>}
                <div className={phase.drawings.length > 2 ? 'grid grid-cols-1 items-center gap-4 sm:grid-cols-3 print:grid-cols-3' : phase.detailDrawing || phase.drawings.length > 1 ? 'grid grid-cols-1 items-center gap-4 sm:grid-cols-2 print:grid-cols-2' : ''}>
                  {phase.drawings.map((drawing, k) => (
                    <Drawing
                      key={k}
                      diagram={drawing}
                      label={`El mueble en la fase ${i + 1}, ${phase.title.toLowerCase()}${phase.drawings.length > 1 ? `, paso ${k + 1} de ${phase.drawings.length}` : ''}${phase.seenFrom ? ', visto desde atrás' : ''}`}
                      className="max-h-[90mm] w-full"
                      hidden={false}
                    />
                  ))}
                  {phase.detail && phase.detailDrawing && (
                    <figure className="flex flex-col gap-1">
                      <figcaption className="text-sm font-medium">{phase.detail.title}</figcaption>
                      <Drawing diagram={phase.detailDrawing} label={phase.detail.title} className="max-h-[80mm] w-full" />
                    </figure>
                  )}
                </div>
              </div>
            ))}
          </section>
        )}
      </main>
    </div>
  )
}
