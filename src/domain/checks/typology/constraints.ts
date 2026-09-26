import { roundTo, type Box } from '../../design/resolve'
import { CONTACT_TOLERANCE, freeSpan } from '../../design/boxes'
import type { Design } from '../../design/schema'
import type { Geometry } from '../../design/resolve'
import { MATTRESSES } from '../../furniture/modules/bed'
import { checked, measured, type CategoryConstraint, type Surface, type UseInput } from './constraint'

// What each kind of furniture needs to be usable and safe, one entry per check and grouped by kind. Structure and use, not style.
// A limit that differs from docs/carpinteria keeps the code's value; the difference is noted next to it and corrected on its own.

/** Comfortable desk height, in mm. */
export const DESK_HEIGHT: [number, number] = [700, 780]
/** Depth a bookcase takes so large books do not stick out, in mm; below the first, a warning. */
export const BOOKCASE_DEPTH: [number, number] = [230, 300]
/** Depth a closet takes so hangers fit facing front, in mm; below the first, a warning. */
export const WARDROBE_DEPTH: [number, number] = [550, 600]
/** Longest span of a bed's platform without support, in mm: the top of the reference's 600–700 (the bed module builds to the bottom, MAX_SPAN). */
const BED_SPAN = 700

const VALUES = 'docs/carpinteria/valores-de-referencia.md'
const FURNITURE = 'docs/carpinteria/muebles-y-medidas.md'
const STRUCTURE = 'docs/carpinteria/estructura.md'

/** A bed lies either way in the room: the short side takes the mattress width. */
const platformSize = ({ box }: Surface) => [box.x1 - box.x0, box.z1 - box.z0].sort((a, b) => a - b)

/** The mattress its plan says; else one named in its name; else the one closest in width. */
function mattressOf(design: Design, width: number) {
  const sizes = Object.keys(MATTRESSES) as (keyof typeof MATTRESSES)[]
  const name = design.name.toLowerCase()
  return design.mattress ?? sizes.find((k) => name.includes(k)) ?? [...sizes].sort((a, b) => Math.abs(MATTRESSES[a][0] - width) - Math.abs(MATTRESSES[b][0] - width))[0]
}

/** The pieces of a bed's platform that cross more than the span without support, with how far. */
const unsupported = (input: UseInput, id: string) => {
  const span = freeSpan(id, input.geo.boxes.get(id)!, input)
  return span && span > BED_SPAN ? span : null
}

/** Free space for the legs under the top: the widest gap as tall and deep as a seated person needs. */
function kneeSpace(design: Design, geo: Geometry, top: Box, knee: { height: number; depth: number }) {
  const front = top.z1
  const blocking = [...geo.boxes.entries()]
    .filter(([id, b]) => !design.pieces.find((p) => p.id === id)?.group && b.y0 < knee.height && b.y1 > CONTACT_TOLERANCE && b.z1 > front - knee.depth && b.y1 <= top.y0 + CONTACT_TOLERANCE)
    .map(([, b]) => [b.x0, b.x1] as const)
    .sort((a, b) => a[0] - b[0])
  let cursor = top.x0
  let widest = 0
  for (const [x0, x1] of blocking) {
    widest = Math.max(widest, x0 - cursor)
    cursor = Math.max(cursor, x1)
  }
  return Math.max(widest, top.x1 - cursor)
}

const tableHeight = (use: 'diningTable' | 'coffeeTable' | 'sideTable', label: string, row: string, min: number, max: number) =>
  measured({
    check: 'table.height',
    appliesTo: [use],
    metric: 'surfaceHeight',
    limits: { min, max },
    severity: 'recommendation',
    source: `${VALUES}#10-medidas-de-muebles-y-ergonomía «${row}»`,
    message: (height, l) => `Una mesa ${label} va de ${l.min} a ${l.max} mm de alto; esta queda a ${roundTo(height, 0)} mm.`,
    data: (height) => ({ height: roundTo(height, 0) }),
  })

