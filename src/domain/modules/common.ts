import { makePiece } from '../design/builders'
import type { Design, Dimensions, Piece } from '../design/schema'
import { materialById, type Catalog } from '../materials/catalog'
import { applyOperations } from '../operations/apply'
import type { Operation } from '../operations/schema'

// What every module builds the same way: panels, drawers that may not fit, supports every so often and the numbers they share.

/** The board a module takes when its material is not in the catalog. */
export const DEFAULT_THICKNESS = 18

export const thicknessOf = (catalog: Catalog, material: string) => materialById(catalog, material)?.thickness ?? DEFAULT_THICKNESS

/** The longest a bed platform or a table top goes unsupported. The checks allow 800 (BED_SPAN, ASSUMPTIONS.floorSpan): not reconciled yet. */
export const MAX_SPAN = 600

/** Kick plate heights: bedroom and living-room furniture stands on 50–70, and so does a bed's row of drawers (kitchens take 80–100, not built here). */
export const KICK_HEIGHT = { cabinet: 70, pedestal: 70, bed: 70 } as const
export const KICK_SETBACK = 30

type PanelSpec = Omit<Parameters<typeof makePiece>[0], 'material'>

/** A panel of the plan's plywood, banded on its front edge unless told otherwise. */
export const panelOf =
  (material: string) =>
  (p: PanelSpec): Piece =>
    makePiece({ material, edges: ['front'], ...p })

/** How many supports split a length so no stretch between them is longer than `span`, each support `t` thick. */
export const supportsAcross = (length: number, t: number, span = MAX_SPAN) => Math.ceil(length / (span + t)) - 1

export type AddDrawer = Extract<Operation, { op: 'addDrawer' }>

/** Drawers go one by one: one that does not fit is left out and said instead of failing the whole piece. `placed` finishes one that went in. */
export function addDrawers(design: Design, drawers: AddDrawer[], catalog: Catalog, placed: (design: Design, drawer: AddDrawer) => Design = (d) => d): { design: Design; notes: string[] } {
  const notes: string[] = []
  for (const drawer of drawers) {
    const result = applyOperations(design, [drawer], catalog)
    if (!result.ok) {
      notes.push(`${drawer.name}: ${result.errors[0]?.message ?? 'no cupo'} Lo dejé como hueco abierto.`)
      continue
    }
    design = placed(result.value.design, drawer)
  }
  return { design, notes }
}

export const cm = (mm: number) => `${(mm / 10).toLocaleString('es-MX', { maximumFractionDigits: 1 })} cm`

/** The header line of a piece of furniture known by its outside measures. */
export const measuresSummary = ({ width, height, depth }: Dimensions) => `${height} × ${width} × ${depth} mm · ${cm(width)} de ancho`

/** A label as it reads inside a sentence: "Frentes de cajón" → "frentes de cajón". */
export const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1)
