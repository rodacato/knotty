import type { BedPlan } from './bed'
import type { CabinetConstruction, CabinetPlan } from './cabinet'
import { isBed, isTable, type FurniturePlan } from './plan'
import type { TablePlan } from './table'
import type { Cell } from '../reading/reading'

// What changed between two plans, in words for the person and for the expert's context.

const CONTENT: Record<Cell['content'], string> = { open: 'abierto', drawer: 'cajón', door: 'door', closed: 'tapado' }
const CONSTRUCTION: { [K in keyof CabinetConstruction]: [string, Record<CabinetConstruction[K], string>] } = {
  doors: ['puertas', { overlay: 'sobrepuestas', inset: 'embutidas' }],
  drawerFronts: ['frentes de cajón', { inset: 'embutidos', overlay: 'sobrepuestos' }],
  top: ['top', { between: 'entre laterales', over: 'cubierta encima' }],
  back: ['back', { nailed: 'clavada', none: 'sin trasera' }],
  shelves: ['repisas', { movable: 'móviles', fixed: 'fijas' }],
}

const count = (plan: CabinetPlan, content: Cell['content']) => plan.columns.flatMap((c) => c.cells).filter((c) => c.content === content).length
const layout = (plan: CabinetPlan) => JSON.stringify(plan.columns)

const DRAWER_SIDE: Record<BedPlan['drawers']['side'], string> = { none: 'sin cajones', left: 'cajones del lado izquierdo', right: 'cajones del lado derecho', both: 'cajones de los dos lados' }
const DRAWER_POSITION: Record<BedPlan['drawers']['position'], string> = { head: 'hacia la cabecera', center: 'al centro', foot: 'hacia el pie' }
const HEADBOARD: Record<BedPlan['headboard']['style'], string> = { none: 'sin cabecera', plain: 'cabecera lisa', bookcase: 'cabecera librero', storage: 'cabecera con compartimento' }

function describeBedChanges(before: BedPlan, after: BedPlan): string[] {
  const changes: string[] = []
  if (before.mattress !== after.mattress) changes.push(`colchón ${after.mattress}`)
  if (before.height !== after.height) changes.push(`base de ${after.height} mm`)
  if (before.material !== after.material) changes.push(`material ${after.material}`)
  const [a, b] = [before.drawers, after.drawers]
  if (a.side !== b.side) changes.push(DRAWER_SIDE[b.side])
  if (b.side !== 'none' && a.count !== b.count) changes.push(`${b.count} ${b.count === 1 ? 'cajón' : 'cajones'} por lado`)
  if (b.side !== 'none' && a.position !== b.position) changes.push(`cajones ${DRAWER_POSITION[b.position]}`)
  const [h, k] = [before.headboard, after.headboard]
  if (h.style !== k.style) changes.push(HEADBOARD[k.style])
  if (k.style !== 'none' && h.height !== k.height) changes.push(`cabecera de ${k.height} mm`)
  if ((k.style === 'bookcase' || k.style === 'storage') && h.depth !== k.depth) changes.push(`cabecera de ${k.depth} mm de fondo`)
  if ((k.style === 'bookcase' || k.style === 'storage') && h.shelves !== k.shelves) changes.push(`${k.shelves} ${k.shelves === 1 ? 'shelf' : 'repisas'} en la cabecera`)
  return changes
}

const USE: Record<TablePlan['use'], string> = { dining: 'mesa de comedor', coffee: 'mesa de centro', side: 'mesa lateral', desk: 'escritorio' }
const PEDESTAL: Record<TablePlan['pedestal']['side'], string> = { none: 'sin cajonera', left: 'cajonera a la izquierda', right: 'cajonera a la derecha' }

function describeTableChanges(before: TablePlan, after: TablePlan): string[] {
  const changes: string[] = []
  if (before.use !== after.use) changes.push(`ahora ${USE[after.use]}`)
  else if (before.name !== after.name) changes.push(`se llama «${after.name}»`)
  const [a, b] = [before.dimensions, after.dimensions]
  if (a.height !== b.height || a.width !== b.width || a.depth !== b.depth) changes.push(`medidas ${b.height} × ${b.width} × ${b.depth} mm`)
  if (before.material !== after.material) changes.push(`material ${after.material}`)
  if (before.overhang !== after.overhang) changes.push(after.overhang ? `cubierta que sobresale ${after.overhang} mm` : 'costados a la orilla')
  if (before.shelf !== after.shelf) changes.push(after.shelf ? 'con repisa baja' : 'sin repisa baja')
  if (before.pedestal.side !== after.pedestal.side) changes.push(PEDESTAL[after.pedestal.side])
  if (after.pedestal.side !== 'none' && before.pedestal.drawers !== after.pedestal.drawers) changes.push(`${after.pedestal.drawers} ${after.pedestal.drawers === 1 ? 'cajón' : 'cajones'} en la cajonera`)
  return changes
}

const KIND_NAME = (plan: FurniturePlan) => (isBed(plan) ? 'una cama' : isTable(plan) ? 'una mesa' : 'un gabinete')

export function describePlanChanges(before: FurniturePlan, after: FurniturePlan): string[] {
  if (isBed(before) && isBed(after)) return describeBedChanges(before, after)
  if (isTable(before) && isTable(after)) return describeTableChanges(before, after)
  if (isBed(before) || isBed(after) || isTable(before) || isTable(after)) return [`ahora es ${KIND_NAME(after)}`]
  return describeCabinetChanges(before, after)
}

function describeCabinetChanges(before: CabinetPlan, after: CabinetPlan): string[] {
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