export const CATEGORY_CONSTRAINTS: readonly CategoryConstraint[] = [
  // Bed
  checked({
    check: 'bed.platform',
    appliesTo: ['bed'],
    limits: {},
    source: 'no reference: what counts as the platform (0.6 m² at one level) is Knotty’s own',
    find: ({ surface }, _, report) => (surface ? [] : [report('recommendation', [], 'No encuentro la superficie donde va el colchón: una cama necesita una base continua o tablas a lo ancho.')]),
  }),
  checked({
    check: 'bed.mattress-fit',
    appliesTo: ['bed'],
    // Reference: 10–30 mm of clearance per side, and the base never smaller than the mattress.
    limits: { tight: 20, loose: 80 },
    source: `${VALUES}#11-colchones-de-méxico-y-bases-de-cama «Holgura del colchón en la base»`,
    find: ({ design, surface }, { tight, loose }, report) => {
      if (!surface) return []
      const [width, length] = platformSize(surface)
      const size = mattressOf(design, width)
      const [mw, ml] = MATTRESSES[size]
      if (width < mw - tight || length < ml - tight)
        return [
          report('critical', surface.ids, `El colchón ${size} (${mw} × ${ml} mm) no cabe: la base mide ${roundTo(width, 0)} × ${roundTo(length, 0)} mm.`, { width: roundTo(width, 0), length: roundTo(length, 0), mattress: size }, [
            { key: 'mattress-size', description: `Hacer la base de ${mw} × ${ml} mm`, data: { width: mw, length: ml } },
          ]),
        ]
      if (width > mw + loose || length > ml + loose) return [report('recommendation', surface.ids, `La base mide ${roundTo(width, 0)} × ${roundTo(length, 0)} mm y el colchón ${size} ${mw} × ${ml}: le sobra espacio y se va a correr.`, { mattress: size })]
      return []
    },
  }),
  checked({
    check: 'bed.span',
    appliesTo: ['bed'],
    // Reference: a continuous 18 mm platform needs support every ≈ 600–700 mm; slats of 18 × 100 up to 700.
    limits: { max: BED_SPAN },
    source: `${STRUCTURE}#73-camas «Apoyo central»`,
    find: (input, { max }, report) =>
      (input.surface?.ids ?? []).flatMap((id) => {
        const span = unsupported(input, id)
        if (!span) return []
        const piece = input.design.pieces.find((p) => p.id === id)!
        return [
          report('critical', [id], `${piece.name} cruza ${roundTo(span, 0)} mm sin apoyo: con una persona encima se va a vencer.`, { span: roundTo(span, 0), max }, [
            { key: 'center-support', description: 'Agregar un travesaño o una pata al centro, debajo de la base', data: {} },
          ]),
        ]
      }),
  }),
  checked({
    check: 'bed.load',
    appliesTo: ['bed'],
    limits: {},
    source: `${VALUES}#5-cargas «Persona»`,
    // A piece that already spans too far gets bed.span instead.
    find: (input, _, report) =>
      (input.surface?.ids ?? []).flatMap((id) => {
        const piece = input.design.pieces.find((p) => p.id === id)!
        return unsupported(input, id) || piece.load === 'heavy' ? [] : [report('recommendation', [id], `${piece.name} carga el colchón y a una persona: márcala con carga pesada para revisar su flecha.`)]
      }),
  }),

  // Desk
  measured({
    check: 'desk.height',
    appliesTo: ['desk'],
    metric: 'surfaceHeight',
    // Reference: 740, from 680 to 780.
    limits: { min: DESK_HEIGHT[0], max: DESK_HEIGHT[1] },
    severity: 'recommendation',
    source: `${VALUES}#10-medidas-de-muebles-y-ergonomía «Alto de escritorio»`,
    message: (height, l) => `La cubierta queda a ${roundTo(height, 0)} mm; un escritorio cómodo va de ${l.min} a ${l.max} mm.`,
    data: (height) => ({ height: roundTo(height, 0) }),
  }),
  checked({
    check: 'desk.legroom',
    appliesTo: ['desk'],
    // Reference: 650 mm of free height.
    limits: { width: 600, height: 620, depth: 450 },
    source: `${VALUES}#10-medidas-de-muebles-y-ergonomía «Hueco libre para piernas»`,
    find: ({ design, geo, surface }, knee, report) => {
      if (!surface) return []
      const free = kneeSpace(design, geo, surface.box, knee)
      if (free >= knee.width) return []
      return [
        report('critical', surface.ids, `Debajo de la cubierta no queda espacio para las piernas: hace falta un hueco libre de ${knee.width} mm de ancho, ${knee.height} de alto y ${knee.depth} de fondo, y el más ancho mide ${roundTo(free, 0)} mm.`, { free: roundTo(free, 0) }, [
          { key: 'legroom', description: `Dejar un hueco libre de al menos ${knee.width} mm de ancho debajo de la cubierta`, data: { width: knee.width } },
        ]),
      ]
    },
  }),

  // Tables. Reference: coffee 380–500, dining 700–780.
  tableHeight('coffeeTable', 'de centro', 'Mesa de centro', 350, 500),
  tableHeight('sideTable', 'lateral', 'Mesa lateral', 450, 650),
  tableHeight('diningTable', 'de comedor', 'Mesa de comedor', 720, 770),

  // Chest of drawers, nightstand and wardrobe: anchoring is R4's (structure/rules/usage.ts), for any furniture with drawers or doors.

  // Wall cabinet
  checked({
    check: 'wall-cabinet.anchor',
    appliesTo: ['wallCabinet'],
    limits: {},
    source: `${VALUES}#12-vuelco-y-anclaje «Mueble colgado»`,
    find: ({ design }, _, report) =>
      design.wallAnchored ? [] : [report('critical', [], 'Una alacena de pared va colgada del muro: márcala como anclada para revisar cómo se sostiene.', {}, [{ key: 'anchor-to-wall', description: 'Colgarla del muro', data: {} }])],
  }),
  checked({
    check: 'wall-cabinet.hanging-rail',
    appliesTo: ['wallCabinet'],
    limits: {},
    source: `${VALUES}#12-vuelco-y-anclaje «Mueble colgado»`,
    find: ({ design }, _, report) =>
      design.pieces.some((p) => p.role === 'brace')
        ? []
        : [report('recommendation', [], 'Para colgarla, conviene un listón de triplay arriba y atrás, por dentro: ahí van los tornillos al muro y no en la trasera delgada.', {}, [{ key: 'hanging-rail', description: 'Agregar un listón de colgar arriba, atrás', data: {} }])],
  }),

  // Bookcase. Reference: 280 for common books, 330 for large ones.
  measured({
    check: 'bookcase.depth',
    appliesTo: ['bookcase'],
    metric: 'depth',
    limits: { min: BOOKCASE_DEPTH[0], usual: BOOKCASE_DEPTH },
    severity: 'recommendation',
    source: `${VALUES}#10-medidas-de-muebles-y-ergonomía «Librero: fondo»`,
    message: (depth, { usual }) => `Con ${depth} mm de fondo, los libros grandes quedan de fuera; un librero lleva ${usual[0]}–${usual[1]} mm.`,
    data: (depth, { min }) => ({ depth, min }),
  }),

  // Wardrobe
  measured({
    check: 'wardrobe.depth',
    appliesTo: ['wardrobe'],
    metric: 'depth',
    // Reference: 580–600.
    limits: { min: WARDROBE_DEPTH[0], usual: WARDROBE_DEPTH },
    severity: 'recommendation',
    source: `${VALUES}#10-medidas-de-muebles-y-ergonomía «Clóset: fondo»`,
    message: (depth, { usual }) => `Con ${depth} mm de fondo, los ganchos de ropa no caben de frente; un clóset lleva unos ${usual[0]}–${usual[1]} mm.`,
    data: (depth, { min }) => ({ depth, min }),
  }),

  // Shoe rack. Reference: 300–380, 330 usual.
  measured({
    check: 'shoe-rack.depth',
    appliesTo: ['shoeRack'],
    metric: 'depth',
    limits: { min: 300, usual: [300, 350] },
    severity: 'recommendation',
    source: `${FURNITURE}#26-zapateras «Fondo»`,
    message: (depth, { usual }) => `Con ${depth} mm de fondo, los zapatos de adulto sobresalen; una zapatera lleva ${usual[0]}–${usual[1]} mm.`,
    data: (depth, { min }) => ({ depth, min }),
  }),

  // Bench
  measured({
    check: 'bench.height',
    appliesTo: ['bench'],
    metric: 'surfaceHeight',
    // Reference: 450, from 400 to 480.
    limits: { min: 420, max: 480 },
    severity: 'recommendation',
    source: `${VALUES}#10-medidas-de-muebles-y-ergonomía «Banca»`,
    message: (height, l) => `Un asiento cómodo va de ${l.min} a ${l.max} mm; este queda a ${roundTo(height, 0)} mm.`,
  }),
  checked({
    check: 'bench.load',
    appliesTo: ['bench'],
    limits: {},
    source: `${VALUES}#5-cargas «Persona»`,
    find: ({ design, surface }, _, report) =>
      (surface?.ids ?? []).flatMap((id) => {
        const piece = design.pieces.find((p) => p.id === id)!
        return piece.load === 'heavy' ? [] : [report('recommendation', [id], `${piece.name} es asiento: márcalo con carga pesada para revisar su flecha.`)]
      }),
  }),
]
