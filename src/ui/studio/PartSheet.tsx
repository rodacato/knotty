import { ArrowRight, X } from '@phosphor-icons/react'
import type { Design } from '../../domain/design/schema'
import type { DesignState } from '../../domain/session/state'
import { FinishSection } from './FinishSection'
import { CABINET_LABELS, type CabinetPlan } from '../../domain/furniture/modules/cabinet'
import { CABINET_PARTS, type CabinetPart } from '../../domain/furniture/modules/cabinetParts'
import type { FieldSpec } from '../../domain/furniture/modules/fields'
import { moduleOf } from '../../domain/furniture/modules/plan'
import { Button } from '../system/components'
import { useStore } from '../store'
import { JointsSection } from './Joints'
import { PlanFields } from './PlanFields'
import { Segmented, Stepper } from './PlanControls'

// A part of the cabinet opened from the closed furniture (UI-39): its choices go to the plan's draft, its joints change at once.

/** The form's fields that belong to the part, keeping a group of measures whole so it keeps its rule for showing. */
function fieldsOf(fields: FieldSpec<CabinetPlan>[], keys: string[]): FieldSpec<CabinetPlan>[] {
  return fields.flatMap((f): FieldSpec<CabinetPlan>[] => {
    if (f.type === 'section') return fieldsOf(f.fields as FieldSpec<CabinetPlan>[], keys)
    if (f.type === 'numbers') return f.fields.some((n) => keys.includes(n.key)) ? [f] : []
    return 'key' in f && keys.includes(f.key) ? [f] : []
  })
}

/** On screen the top's place and its corners are two choices (UI-69); the plan still keeps them in one. */
function TopChoices({ plan }: { plan: CabinetPlan }) {
  const editPlan = useStore((s) => s.editPlan)
  const top = plan.construction.top
  const set = (value: CabinetPlan['construction']['top']) => editPlan({ ...plan, construction: { ...plan.construction, top: value } })
  const { options } = CABINET_LABELS.construction.top
  return (
    <>
      <div className="flex flex-col gap-2">
        <span className="text-sm text-graphite-2">Techo</span>
        <Segmented label="Techo" value={top === 'fingers' ? 'over' : top} options={[['between', options.between], ['over', options.over]]} onChange={(v) => set(v as 'between' | 'over')} />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm text-graphite-2">Esquinas del techo</span>
        <Segmented label="Esquinas del techo" value={top === 'fingers' ? 'fingers' : 'joint'} options={[['joint', 'Con la unión del casco'], ['fingers', 'De dedos']]} onChange={(v) => set(v === 'fingers' ? 'fingers' : 'over')} />
        {top === 'fingers' && (
          <>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-graphite-2">Dedos por esquina</span>
              <Stepper label="dedos por esquina" value={plan.drawerFingers ?? 5} min={3} max={9} onChange={(drawerFingers) => editPlan({ ...plan, drawerFingers })} />
            </div>
            <p className="text-xs text-graphite-2">Con dedos, las dos tablas llegan a la esquina y el techo va encima de los costados. Los cajones de dedos usan el mismo número.</p>
          </>
        )}
      </div>
    </>
  )
}

export function PartSheet({ state, plan, design, part }: { state: DesignState; plan: CabinetPlan; design: Design; part: { id: CabinetPart; piece: string | null } }) {
  const editPlan = useStore((s) => s.editPlan)
  const selectPart = useStore((s) => s.selectPart)
  const select = useStore((s) => s.select)
  const spec = CABINET_PARTS[part.id]
  const module = moduleOf(plan)
  const keys = part.id === 'body' ? spec.fields.filter((k) => k !== 'construction.top') : spec.fields
  const fields = fieldsOf(module.fields as FieldSpec<CabinetPlan>[], keys)
  const piece = part.piece ? design.pieces.find((p) => p.id === part.piece) : undefined
  return (
    <section className="flex h-full min-h-0 flex-col" aria-label={spec.name}>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg leading-tight font-semibold">{spec.name}</h2>
            {piece && <p className="text-sm text-graphite-2">Tocaste {piece.name.toLowerCase()}</p>}
          </div>
          {piece && (
            <Button
              variant="ghost"
              className="min-h-11 shrink-0 px-3"
              onClick={() => {
                selectPart(null)
                select(piece.id)
              }}
            >
              Esta pieza <ArrowRight />
            </Button>
          )}
          <button type="button" onClick={() => selectPart(null)} aria-label="Cerrar" className="relative grid size-9 shrink-0 place-items-center rounded-full text-graphite-2 before:absolute before:-inset-1 before:content-[''] hover:bg-kraft">
            <X />
          </button>
        </div>
        {part.id === 'body' && <TopChoices plan={plan} />}
        <PlanFields module={{ ...module, fields }} plan={plan} onChange={(next) => editPlan(next)} />
        {part.id === 'wood' && <FinishSection state={state} />}
        {part.id === 'cells' && <p className="text-sm text-graphite-2">Toca un hueco del mueble para cambiar lo que lleva, dividirlo o juntarlo; arrastra los puntos de las líneas para moverlas.</p>}
        {spec.joints.length > 0 && <JointsSection design={design} only={spec.joints} />}
      </div>
    </section>
  )
}
