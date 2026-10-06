import { endAt, makePiece, ref, startAt } from '../../design/builders'
import type { Design, Dimensions, Extent, Piece } from '../../design/schema'
import { materialById, type Catalog } from '../../materials/catalog'
import { applyOperations } from '../../editing/operations/apply'
import type { Operation } from '../../editing/operations/schema'
import { cite, noReference, STRUCTURE, VALUES, type Source } from '../../sources'

// What every module builds the same way: panels, drawers that may not fit, supports every so often and the numbers they share.

/** The board a module takes when its material is not in the catalog. */
export const DEFAULT_THICKNESS = 18

export const thicknessOf = (catalog: Catalog, material: string) => materialById(catalog, material)?.thickness ?? DEFAULT_THICKNESS

/**
 * The longest a bed platform or a table top goes unsupported: the bottom of the reference's 600–700 for a continuous 18 mm platform.
 * The bed check (BED_SPAN) is critical past the top, 700; a cabinet floor on legs is another case, reviewed past 800 (ASSUMPTIONS.floorSpan).
 */
export const MAX_SPAN = 600

/** Kick plate heights: bedroom and living-room furniture stands on 50–70, and so does a bed's row of drawers (kitchens take 80–100, not built here). */
export const KICK_HEIGHT = { cabinet: 70, pedestal: 70, bed: 70 } as const
export const KICK_SETBACK = 30
/** On legs: from the floor to the underside of the box, the height of the frame under it, the depth of a leg of two glued layers, and how far legs and frame sit back from the edges. */
export const LEG_HEIGHT = 150
/** What a person may choose for the legs' height, and the least that must stay for the box above them (the total height includes the legs). */
export const LEG_HEIGHT_RANGE = { min: 100, max: 300 } as const
export const MIN_CARCASS_HEIGHT = 200
export const LEG_APRON = 80
export const LEG_WIDTH = 72
/** A tapered leg's depth at the floor. */
export const LEG_FOOT = 36
export const LEG_INSET = 30
/** A bed's trim: how far the lip that keeps the mattress in rises over the platform, and how far the cap over a headboard reaches toward the mattress. */
export const MATTRESS_LIP = 40
export const CAP_OVERHANG = 20
/** The corner sawn off the front of a daybed's arm: how far it runs along the top and how far it comes down the front. */
export const ARM_SLOPE = { run: 240, drop: 120 } as const
/** What stays of the front of the arm over the mattress lip, so the cut never reaches where the lip is screwed. */
export const ARM_FRONT = 60
export const MODULE_SOURCES: Record<string, Source> = {
  DEFAULT_THICKNESS: cite(VALUES, '3-espesores-por-pieza', 'Laterales, piso, techo'),
  MAX_SPAN: cite(STRUCTURE, '73-camas', 'también necesita apoyos a cada ≈ 600–700 mm'),
  KICK_HEIGHT: cite(VALUES, '10-medidas-de-muebles-y-ergonomía', '**50–70** alto en recámara'),
  KICK_SETBACK: noReference('the reference sets a kick back 50 mm only in kitchens; 30 is Knotty’s for bedroom and living-room furniture'),
  LEG_HEIGHT: noReference('the reference gives no height for legs under a box; about 150 is what the reference sideboard KC-APA-01 (940 × 1600 × 400 on four splayed legs) shows'),
  LEG_HEIGHT_RANGE: noReference('the reference gives no range for legs: under 100 the 80 mm apron nearly touches the floor, over 300 they need a thicker section and bracing'),
  MIN_CARCASS_HEIGHT: noReference('the reference gives no least box height; under 200 a bottom, a top and a drawer or a shelf no longer fit between them'),
  LEG_APRON: cite(STRUCTURE, '21-mesas-y-escritorios-patas-faldón-y-bamboleo', 'de 80–120 mm de alto'),
  LEG_WIDTH: cite(STRUCTURE, '21-mesas-y-escritorios-patas-faldón-y-bamboleo', '2 × 18 = 36 × 72 mm'),
  LEG_FOOT: noReference('the reference gives no taper for a leg; 36 leaves the foot square with the two glued layers, half the 72 under the apron'),
  LEG_INSET: noReference('the same setback as a kick, KICK_SETBACK: the legs stay out of the way of feet and still stand close to the edges'),
  MATTRESS_LIP: noReference('the reference gives no height for a mattress lip; 40 is under a sixth of the 260 mm mattress, enough to stop it sliding and low enough to sit on'),
  ARM_SLOPE: noReference('chosen, not sourced: a cut twice as long as it is deep reads as a slope, and 120 leaves most of the arm to lean on'),
  ARM_FRONT: noReference('Knotty’s margin over the lip for the screws that hold it to the arm'),
  CAP_OVERHANG: noReference('the reference describes a cap (copete) in plywood as a straight strip and gives no overhang; 20 shows its edge as a shadow line without a ledge to catch on'),
}

type PanelSpec = Omit<Parameters<typeof makePiece>[0], 'material'>

/** A panel of the plan's plywood, banded on its front edge unless told otherwise. */
export const panelOf =
  (material: string) =>
  (p: PanelSpec): Piece =>
    makePiece({ material, edges: ['front'], ...p })

/** A leg of two layers of the board glued face to face: the first where it is placed, the second on the side the leg grows towards. */
export const legLayers = (material: string, id: string, name: string, first: Extent, towards: 'right' | 'left', y: Extent, z: Extent): Piece[] =>
  [1, 2].map((layer) =>
    makePiece({ material, id: `${id}-${layer}`, name: `${name} (capa ${layer})`, role: 'divider', normal: 'x', x: layer === 1 ? first : towards === 'right' ? startAt(ref(`${id}-1.x1`)) : endAt(ref(`${id}-1.x0`)), y, z }),
  )

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
