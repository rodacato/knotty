import type { ComponentType, ReactNode } from 'react'
import { boardsFor } from '../../domain/materials/catalog'
import { isVisible, type CustomValues, type FieldSpec } from '../../domain/furniture/modules/fields'
import type { FurnitureModule } from '../../domain/furniture/modules/module'
import { useServices } from '../services'
import { Field, Input } from '../system/Field'
import { CabinetColumns } from './CabinetColumns'
import { LockToggle, Segmented, Stepper } from './PlanControls'

// Any plan as a form, drawn from the fields its module lists: no kind of furniture has a form of its own.

/** The components of the fields no generic control can draw. */
const CUSTOM: { [K in keyof CustomValues]: ComponentType<{ label: string; value: CustomValues[K]; onChange: (value: CustomValues[K]) => void }> } = {
  cabinetColumns: CabinetColumns,
}

/** An emptied number shows as empty rather than 0, unless 0 is the minimum. */
const numberText = (value: number, min = 1) => (value || value === min ? value : '')

/** Which fields are locked for «Ahorrar material», and how to lock or free one; without it the form has no locks. */
export interface Locks {
  locked: (field: { key: string; lockedByDefault?: boolean }) => boolean
  toggle: (key: string, locked: boolean) => void
}

function Row({ label, lock, children }: { label: string; lock: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span className="flex items-center gap-1">
        {lock}
        {label}
      </span>
      {children}
    </div>
  )
}

function Control<P>({ field, plan, onChange, locks }: { field: FieldSpec<P>; plan: P; onChange: (plan: P) => void; locks?: Locks }) {
  const { catalog } = useServices()
  if (!isVisible(field, plan)) return null
  const lock = (f: { key: string; label: string; ariaLabel?: string; lockedByDefault?: boolean }) => {
    if (!locks) return null
    const locked = locks.locked(f)
    return <LockToggle locked={locked} name={f.ariaLabel ?? f.label} onToggle={() => locks.toggle(f.key, !locked)} />
  }
  switch (field.type) {
    case 'section':
      return (
        <section className="flex flex-col gap-2">
          <h3 className="font-display text-base font-semibold">{typeof field.title === 'string' ? field.title : field.title(plan)}</h3>
          <Fields fields={field.fields} plan={plan} onChange={onChange} locks={locks} />
        </section>
      )
    case 'note':
      return <p className="text-xs text-graphite">{field.text}</p>
    case 'numbers':
      return (
        <div className={`grid ${field.columns === 3 ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
          <Fields fields={field.fields} plan={plan} onChange={onChange} locks={locks} />
        </div>
      )
    case 'number':
      return (
        <Field
          label={
            <span className="flex items-center gap-1">
              {lock(field)}
              {field.label}
            </span>
          }
        >
          <Input type="number" inputMode="numeric" min={field.min} unit={field.unit} value={numberText(field.get(plan), field.min)} onChange={(e) => onChange(field.set(plan, Number(e.target.value)))} />
        </Field>
      )
    case 'choice':
      return (
        <Row label={field.label} lock={lock(field)}>
          <Segmented label={field.ariaLabel ?? field.label} value={field.get(plan)} options={field.options} onChange={(v) => onChange(field.set(plan, v))} />
        </Row>
      )
    case 'material':
      return (
        <Row label={field.label} lock={lock(field)}>
          <Segmented label={field.ariaLabel ?? field.label} value={field.get(plan)} options={boardsFor(catalog, field.use).map((m) => [m.id, `${m.thickness} mm`])} onChange={(v) => onChange(field.set(plan, v))} />
        </Row>
      )
    case 'stepper':
      return (
        <Row label={field.label} lock={lock(field)}>
          <Stepper label={field.ariaLabel ?? field.label} value={field.get(plan)} min={field.min} max={field.max} onChange={(v) => onChange(field.set(plan, v))} />
        </Row>
      )
    case 'custom': {
      const Custom = CUSTOM[field.component]
      return <Custom label={field.label} value={field.get(plan)} onChange={(v) => onChange(field.set(plan, v))} />
    }
    default:
      return field satisfies never
  }
}

function Fields<P>({ fields, plan, onChange, locks }: { fields: FieldSpec<P>[]; plan: P; onChange: (plan: P) => void; locks?: Locks }) {
  return fields.map((field, i) => <Control key={i} field={field} plan={plan} onChange={onChange} locks={locks} />)
}

/** A plan's form, from its module's fields. */
export function PlanFields<P extends { kind: string }>({ module, plan, onChange, locks }: { module: FurnitureModule<P>; plan: P; onChange: (plan: P) => void; locks?: Locks }) {
  return <Fields fields={module.fields} plan={plan} onChange={onChange} locks={locks} />
}
