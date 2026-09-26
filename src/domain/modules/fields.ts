import type { BoardUse } from '../materials/catalog'
import type { Column } from '../reading/reading'

// A plan's form as data: each module lists its fields and the studio draws them, so a new kind of furniture needs no form of its own.
// Every field reads and writes the plan through a typed get/set pair; set gives back the same plan when the value does not change.

/** A button of a choice: the value it stores and the words on it. */
export type Option = readonly [value: string, text: string]

interface Shown<P> {
  /** Hidden while this is false; always shown without it. */
  visibleWhen?: (plan: P) => boolean
}

interface Edits<P, V> {
  get: (plan: P) => V
  set: (plan: P, value: V) => P
}

interface Named {
  /** Stable id of the field, for tests and lists: never used to reach into the plan. */
  key: string
  /** The words beside the control. */
  label: string
  /** What a screen reader calls the control, when the label alone is not enough ("Lado" → "Lado de los cajones"). */
  ariaLabel?: string
}

/** Segmented buttons, one per option. */
export interface ChoiceField<P> extends Shown<P>, Edits<P, string>, Named {
  type: 'choice'
  options: readonly Option[]
  /** How each value reads inside a sentence ("sin zoclo"), when its labels say it: the chat understands a request by these words. */
  phrases?: Readonly<Record<string, string>>
}

/** The catalog's boards for one use, by thickness. */
export interface MaterialField<P> extends Shown<P>, Edits<P, string>, Named {
  type: 'material'
  use: BoardUse
}

/** A small count with − and +. */
export interface StepperField<P> extends Shown<P>, Edits<P, number>, Named {
  type: 'stepper'
  min: number
  max: number
}

/** A measure typed in, in millimeters. */
export interface NumberField<P> extends Shown<P>, Edits<P, number>, Named {
  type: 'number'
  unit: 'mm'
  /** The lowest the input offers; 1 without it. */
  min?: number
}

/** Measures side by side. */
export interface NumbersField<P> extends Shown<P> {
  type: 'numbers'
  columns: 2 | 3
  fields: NumberField<P>[]
}

/** A line that explains, with no control. */
export interface NoteField<P> extends Shown<P> {
  type: 'note'
  text: string
}

/** What each custom field edits: the parts of a plan no generic control can. */
export interface CustomValues {
  /** A cabinet's columns and their cells. */
  cabinetColumns: Column[]
}

/** A part of the form the studio draws with its own component, named here; it draws its own title. */
export type CustomField<P> = { [K in keyof CustomValues]: Shown<P> & Edits<P, CustomValues[K]> & { type: 'custom'; key: string; component: K; label: string } }[keyof CustomValues]

/** A titled part of the form; the title may depend on the plan ("Cajonera" on a desk, "Abajo" on a table). */
export interface SectionField<P> extends Shown<P> {
  type: 'section'
  title: string | ((plan: P) => string)
  fields: FieldSpec<P>[]
}

export type FieldSpec<P> = SectionField<P> | ChoiceField<P> | MaterialField<P> | StepperField<P> | NumbersField<P> | NumberField<P> | NoteField<P> | CustomField<P>

/** The fields that hold a value, however deep in sections and rows of measures. */
export type ValueField<P> = ChoiceField<P> | MaterialField<P> | StepperField<P> | NumberField<P> | CustomField<P>

/** Setting a field to the value it already has leaves the plan as it was. */
const keeping =
  <P, V>(get: (plan: P) => V, set: (plan: P, value: V) => P) =>
  (plan: P, value: V) =>
    Object.is(get(plan), value) ? plan : set(plan, value)

/** A module's labels as the buttons of a choice, in the order the form shows them. */
export const optionsOf = (labels: Record<string, { option: string } | string>): Option[] => Object.entries(labels).map(([value, label]) => [value, typeof label === 'string' ? label : label.option])

/** A module's labels as a choice's buttons and the words for each inside a sentence. */
export const fromLabels = (labels: Record<string, { option: string; phrase: string }>): Pick<ChoiceField<unknown>, 'options' | 'phrases'> => ({
  options: optionsOf(labels),
  phrases: Object.fromEntries(Object.entries(labels).map(([value, label]) => [value, label.phrase])),
})

type Spec<F, V, P> = Omit<F, 'type' | 'get' | 'set'> & { get: (plan: P) => V; set: (plan: P, value: V) => P }

/** Its value is always one of its options, which the tests hold equal to the plan's enum. */
export const choice = <P, V extends string>(spec: Spec<ChoiceField<P>, V, P>): ChoiceField<P> => ({
  ...spec,
  type: 'choice',
  set: keeping(spec.get, spec.set) as unknown as (plan: P, value: string) => P,
})

/** Sí / No for a flag of the plan. */
export const yesNo = <P>(spec: Omit<Spec<ChoiceField<P>, boolean, P>, 'options'>): ChoiceField<P> =>
  choice<P, 'yes' | 'no'>({ ...spec, options: [['yes', 'Sí'], ['no', 'No']], get: (plan) => (spec.get(plan) ? 'yes' : 'no'), set: (plan, value) => spec.set(plan, value === 'yes') })

export const material = <P>(spec: Spec<MaterialField<P>, string, P>): MaterialField<P> => ({ ...spec, type: 'material', set: keeping(spec.get, spec.set) })

export const stepper = <P>(spec: Spec<StepperField<P>, number, P>): StepperField<P> => ({ ...spec, type: 'stepper', set: keeping(spec.get, spec.set) })

export const number = <P>(spec: Omit<Spec<NumberField<P>, number, P>, 'unit'>): NumberField<P> => ({ ...spec, type: 'number', unit: 'mm', set: keeping(spec.get, spec.set) })

export const numbers = <P>(columns: 2 | 3, fields: NumberField<P>[], visibleWhen?: (plan: P) => boolean): NumbersField<P> => ({ type: 'numbers', columns, fields, visibleWhen })

export const note = <P>(text: string, visibleWhen?: (plan: P) => boolean): NoteField<P> => ({ type: 'note', text, visibleWhen })

export const section = <P>(title: SectionField<P>['title'], fields: FieldSpec<P>[], visibleWhen?: (plan: P) => boolean): SectionField<P> => ({ type: 'section', title, fields, visibleWhen })

export const custom = <P, K extends keyof CustomValues>(spec: Shown<P> & Edits<P, CustomValues[K]> & { key: string; component: K; label: string }): CustomField<P> =>
  ({ ...spec, type: 'custom', set: keeping(spec.get, spec.set) }) as unknown as CustomField<P>

/** Whether a field shows for this plan. */
export const isVisible = <P>(field: FieldSpec<P>, plan: P) => field.visibleWhen?.(plan) ?? true

/** Every field that holds a value, in the order of the form; with a plan, only those that show for it. */
export function valueFields<P>(fields: FieldSpec<P>[], plan?: P): ValueField<P>[] {
  return fields.flatMap((field): ValueField<P>[] => {
    if (plan !== undefined && !isVisible(field, plan)) return []
    switch (field.type) {
      case 'section':
      case 'numbers':
        return valueFields<P>(field.fields, plan)
      case 'note':
        return []
      default:
        return [field]
    }
  })
}
