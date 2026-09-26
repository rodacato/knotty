import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { analyze } from '../analysis'
import { testCatalog } from '../fixtures/catalog.test-util'
import { boardsFor } from '../materials/catalog'
import { isVisible, valueFields, type FieldSpec, type ValueField } from './fields'
import type { FurnitureModule } from './module'
import { MODULES, type FurniturePlan } from './plan'

// Every module's form, checked against its schema and its builder: a field that edits the wrong thing, or leaves a plan Knotty cannot build, fails here.

type Plan = FurniturePlan
const modules = Object.values(MODULES) as unknown as FurnitureModule<Plan>[]

/** What the form does not edit, and why. */
const NOT_ON_THE_FORM: Record<string, string> = {
  kind: 'what the plan is; it picks the module, not a field',
  name: 'renamed in the header or by the expert; a table takes the name of its use',
}

/** The values of a plan's leaves by path: objects go inside, arrays and values are leaves. */
function leaves(value: unknown, path = ''): Map<string, string> {
  if (value && typeof value === 'object' && !Array.isArray(value))
    return new Map(Object.entries(value).flatMap(([key, v]) => [...leaves(v, path ? `${path}.${key}` : key)]))
  return new Map([[path, JSON.stringify(value)]])
}
const changedLeaves = (before: Plan, after: Plan) => {
  const a = leaves(before)
  return [...leaves(after)].filter(([path, v]) => a.get(path) !== v).map(([path]) => path)
}

/** The values worth trying on a field of this plan. */
function candidates(field: ValueField<Plan>, plan: Plan): unknown[] {
  switch (field.type) {
    case 'choice':
      return field.options.map(([value]) => value)
    case 'material':
      return boardsFor(testCatalog, field.use).map((m) => m.id)
    case 'stepper':
      return Array.from({ length: field.max - field.min + 1 }, (_, i) => field.min + i)
    case 'number':
      return [field.get(plan) + 50]
    case 'custom': {
      const columns = field.get(plan)
      return [[...columns, columns[0]], ...(columns.length > 1 ? [columns.slice(1)] : [])]
    }
  }
}
const setAny = (field: ValueField<Plan>, plan: Plan, value: unknown) => (field.set as (plan: Plan, value: unknown) => Plan)(plan, value)

/** Every change on every variant is slow for the bed's 64: the variants that each show some field, or hold some value of it, no earlier one did. */
function spread(fields: FieldSpec<Plan>[], variants: Plan[]) {
  const seen = new Set<string>()
  return variants.filter((plan) => {
    const pairs = valueFields(fields, plan).map((f) => `${f.key}=${JSON.stringify(f.get(plan))}`)
    const fresh = pairs.filter((p) => !seen.has(p))
    for (const p of fresh) seen.add(p)
    return fresh.length > 0
  })
}

/** The schema at a field's path. */
const schemaAt = (schema: z.ZodType, path: string) => path.split('.').reduce<z.ZodType>((s, key) => (s as z.ZodObject).shape[key] as z.ZodType, schema)

describe.each(modules.map((m) => [m.kind, m] as const))('the %s form', (_, module) => {
  const variants = module.benchVariants().map(([, plan]) => plan)
  const fields = valueFields(module.fields)

  it('edits every key of its schema, but those left out on purpose', () => {
    const edited = new Set<string>()
    for (const plan of variants)
      for (const field of valueFields(module.fields, plan))
        for (const value of candidates(field, plan)) for (const path of changedLeaves(plan, setAny(field, plan, value))) edited.add(path)
    const keys = [...leaves(variants[0]).keys()]
    expect(keys.filter((k) => !edited.has(k) && !(k in NOT_ON_THE_FORM))).toEqual([])
  })

  it('names each field by the key it edits', () => {
    const keys = [...leaves(variants[0]).keys()]
    expect(fields.map((f) => f.key).filter((key) => !keys.includes(key))).toEqual([])
  })

  it('offers exactly the values its schema takes, on every choice', () => {
    for (const field of fields.filter((f) => f.type === 'choice')) {
      const at = schemaAt(module.schema, field.key)
      const values = at instanceof z.ZodBoolean ? ['yes', 'no'] : (at as z.ZodEnum).options
      expect({ [field.key]: field.options.map(([value]) => value).sort() }).toEqual({ [field.key]: [...values].sort() })
    }
  })

  it('leaves the plan as it was when a field is set to the value it has', () => {
    const moved = variants.flatMap((plan) => fields.filter((field) => setAny(field, plan, field.get(plan)) !== plan).map((field) => `${module.traceLabel(plan)} · ${field.key}`))
    expect(moved).toEqual([])
  })

  it('reads back what it sets, and every change it offers builds a valid piece', () => {
    for (const plan of spread(module.fields, variants))
      for (const field of valueFields(module.fields, plan))
        for (const value of candidates(field, plan)) {
          const changed = setAny(field, plan, value)
          const label = `${module.traceLabel(plan)} · ${field.key} = ${JSON.stringify(value)}`
          expect({ label, value: field.get(changed), parses: module.schema.safeParse(changed).success }).toEqual({ label, value, parses: true })
          const a = analyze(module.build(changed, testCatalog).design, testCatalog)
          expect(a.valid ? 'valid' : `${label}: ${JSON.stringify(a.errors.slice(0, 2))}`).toBe('valid')
        }
  })

  it('titles every section it shows, for every variant', () => {
    const sections = (list: FieldSpec<Plan>[]): FieldSpec<Plan>[] => list.flatMap((f) => (f.type === 'section' ? [f, ...sections(f.fields)] : []))
    for (const plan of variants)
      for (const s of sections(module.fields)) {
        if (s.type !== 'section' || !isVisible(s, plan)) continue
        expect((typeof s.title === 'string' ? s.title : s.title(plan)).length).toBeGreaterThan(0)
      }
  })
})
