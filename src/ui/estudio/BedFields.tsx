import type { BedPlan } from '../../domain/modules/bed'
import { useServicios } from '../servicios'
import { NumberField, Segmented, Stepper } from './PlanControls'

// A bed's ficha: the mattress sets its size; the base, its drawers and the headboard are choices.

const MATTRESS: [BedPlan['mattress'], string][] = [
  ['individual', 'Individual'],
  ['matrimonial', 'Matrimonial'],
  ['queen', 'Queen'],
  ['king', 'King'],
]
const SIDE: [BedPlan['drawers']['side'], string][] = [
  ['none', 'Sin cajones'],
  ['left', 'Izquierda'],
  ['right', 'Derecha'],
  ['both', 'Los dos'],
]
const POSITION: [BedPlan['drawers']['position'], string][] = [
  ['head', 'Cabecera'],
  ['center', 'Centro'],
  ['foot', 'Pie'],
]
const STYLE: [BedPlan['headboard']['style'], string][] = [
  ['none', 'Sin cabecera'],
  ['plain', 'Lisa'],
  ['bookcase', 'Librero'],
  ['storage', 'Compartimento'],
]

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span>{label}</span>
      {children}
    </div>
  )
}

export function BedFields({ draft, set }: { draft: BedPlan; set: (change: Partial<BedPlan>) => void }) {
  const { catalogo } = useServicios()
  const boards = catalogo.materiales.filter((m) => m.tipo === 'triplay')
  const drawers = draft.drawers
  const headboard = draft.headboard
  const deep = headboard.style === 'bookcase' || headboard.style === 'storage'
  return (
    <>
      <section className="flex flex-col gap-2">
        <h3 className="font-titulo text-base font-semibold">Colchón y base</h3>
        <Row label="Colchón">
          <Segmented label="Colchón" value={draft.mattress} options={MATTRESS} onChange={(mattress) => set({ mattress: mattress as BedPlan['mattress'] })} />
        </Row>
        <p className="text-xs text-grafito-2">El largo y el ancho de la cama salen del colchón, con 2 cm de holgura para meterlo y sacarlo.</p>
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Alto de la base" suffix="mm" value={draft.height} onChange={(height) => set({ height })} />
        </div>
        <Row label="Triplay">
          <Segmented label="Triplay" value={draft.material} options={boards.map((m) => [m.id, `${m.espesor} mm`])} onChange={(material) => set({ material })} />
        </Row>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-titulo text-base font-semibold">Cajones</h3>
        <p className="text-xs text-grafito-2">Los lados se ven desde el pie de la cama.</p>
        <Row label="Lado">
          <Segmented label="Lado de los cajones" value={drawers.side} options={SIDE} onChange={(side) => set({ drawers: { ...drawers, side: side as BedPlan['drawers']['side'] } })} />
        </Row>
        {drawers.side !== 'none' && (
          <>
            <Row label="Por lado">
              <Stepper label="cajones por lado" value={drawers.count} min={1} max={4} onChange={(count) => set({ drawers: { ...drawers, count } })} />
            </Row>
            <Row label="Se juntan hacia">
              <Segmented label="Hacia dónde se juntan" value={drawers.position} options={POSITION} onChange={(position) => set({ drawers: { ...drawers, position: position as BedPlan['drawers']['position'] } })} />
            </Row>
          </>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-titulo text-base font-semibold">Cabecera</h3>
        <Row label="Tipo">
          <Segmented label="Tipo de cabecera" value={headboard.style} options={STYLE} onChange={(style) => set({ headboard: { ...headboard, style: style as BedPlan['headboard']['style'] } })} />
        </Row>
        {headboard.style === 'storage' && <p className="text-xs text-grafito-2">Un espacio cerrado a la altura de la almohada y repisas arriba.</p>}
        {headboard.style !== 'none' && (
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Alto desde el piso" suffix="mm" value={headboard.height} onChange={(height) => set({ headboard: { ...headboard, height } })} />
            {deep && <NumberField label="Fondo" suffix="mm" value={headboard.depth} onChange={(depth) => set({ headboard: { ...headboard, depth } })} />}
          </div>
        )}
        {deep && (
          <Row label="Repisas">
            <Stepper label="repisas de la cabecera" value={headboard.shelves} min={0} max={4} onChange={(shelves) => set({ headboard: { ...headboard, shelves } })} />
          </Row>
        )}
      </section>
    </>
  )
}
