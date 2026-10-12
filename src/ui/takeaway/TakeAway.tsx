import { RepairConstruction } from './RepairConstruction'
import { manufacturingProblems } from '../../domain/design/manufacturing'
import { badgePositions } from './badges'
import './workshop.css'
import { EXPORT_MODES, exportIdentity, type ExportMode } from './exportIdentity'
import { phaseCheck } from './phaseChecks'
import { FitDetails, JointDetails, MachiningDetails, SheetDetails, ShoppingDetails } from './WorkshopDetails'
import { installationLabel } from '../../domain/design/installation'
import { reviewSignature } from '../../application/useCases/review'
import { ArrowLeft, Printer, Warning } from '@phosphor-icons/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { analyze } from '../../domain/checks/analysis'
import { counterLines } from '../../domain/estimate/counterList'
import { estimatePurchase } from '../../domain/estimate/purchase'
import { atTheYard, toolsFor, type Advice } from '../../domain/estimate/workshop'
import { outline } from '../../domain/design/slants'
import { applySettings } from '../../domain/materials/catalog'
import type { Way } from '../../domain/furniture/modules/guide'
import { currentDesign, type DesignState } from '../../domain/session/state'
import { assemblyPhases } from './assemblyPhases'
import { useServices } from '../services'
import { useStore } from '../store'
import { Button } from '../system/components'
import type { Offset } from '../scene/explode'
import { wordsIn } from './words'
import { drawDiagram, spreadApart, VIEWS, type Angle, type Diagram, type Shape } from './diagram'
import { reviewNotes } from './reviewNotes'
import { BeforeLeaving } from '../studio/CopyList'
import { isDrawerPart } from '../../domain/design/schema'
import { finishCare, finishOf } from '../../domain/materials/finishes'

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

function Drawing({ diagram, label, className }: { diagram: Diagram; label: string; className: string }) {
  const radius = diagram.dot
  const focused = diagram.pieces.some((p) => p.marked)
  // One visible example of each cut-list row; labels on covered faces are omitted.
  const numbers = diagram.pieces
    .filter((p) => p.number !== null && p.seen)
    .filter((p, i, all) => !all.slice(0, i).some((q) => q.number === p.number))
  const positions = badgePositions(numbers.map((p) => p.badge), radius, diagram.width, diagram.height)
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
      {numbers.map((p, i) => (
        <g key={p.id}>
          <line x1={p.badge[0]} y1={p.badge[1]} x2={positions[i][0]} y2={positions[i][1]} stroke={INK} strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <circle cx={positions[i][0]} cy={positions[i][1]} r={radius} fill={INK} />
          <text x={positions[i][0]} y={positions[i][1]} fill="#ffffff" fontSize={radius * 1.15} fontWeight={600} textAnchor="middle" dominantBaseline="central">
            {p.number}
          </text>
        </g>
      ))}
    </svg>
  )
}

