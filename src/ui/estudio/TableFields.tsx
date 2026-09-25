import { TABLE_NAMES, type TablePlan } from '../../domain/modules/table'
import { useServicios } from '../servicios'
import { NumberField, Segmented, Stepper } from './PlanControls'

// A table's or desk's ficha: what it is for sets its heights and parts; measures, overhang, shelf and pedestal are choices.

const USE: [TablePlan['use'], string][] = [
  ['dining', 'Comedor'],
  ['coffee', 'Centro'],
  ['side', 'Lateral'],
  ['desk', 'Escritorio'],
]
const PEDESTAL: [TablePlan['pedestal']['side'], string][] = [
  ['none', 'Sin cajonera'],
  ['left', 'Izquierda'],
  ['right', 'Derecha'],
]

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span>{label}</span>
      {children}
    </div>
  )
}

export function TableFields({ draft, set }: { draft: TablePlan; set: (change: Partial<TablePlan>) => void }) {
  const { catalogo } = useServicios()
  const boards = catalogo.materiales.filter((m) => m.tipo === 'triplay')
  const desk = draft.use === 'desk'
  const size = draft.dimensions
  return (
    <>
      <section className="flex flex-col gap-2">
        <h3 className="font-titulo text-base font-semibold">Qué es</h3>
        <Row label="Uso">
          <Segmented label="Uso" value={draft.use} options={USE} onChange={(use) => set({ use: use as TablePlan['use'], name: TABLE_NAMES[use as TablePlan['use']], shelf: use === 'desk' ? false : draft.shelf, pedestal: use === 'desk' ? draft.pedestal : { side: 'none', drawers: 0 } })} />
        </Row>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-titulo text-base font-semibold">Medidas</h3>
        <div className="grid grid-cols-3 gap-2">
          <NumberField label="Alto" suffix="mm" value={size.height} onChange={(height) => set({ dimensions: { ...size, height } })} />
          <NumberField label="Largo" suffix="mm" value={size.width} onChange={(width) => set({ dimensions: { ...size, width } })} />
          <NumberField label="Fondo" suffix="mm" value={size.depth} onChange={(depth) => set({ dimensions: { ...size, depth } })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="La cubierta sobresale" suffix="mm" min={0} value={draft.overhang} onChange={(overhang) => set({ overhang: Math.max(0, overhang) })} />
        </div>
        <Row label="Triplay">
          <Segmented label="Triplay" value={draft.material} options={boards.map((m) => [m.id, `${m.espesor} mm`])} onChange={(material) => set({ material })} />
        </Row>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-titulo text-base font-semibold">{desk ? 'Cajonera' : 'Abajo'}</h3>
        {desk ? (
          <>
            <Row label="Lado">
              <Segmented label="Lado de la cajonera" value={draft.pedestal.side} options={PEDESTAL} onChange={(side) => set({ pedestal: { side: side as TablePlan['pedestal']['side'], drawers: side === 'none' ? 0 : Math.max(1, draft.pedestal.drawers) } })} />
            </Row>
            {draft.pedestal.side !== 'none' && (
              <Row label="Cajones">
                <Stepper label="cajones de la cajonera" value={draft.pedestal.drawers} min={1} max={4} onChange={(drawers) => set({ pedestal: { ...draft.pedestal, drawers } })} />
              </Row>
            )}
          </>
        ) : (
          <Row label="Repisa baja">
            <Segmented label="Repisa baja" value={draft.shelf ? 'yes' : 'no'} options={[['yes', 'Sí'], ['no', 'No']]} onChange={(v) => set({ shelf: v === 'yes' })} />
          </Row>
        )}
      </section>
    </>
  )
}
