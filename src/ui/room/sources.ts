import { currentPlan } from '../../application/useCases'
import { currentDesign, type DesignState } from '../../domain/session/state'
import { exampleDesign, type Base, type Example } from '../../domain/furniture/examples'
import type { Catalog } from '../../domain/materials/catalog'
import type { Room } from '../../domain/furniture/references'
import type { FurnitureSource } from './layout'

export function baseSource(base: Base, catalog: Catalog, example: Example = base): FurnitureSource {
  return {
    identity: `ficha:${base.code}`,
    code: base.code,
    version: base.version,
    name: base.name,
    design: exampleDesign(example, catalog).design,
    example,
    room: base.rooms[0] ?? 'bedroom',
  }
}

export function studioSource(state: DesignState, bases: Base[]): FurnitureSource {
  const design = currentDesign(state),
    code = state.ficha?.code ?? null
  const base = bases.find((b) => b.code === code)
  const { plan, diverged, extras } = currentPlan(state)
  const example: Example | null =
    plan && !diverged && !extras.length && !design.edgeProfiles?.length && (!design.wall || design.wall === 'unknown')
      ? {
          name: design.name,
          plan,
          notes: design.notes,
          finish: design.finish,
          kind: design.kind,
          ...state.ficha,
        }
      : null
  const room: Room =
    base?.rooms[0] ??
    (design.kind === 'bed' || design.kind === 'nightstand' || design.kind === 'wardrobe' ? 'bedroom' : design.kind === 'wallCabinet' || design.kind === 'kitchenBase' ? 'kitchen' : 'office')
  return {
    identity: code ? `ficha:${code}` : `design:${state.versions[0].design.name}`,
    code,
    version: state.ficha?.version ?? null,
    name: design.name,
    design,
    example,
    room,
  }
}

const COMPANIONS: Partial<Record<Room, string[]>> = {
  bedroom: ['GN-BUR-01', 'GN-LIB-01', 'KC-BUR-03', 'GN-CAM-01', 'GN-LIB-02'],
  office: ['GN-LIB-01', 'GN-ARC-01', 'KC-ESC-03', 'KC-LIB-02'],
  kitchen: ['GN-COC-04', 'GN-COC-05', 'GN-COC-02', 'GN-COC-01', 'GN-COC-03'],
}
export function companions(bases: Base[], source: FurnitureSource): Base[] {
  const codes = COMPANIONS[source.room] ?? []
  return bases
    .filter((b) => b.code !== source.code && (codes.includes(b.code) || b.rooms.includes(source.room)))
    .sort((a, b) => {
      const rank = (b: Base) => {
        const i = codes.indexOf(b.code)
        return i < 0 ? codes.length : i
      }
      return rank(a) - rank(b)
    })
}
