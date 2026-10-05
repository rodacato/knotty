import { useMemo } from 'react'
import { resolveGeometry, type Geometry } from '../../domain/design/resolve'
import type { Design } from '../../domain/design/schema'
import { exampleDesign } from '../../domain/furniture/examples'
import type { Reference } from '../../domain/furniture/references'
import { useServices } from '../services'

// Every ficha built once, as the room draws it: its design and its resolved boxes.

export interface Model {
  reference: Reference
  design: Design
  geo: Geometry
}

export function useModels(): Map<string, Model> {
  const { references, catalog } = useServices()
  return useMemo(() => {
    const models = new Map<string, Model>()
    for (const r of references.all()) {
      const { design } = exampleDesign({ name: r.name, plan: r.plan, notes: r.notes, kind: r.kind, finish: r.finish }, catalog)
      const geo = resolveGeometry(design, catalog)
      if (geo.ok) models.set(r.code, { reference: r, design, geo: geo.value })
    }
    return models
  }, [references, catalog])
}
