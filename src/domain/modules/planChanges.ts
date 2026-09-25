import type { CabinetConstruction, CabinetPlan } from './cabinet'
import type { Cell } from '../reading/reading'

// What changed between two plans, in words for the person and for the expert's context.

const CONTENT: Record<Cell['content'], string> = { open: 'abierto', drawer: 'cajón', door: 'puerta', closed: 'tapado' }
const CONSTRUCTION: { [K in keyof CabinetConstruction]: [string, Record<CabinetConstruction[K], string>] } = {
  doors: ['puertas', { overlay: 'sobrepuestas', inset: 'embutidas' }],
  drawerFronts: ['frentes de cajón', { inset: 'embutidos', overlay: 'sobrepuestos' }],
  top: ['techo', { between: 'entre laterales', over: 'cubierta encima' }],
  back: ['trasera', { nailed: 'clavada', none: 'sin trasera' }],
  shelves: ['repisas', { movable: 'móviles', fixed: 'fijas' }],
}

const count = (plan: CabinetPlan, content: Cell['content']) => plan.columns.flatMap((c) => c.cells).filter((c) => c.content === content).length
const layout = (plan: CabinetPlan) => JSON.stringify(plan.columns)

export function describePlanChanges(before: CabinetPlan, after: CabinetPlan): string[] {
  const changes: string[] = []
  const a = before.dimensions
  const b = after.dimensions
  if (a.height !== b.height || a.width !== b.width || a.depth !== b.depth) changes.push(`medidas ${b.height} × ${b.width} × ${b.depth} mm`)
  if (before.material !== after.material) changes.push(`material ${after.material}`)
  if (before.base !== after.base) changes.push(after.base === 'kick' ? 'con zoclo' : 'sin zoclo')
  if (before.wallMounted !== after.wallMounted) changes.push(after.wallMounted ? 'anclado al muro' : 'sin anclar')
  for (const key of Object.keys(CONSTRUCTION) as (keyof CabinetConstruction)[]) {
    if (before.construction[key] === after.construction[key]) continue
    const [label, values] = CONSTRUCTION[key] as [string, Record<string, string>]
    changes.push(`${label} ${values[after.construction[key]]}`)
  }
  if (before.columns.length !== after.columns.length) changes.push(`${after.columns.length} ${after.columns.length === 1 ? 'columna' : 'columnas'}`)
  for (const content of Object.keys(CONTENT) as Cell['content'][]) {
    const [was, is] = [count(before, content), count(after, content)]
    if (was !== is) changes.push(`${is} ${content === 'drawer' ? (is === 1 ? 'cajón' : 'cajones') : `${is === 1 ? 'hueco' : 'huecos'} ${CONTENT[content]}${is === 1 ? '' : 's'}`}`)
  }
  if (!changes.length && layout(before) !== layout(after)) changes.push('distribución de los huecos')
  return changes
}
