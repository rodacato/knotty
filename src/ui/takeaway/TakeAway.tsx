import { ArrowLeft, Printer, Warning } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { analyze } from '../../domain/checks/analysis'
import { counterLines } from '../../domain/estimate/counterList'
import { estimatePurchase } from '../../domain/estimate/purchase'
import { applySettings } from '../../domain/materials/catalog'
import { currentDesign, type DesignState } from '../../domain/session/state'
import { useServices } from '../services'
import { useStore } from '../store'
import { Button } from '../system/components'
import { drawDiagram, spreadApart, VIEWS, type Angle, type Diagram } from './diagram'

const INK = '#1d1b19'
const SHADES = { side: '#d9d2c7', front: '#efebe4', up: '#ffffff' }
/** How far from the middle each piece is drawn, against where it really goes. */
const SPREAD = 1.6
const SMALLER: Angle[] = ['left', 'back', 'front', 'top']

function Drawing({ diagram, name, className }: { diagram: Diagram; name: string; className: string }) {
  const radius = Math.max(diagram.width, diagram.height) / 52
  return (
    <svg viewBox={`0 0 ${diagram.width} ${diagram.height}`} className={className} role="img" aria-label={`Las piezas separadas, ${name.toLowerCase()}, cada una con el número de su renglón`}>
      {diagram.pieces.map((p) => (
        <g key={p.id}>
          {p.faces.map((face, i) => (
            <polygon key={i} points={face.points} fill={SHADES[face.looks]} stroke={INK} strokeWidth={1} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          ))}
          {p.number !== null && (
            <>
              <circle cx={p.badge[0]} cy={p.badge[1]} r={radius} fill={INK} />
              <text x={p.badge[0]} y={p.badge[1]} fill="#ffffff" fontSize={radius * 1.15} fontWeight={600} textAnchor="middle" dominantBaseline="central">
                {p.number}
              </text>
            </>
          )}
        </g>
      ))}
    </svg>
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
    return { blocks, saw: `${trim > 0 ? `Refilado de ${trim} mm por orilla` : 'Sin refilar'} · disco de ${kerf} mm`, drawn: (angle: Angle) => drawDiagram(analysis.geo.boxes, apart, numbers, angle) }
  }, [catalog, settings, design])
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
          <section className="flex flex-col gap-4 [print-color-adjust:exact] [break-before:page]">
            <div>
              <h2 className="font-display text-2xl font-semibold">Las piezas, separadas</h2>
              <p className="text-sm">Cada pieza lleva el número de su renglón en la lista. Lo que una vista tapa se ve en otra. Una pieza inclinada o redondeada se dibuja como su rectángulo.</p>
            </div>
            <figure className="flex flex-col gap-1 [break-inside:avoid]">
              <figcaption className="text-sm font-medium">{VIEWS.right.name}</figcaption>
              <Drawing diagram={sheet.drawn('right')} name={VIEWS.right.name} className="max-h-[205mm] w-full" />
            </figure>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 print:grid-cols-2">
              {SMALLER.map((angle) => (
                <figure key={angle} className="flex flex-col gap-1 [break-inside:avoid]">
                  <figcaption className="text-sm font-medium">{VIEWS[angle].name}</figcaption>
                  <Drawing diagram={sheet.drawn(angle)} name={VIEWS[angle].name} className="max-h-[105mm] w-full" />
                </figure>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
