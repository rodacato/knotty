import type { ComponentType, ReactNode } from 'react'
import { boardsFor } from '../../domain/materials/catalog'
import { isVisible, type CustomValues, type FieldSpec } from '../../domain/modules/fields'
import type { FurnitureModule } from '../../domain/modules/module'
import { useServices } from '../services'
import { CabinetColumns } from './CabinetColumns'
import { NumberField, Segmented, Stepper } from './PlanControls'

// Any plan as a form, drawn from the fields its module lists: no kind of furniture has a form of its own.

/** The components of the fields no generic control can draw. */
const CUSTOM: { [K in keyof CustomValues]: ComponentType<{ label: string; value: CustomValues[K]; onChange: (value: CustomValues[K]) => void }> } = {
  cabinetColumns: CabinetColumns,
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span>{label}</span>
      {children}
    </div>
  )
}

function Field<P>({ field, plan, onChange }: { field: FieldSpec<P>; plan: P; onChange: (plan: P) => void }) {
  const { catalog } = useServices()
  if (!isVisible(field, plan)) return null
  switch (field.type) {
    case 'section':
      return (
        <section className="flex flex-col gap-2">
          <h3 className="font-display text-base font-semibold">{typeof field.title === 'string' ? field.title : field.title(plan)}</h3>
          <Fields fields={field.fields} plan={plan} onChange={onChange} />
        </section>
      )
    case 'note':
      return <p className="text-xs text-graphite-2">{field.text}</p>
    case 'numbers':
      return (
        <div className={`grid ${field.columns === 3 ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
          <Fields fields={field.fields} plan={plan} onChange={onChange} />
        </div>
      )
    case 'number':
      return <NumberField label={field.label} suffix={field.unit} min={field.min} value={field.get(plan)} onChange={(v) => onChange(field.set(plan, v))} />
    case 'choice':
      return (
        <Row label={field.label}>
          <Segmented label={field.ariaLabel ?? field.label} value={field.get(plan)} options={field.options} onChange={(v) => onChange(field.set(plan, v))} />
        </Row>
      )
    case 'material':
      return (
        <Row label={field.label}>
          <Segmented label={field.ariaLabel ?? field.label} value={field.get(plan)} options={boardsFor(catalog, field.use).map((m) => [m.id, `${m.thickness} mm`])} onChange={(v) => onChange(field.set(plan, v))} />
        </Row>
      )
    case 'stepper':
      return (
        <Row label={field.label}>
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

function Fields<P>({ fields, plan, onChange }: { fields: FieldSpec<P>[]; plan: P; onChange: (plan: P) => void }) {
  return fields.map((field, i) => <Field key={i} field={field} plan={plan} onChange={onChange} />)
}

/** A plan's form, from its module's fields. */
export function PlanFields<P extends { kind: string }>({ module, plan, onChange }: { module: FurnitureModule<P>; plan: P; onChange: (plan: P) => void }) {
  return <Fields fields={module.fields} plan={plan} onChange={onChange} />
}
