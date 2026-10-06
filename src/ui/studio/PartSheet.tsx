import { ArrowRight } from '@phosphor-icons/react'
import type { Design } from '../../domain/design/schema'
import type { DesignState } from '../../domain/session/state'
import { FinishSection } from './FinishSection'
import { FittingsSection } from './Fittings'
import { CABINET_LABELS, type CabinetPlan } from '../../domain/furniture/modules/cabinet'
import type { FieldSpec } from '../../domain/furniture/modules/fields'
import { partName, type PartSpec } from '../../domain/furniture/modules/parts'
import { moduleOf, type FurniturePlan } from '../../domain/furniture/modules/plan'
import { Button } from '../system/components'
import { useStore } from '../store'
import { JointsSection } from './Joints'
import { PlanFields } from './PlanFields'
import { Segmented, Stepper } from './PlanControls'

// A part of the furniture, opened from the list or by touching it (UI-39): its choices go to the plan's draft, its joints change at once.

/** The form's fields that belong to the part, keeping a group of measures whole so it keeps its rule for showing. */
function fieldsOf<P>(fields: FieldSpec<P>[], keys: string[]): FieldSpec<P>[] {
  return fields.flatMap((f): FieldSpec<P>[] => {
    if (f.type === 'section') return fieldsOf(f.fields as FieldSpec<P>[], keys)
    if (f.type === 'numbers') return f.fields.some((n) => keys.includes(n.key)) ? [f] : []
    if (f.type === 'note') return f.about && keys.includes(f.about) ? [f] : []
    return 'key' in f && keys.includes(f.key) ? [f] : []
  })
}

const flatFields = <P,>(fields: FieldSpec<P>[]): { key: string; label: string }[] =>
  fields.flatMap((f) => (f.type === 'section' || f.type === 'numbers' ? flatFields(f.fields as FieldSpec<P>[]) : 'key' in f && 'label' in f ? [{ key: f.key, label: f.label }] : []))

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

export function PartSheet({ state, plan, design, part }: { state: DesignState; plan: FurniturePlan; design: Design; part: { id: string; piece: string | null } }) {
  const editPlan = useStore((s) => s.editPlan)
  const select = useStore((s) => s.select)
  const module = moduleOf(plan)
  const spec = (module.parts.list as PartSpec<FurniturePlan>[]).find((p) => p.id === part.id)
  if (!spec) return null
  // A cabinet's top is two choices on screen (UI-69), so its field is drawn apart.
  const cabinetTop = plan.kind === 'cabinet' && part.id === 'body'
  const keys = cabinetTop ? spec.fields.filter((k) => k !== 'construction.top') : spec.fields
  const fields = fieldsOf(module.fields as FieldSpec<FurniturePlan>[], [...keys, ...(spec.alsoShows ?? [])])
  // A field this part shares with another (a cabinet's pulls, for doors and drawers) says so.
  const sharedKeys = new Set([...(spec.alsoShows ?? []), ...module.parts.list.filter((p) => p.id !== spec.id).flatMap((p) => p.alsoShows ?? []).filter((k) => spec.fields.includes(k))])
  const shared = flatFields(fields).filter((f) => sharedKeys.has(f.key)).map((f) => `«${f.label}»`)
  const piece = part.piece ? design.pieces.find((p) => p.id === part.piece) : undefined
  return (
    <section className="flex h-full min-h-0 flex-col" aria-label={partName(spec, plan)}>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg leading-tight font-semibold">{partName(spec, plan)}</h2>
            {piece && <p className="text-sm text-graphite-2">Tocaste {piece.name.toLowerCase()}</p>}
          </div>
          {piece && (
            <Button
              variant="ghost"
              className="min-h-11 shrink-0 px-3"
              onClick={() => select(piece.id)}
            >
              Esta pieza <ArrowRight />
            </Button>
          )}
        </div>
        {cabinetTop && <TopChoices plan={plan as CabinetPlan} />}
        <PlanFields module={{ ...module, fields } as typeof module} plan={plan} onChange={(next) => editPlan(next)} />
        {part.id === 'wood' && <FinishSection state={state} />}
        {part.id === 'assembly' && <FittingsSection design={design} />}
        {plan.kind === 'cabinet' && part.id === 'cells' && <p className="text-sm text-graphite-2">Toca un hueco del mueble para cambiar lo que lleva, dividirlo o juntarlo; arrastra los puntos de las líneas para moverlas.</p>}
        {shared.length > 0 && <p className="-mt-2 text-xs text-graphite-2">{shared.join(' y ')} {shared.length === 1 ? 'vale' : 'valen'} para todo el mueble: {spec.id === 'doors' ? 'cambian también los cajones' : 'cambian también las puertas'}.</p>}
        {spec.joints.length > 0 && <JointsSection design={design} only={spec.joints} title={spec.jointsTitle} />}
      </div>
    </section>
  )
}