function Checklist({ title, lines }: { title: string; lines: Advice[] }) {
  return (
    <section className="flex flex-col gap-2 [break-inside:avoid]">
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
  const notes = reviewNotes(state, applySettings(catalog, settings))
  const sheet = useMemo(() => {
    const effective = applySettings(catalog, settings)
    const analysis = analyze(design, effective)
    if (!analysis.valid) return null
    const purchase = estimatePurchase(design, analysis.geo, effective)
    const blocks = counterLines(design, analysis.geo, purchase)
    const numbers = new Map(blocks.flatMap((b) => b.lines.flatMap((l) => l.ids.map((id) => [id, l.number] as const))))
    const apart = spreadApart(analysis.geo.boxes, SPREAD)
    const { trim, kerf } = effective.layout
    const phases = assemblyPhases(state)
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
    const [yard, tools] = [atTheYard(design), toolsFor(design)]
    const words = wordsIn([...blocks.flatMap((b) => b.lines.flatMap((l) => [l.names, l.banding ?? '', l.after ?? ''])), ...guide.flatMap((p) => [p.title, ...p.steps.map((s) => s.text)]), ...[...yard, ...tools].map((a) => a.text)])
    return { purchase, geo: analysis.geo, numbers, effective, guide, yard, tools, words, blocks, care: finishCare(finishOf(design)), saw: `${trim > 0 ? `Refilado de ${trim} mm por orilla` : 'Sin refilar'} · disco de ${kerf} mm`, drawn: (angle: Angle) => drawDiagram(analysis.geo.boxes, apart, numbers, angle, { shapes }) }
  }, [catalog, settings, design, state])
  const { height, width, depth } = design.dimensions
  const [date] = useState(() => new Date())
  const [mode, setMode] = useState<ExportMode>('complete')
  const today = date.toLocaleDateString('es-MX')
  const identity = exportIdentity(state, mode, date)
  const reviewed = state.review?.signature === reviewSignature(state, applySettings(catalog, settings))
  const status = reviewed ? state.review!.verdict : 'unreviewed'
  const constructionProblems = sheet ? manufacturingProblems(design, sheet.geo) : []
  const statusLabel = status === 'not-viable' ? 'NO CONSTRUIR · diseño no viable'
    : constructionProblems.length || status === 'needs-changes' ? 'CORREGIR ANTES DE CORTAR'
    : status === 'viable' ? (notes.length === 0 ? 'Revisión vigente · sin pendientes registrados' : 'Revisión vigente · pendientes de taller')
    : 'REVISIÓN PENDIENTE'
  const hasPhases = !!sheet?.guide.length
  const forYard = mode !== 'assembly'
  const forAssembly = mode !== 'yard'
  const toolbarRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const toolbar = toolbarRef.current
    if (!toolbar) return
    const update = () => toolbar.parentElement?.style.setProperty('--export-scroll-margin', `${toolbar.getBoundingClientRect().height + 16}px`)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(toolbar)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    const previous = document.title
    document.title = identity.file
    return () => { document.title = previous }
  }, [identity.file])

  return (
    <div className="workshop-document min-h-dvh bg-white text-[#1d1b19]">
      <div ref={toolbarRef} className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-bone/90 px-4 py-2 text-graphite backdrop-blur print:hidden">
        <Button variant="ghost" className="min-h-11 px-3" onClick={() => openTakeAway(false)}>
          <ArrowLeft weight="bold" /> Volver al Estudio
        </Button>
        <label className="flex items-center gap-2 text-sm">Contenido
          <select aria-label="Contenido del PDF" value={mode} onChange={(event) => setMode(event.target.value as ExportMode)} className="min-h-11 rounded-md border border-line bg-paper px-3 text-graphite">
            {(Object.entries(EXPORT_MODES) as [ExportMode, string][]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <Button variant="primary" className="min-h-11 max-w-full px-5" onClick={() => window.print()}>
          <Printer weight="bold" /> Imprimir o guardar como PDF
        </Button>
      </div>

      <main className="mx-auto flex max-w-[190mm] flex-col gap-8 px-4 py-8 print:max-w-none print:p-0">
        <header id="origin" className="flex flex-col gap-1">
          <p className="export-kind">Knotty · {EXPORT_MODES[mode]}</p>
          <h1 className="font-display text-3xl leading-tight font-semibold">{design.name}</h1>
          <p className="numerals text-sm">
            {height} × {width} × {depth} mm (alto, ancho, fondo) · Knotty · {today}
          </p>
          <p className="text-sm">Diseño actual · versión {state.current} · {installationLabel(design)}</p>
          <p className="export-status">{statusLabel}</p>
          <h2 className="mt-3 font-semibold">Origen y versión</h2>
          <p className="text-sm">{identity.origin}. Esta guía describe la versión actual, que puede incluir cambios respecto a la ficha de origen.</p>
          <p className="export-filename">Nombre sugerido: {identity.file}.pdf</p>
        </header>

        {sheet && <nav aria-label="Índice de la guía" className="export-index" onClick={(event) => {
          const link = (event.target as HTMLElement).closest('a[href^="#"]')
          const target = link?.getAttribute('href')?.slice(1)
          if (!target) return
          event.preventDefault()
          document.getElementById(target)?.scrollIntoView({ block: 'start' })
        }}>
          <a href="#origin">Origen</a>
          {forYard && <><a href="#cuts">Lista de corte</a><a href="#purchase">Compra</a><a href="#layout">Hojas</a></>}
          {mode === 'assembly' && <a href="#cuts">Piezas</a>}
          <a href="#machining">Mecanizado</a>
          {forAssembly && <><a href="#exploded">Despiece</a><a href="#joints">Uniones</a><a href="#fit">Ajustes e instalación</a>{hasPhases && <a href="#assembly">Armado</a>}</>}
        </nav>}

        {notes.length > 0 && (
          <section role="note" className="flex flex-col gap-2 rounded-xl border-2 border-[#1d1b19] p-4 [break-inside:avoid]">
            <h2 className="text-lg font-semibold">Pendientes de esta guía</h2>
            <ul className="flex list-disc flex-col gap-2 pl-5 text-[15px] leading-snug">{notes.map((note) => <li key={note}>{note}</li>)}</ul>
          </section>
        )}
        {constructionProblems.length > 0 && <RepairConstruction state={state} />}
        {sheet && sheet.guide.length === 0 && (
          <p role="note" className="text-[15px] leading-snug">Este diseño no tiene instrucciones de armado por fases. La guía incluye la lista de corte y los diagramas de las piezas.</p>
        )}
        {sheet && sheet.care.length > 0 && (
          <section role="note" className="flex flex-col gap-2 [break-inside:avoid]">
            <h2 className="text-lg font-semibold">Cuidados del acabado</h2>
            {sheet.care.map((line) => <p key={line.text} className="text-[15px] leading-snug">{line.text}</p>)}
          </section>
        )}

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
          <section id="cuts" className="flex flex-col gap-5 workshop-section">
            <div className="section-intro">
              <h2 className="font-display text-2xl font-semibold">{mode === 'assembly' ? 'Identifica tus piezas' : 'Lista de corte'}</h2>
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
                          <span className="piece-ids block">{line.ids.join(', ')}</span>
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
            {forYard && <Checklist title="Pídelo en la maderería" lines={sheet.yard} />}
            <Checklist title="Lo que vas a ocupar" lines={sheet.tools} />
            {forYard && <BeforeLeaving hasDrawer={design.pieces.some(isDrawerPart)} />}
          </div>
        )}

        {sheet && forYard && <><ShoppingDetails purchase={sheet.purchase} /><SheetDetails purchase={sheet.purchase} numbers={sheet.numbers} trim={sheet.effective.layout.trim} /></>}
        {sheet && <MachiningDetails design={design} geo={sheet.geo} numbers={sheet.numbers} />}
        {sheet && forAssembly && sheet.blocks.length > 0 && (
          <section id="exploded" className="flex flex-col gap-4 workshop-section [print-color-adjust:exact]">
            <div className="section-intro">
              <h2 className="font-display text-2xl font-semibold">Las piezas, separadas</h2>
              <p className="text-sm">Cada pieza lleva el número de su renglón en la lista. El número identifica un grupo de la lista; se marca un ejemplo visible por vista. Los identificadores individuales aparecen en mecanizado y uniones.</p>
            </div>
            <figure className="exploded-primary flex flex-col gap-1 [break-inside:avoid]">
              <figcaption className="text-sm font-medium">{VIEWS.right.name}</figcaption>
              <Drawing diagram={sheet.drawn('right')} label={apartLabel(VIEWS.right.name)} className="max-h-[110mm] w-full" />
            </figure>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 print:grid-cols-2">
              {SMALLER.map((angle) => (
                <figure key={angle} className="flex flex-col gap-1 [break-inside:avoid]">
                  <figcaption className="text-sm font-medium">{VIEWS[angle].name}</figcaption>
                  <Drawing diagram={sheet.drawn(angle)} label={apartLabel(VIEWS[angle].name)} className="max-h-[65mm] w-full" />
                </figure>
              ))}
            </div>
          </section>
        )}
        {sheet && forAssembly && <><JointDetails design={design} geo={sheet.geo} catalog={sheet.effective} numbers={sheet.numbers} /><FitDetails design={design} geo={sheet.geo} purchase={sheet.purchase} /></>}
        {sheet && forAssembly && sheet.guide.length > 0 && (
          <section id="assembly" className="flex flex-col gap-6 workshop-section [print-color-adjust:exact]">
            <div className="section-intro">
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
                <p className="phase-check"><strong>Comprueba antes de seguir:</strong> {phaseCheck(phase.id, design)}</p>
                {phase.drawings.length > 0 && phase.seenFrom && <p className="text-sm">{VIEWS[phase.seenFrom].name}</p>}
                <div className={phase.drawings.length > 2 ? 'grid grid-cols-1 items-center gap-4 sm:grid-cols-3 print:grid-cols-3' : phase.detailDrawing || phase.drawings.length > 1 ? 'grid grid-cols-1 items-center gap-4 sm:grid-cols-2 print:grid-cols-2' : ''}>
                  {phase.drawings.map((drawing, k) => (
                    <Drawing
                      key={k}
                      diagram={drawing}
                      label={`El mueble en la fase ${i + 1}, ${phase.title.toLowerCase()}${phase.drawings.length > 1 ? `, paso ${k + 1} de ${phase.drawings.length}` : ''}${phase.seenFrom ? ', visto desde atrás' : ''}`}
                      className="max-h-[70mm] w-full"
                    />
                  ))}
                  {phase.detail && phase.detailDrawing && (
                    <figure className="flex flex-col gap-1">
                      <figcaption className="text-sm font-medium">{phase.detail.title}</figcaption>
                      <Drawing diagram={phase.detailDrawing} label={phase.detail.title} className="max-h-[65mm] w-full" />
                    </figure>
                  )}
                </div>
              </div>
            ))}
          </section>
        )}
        {sheet && sheet.words.length > 0 && (
          <section className="flex flex-col gap-2 [break-inside:avoid]">
            <h2 className="font-display text-2xl font-semibold">Palabras de esta hoja</h2>
            <dl className="flex flex-col gap-1 text-[15px] leading-snug">
              {sheet.words.map((term) => (
                <div key={term.name}>
                  <dt className="inline font-semibold">{term.name}: </dt>
                  <dd className="inline">
                    {term.meaning}
                    {term.note ? ` ${term.note}` : ''}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}
        <style>{`@media print { @page { @bottom-left { content: ${JSON.stringify(`${state.ficha?.code ?? design.name.slice(0, 40)} · diseño v${state.current} · ${today}`)}; } } }`}</style>
        <footer className="export-footer">{design.name} · {state.ficha?.code ?? 'Diseño propio'} · diseño v{state.current} · {today} · medidas en mm · dibujos sin escala</footer>
      </main>
    </div>
  )
}
