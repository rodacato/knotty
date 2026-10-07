import { roundTo, type Box } from '../../design/resolve'
import { bounds, CONTACT_TOLERANCE, freeSpan } from '../../design/boxes'
import type { Design } from '../../design/schema'
import type { Geometry } from '../../design/resolve'
import { MATTRESSES } from '../../design/kind'
import { checked, measured, slatsOf, type CategoryConstraint, type Surface, type UseInput } from './constraint'

// What each kind of furniture needs to be usable and safe, one entry per check and grouped by kind. Structure and use, not style.
// A limit that differs from docs/carpinteria keeps the code's value; the difference is noted next to it and corrected on its own.

/** Comfortable desk height, in mm. */
export const DESK_HEIGHT: [number, number] = [700, 780]
/** Height of a surface worked at standing, in mm. */
export const WORKBENCH_HEIGHT: [number, number] = [850, 1100]
/** Depth a bookcase takes so large books do not stick out, in mm; below the first, a warning. */
export const BOOKCASE_DEPTH: [number, number] = [230, 300]
/** Depth a closet takes so hangers fit facing front, in mm; below the first, a warning. */
export const WARDROBE_DEPTH: [number, number] = [550, 600]
/** Longest span of a bed's platform without support, in mm: the top of the reference's 600–700 (the bed module builds to the bottom, MAX_SPAN). */
const BED_SPAN = 700

/** A board whose edge stands no more than this over the slats is where the mattress rests, not a lip around it. */
const RIM_OVER_SLATS = 5

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
  // A slat spans its own length, across the bed; a panel is judged along the bed, between its cross members.
  const slat = slatsOf(input.design, input.geo, input.surface?.ids ?? []).includes(id)
  const span = freeSpan(id, input.geo.boxes.get(id)!, input, slat ? 'z' : 'x')
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
    find: ({ design, geo, surface }, { tight, loose }, report) => {
      if (!surface) return []
      // Slats sit between the boards of the base, a hair under their edges: the mattress rests on those edges too.
      const rim = !slatsOf(design, geo, surface.ids).length
        ? []
        : design.pieces.flatMap((p) => {
            const b = geo.boxes.get(p.id)
            return b && p.normal !== 'y' && b.y0 < surface.box.y1 && b.y1 >= surface.box.y1 && b.y1 - surface.box.y1 <= RIM_OVER_SLATS ? [b] : []
          })
      const [width, length] = platformSize({ ...surface, box: bounds([surface.box, ...rim]) })
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
    check: 'bed.slats',
    appliesTo: ['bed'],
    // Reference: slats of 18 × 100 or more, no more than 75 mm apart (most mattress warranties ask for it).
    limits: { width: 100, thickness: 18, gap: 75 },
    source: `${VALUES}#11-colchones-de-méxico-y-bases-de-cama «Separación entre tablillas»`,
    find: ({ design, geo, surface }, { width, thickness, gap }, report) => {
      const slats = slatsOf(design, geo, surface?.ids ?? [])
        .map((id) => ({ id, box: geo.boxes.get(id)! }))
        .sort((a, b) => a.box.x0 - b.box.x0)
      const thin = slats.filter(({ id, box }) => box.x1 - box.x0 < width - CONTACT_TOLERANCE || (geo.thicknesses.get(id) ?? thickness) < thickness)
      const apart = slats.slice(1).flatMap((slat, i) => (slat.box.x0 - slats[i].box.x1 > gap + CONTACT_TOLERANCE ? [{ pair: [slats[i].id, slat.id], gap: slat.box.x0 - slats[i].box.x1 }] : []))
      const widest = [...apart].sort((a, b) => b.gap - a.gap)[0]
      return [
        ...(thin.length ? [report('recommendation', thin.map((s) => s.id), `Las tablillas de la base van de ${thickness} × ${width} mm o más: más angostas o más delgadas, una rodilla encima puede romper una.`, { width, thickness, slats: thin.length })] : []),
        ...(widest ? [report('recommendation', widest.pair, `Entre dos tablillas quedan ${roundTo(widest.gap, 0)} mm: con más de ${gap} el colchón se hunde entre ellas y muchas garantías ya no lo cubren.`, { gap: roundTo(widest.gap, 0), max: gap, places: apart.length })] : []),
      ]
    },
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
  measured({
    check: 'workbench.height',
    appliesTo: ['workbench'],
    metric: 'surfaceHeight',
    // The reference gives the workshop bench (850–950); 950–1100 for a standing desk has no row of its own (the 1020–1100 row is a bar counter).
    limits: { min: WORKBENCH_HEIGHT[0], max: WORKBENCH_HEIGHT[1] },
    severity: 'recommendation',
    source: `${FURNITURE}#21-mesas-y-superficies «Mesa de trabajo de pie (taller)»`,
    message: (height, l) => `La cubierta queda a ${roundTo(height, 0)} mm; una mesa para trabajar de pie va de ${l.min} a ${l.max} mm.`,
    data: (height) => ({ height: roundTo(height, 0) }),
  }),
  checked({
    check: 'desk.legroom',
    appliesTo: ['desk'],
    // Reference: 650 mm minimum. An 80 mm apron under an 18 mm top leaves 642 mm in the reference's own 740 mm desk, so 650 would flag every desk it recommends.
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

  // Tables. Reference: coffee 380–500, dining 700–780; the limits below are wider for coffee and narrower for dining, and the reason is not recorded.
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
