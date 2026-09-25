import type { Design } from '../design/schema'
import { roundTo, type Box, type Geometry } from '../design/resolve'
import type { Finding, Rule } from '../structure/finding'
import { freeSpan } from '../structure/rules/deflection'
import { antiTipData } from '../structure/rules/usage'
import type { Catalog } from '../materials/catalog'
import type { DesignKind } from '../design/kind'
import { MATTRESSES } from '../modules/bed'

// Checks by kind of furniture: what a bed, a desk or a chest of drawers needs to be usable and safe. Structure and use, not style.

type TableKind = 'coffee' | 'dining' | 'side'

/** Words in a name that say what the furniture is: the fallback for a design that does not say it (designed piece by piece, or saved before designs did). */
const WORDS: [DesignKind, RegExp][] = [
  ['bed', /\bcama\b|\bbase de cama\b/],
  ['desk', /escritorio/],
  ['wallCabinet', /alacena|gabinete de pared/],
  ['drawers', /cajonera|c[oó]moda|bur[oó]|mesa de noche/],
  ['bookcase', /librer|estante/],
  ['wardrobe', /cl[oó]set|ropero|armario/],
  ['shoeRack', /zapatera/],
  ['bench', /\bbanca\b|\bbanco\b/],
  ['table', /\bmesa\b/],
]

/** What some words say the furniture is ("Buró con cajón" → drawers); null if they do not say. */
export function kindFromWords(text: string): DesignKind | null {
  const words = text.toLowerCase()
  return WORDS.find(([, pattern]) => pattern.test(words))?.[0] ?? null
}

/** What the furniture is: what its design says, or else what its name suggests. Null: a kind Knotty does not recognize. */
export function detectKind(design: Pick<Design, 'name'> & Partial<Pick<Design, 'kind'>>): DesignKind | null {
  return design.kind ?? kindFromWords(design.name)
}

const TABLE_HEIGHT: Record<TableKind, [number, number]> = { coffee: [350, 500], side: [450, 650], dining: [720, 770] }
/** Comfortable desk height, in mm. */
export const DESK_HEIGHT: [number, number] = [700, 780]
/** Depth a bookcase takes so large books do not stick out, in mm; below the first, a warning. */
export const BOOKCASE_DEPTH: [number, number] = [230, 300]
/** Depth a closet takes so hangers fit facing front, in mm; below the first, a warning. */
export const WARDROBE_DEPTH: [number, number] = [550, 600]
/** Depth of a shoe rack for adult shoes, in mm; below the first, a warning. */
const SHOE_RACK_DEPTH: [number, number] = [300, 350]
const KNEE = { width: 600, height: 620, depth: 450 }
const MATTRESS_TOLERANCE = { tight: 20, loose: 80 }
const BED_SPAN = 800
const BENCH_HEIGHT: [number, number] = [420, 480]

/** Each check has its own id: several can land on the same pieces (or on none), and each is accepted on its own. */
const finding = (check: string, severity: Finding['severity'], pieces: string[], message: string, data: Finding['data'] = {}, alternatives: Finding['alternatives'] = []): Finding => ({
  code: 'R10_USE',
  severity,
  pieces,
  check,
  message,
  data,
  alternatives,
})

const horizontal = (design: Design, geo: Geometry) =>
  design.pieces.filter((p) => p.normal === 'y' && !p.group && geo.boxes.has(p.id)).map((p) => ({ piece: p, box: geo.boxes.get(p.id)! }))
const area = (b: Box) => ((b.x1 - b.x0) * (b.z1 - b.z0)) / 1e6

/** The work or sleeping surface: the highest level where horizontal pieces add up to the most area. */
function topSurface(design: Design, geo: Geometry, minArea: number) {
  const levels = new Map<number, { area: number; ids: string[]; box: Box }>()
  for (const { piece, box } of horizontal(design, geo)) {
    if (area(box) < 0.05) continue
    const y = Math.round(box.y1)
    const level = levels.get(y) ?? { area: 0, ids: [], box: { ...box } }
    level.area += area(box)
    level.ids.push(piece.id)
    level.box = { x0: Math.min(level.box.x0, box.x0), x1: Math.max(level.box.x1, box.x1), y0: Math.min(level.box.y0, box.y0), y1: y, z0: Math.min(level.box.z0, box.z0), z1: Math.max(level.box.z1, box.z1) }
    levels.set(y, level)
  }
  return [...levels.entries()].filter(([, l]) => l.area >= minArea).sort(([ya], [yb]) => yb - ya)[0]?.[1] ?? null
}

const outside = (value: number, [min, max]: [number, number]) => value < min || value > max

function bed(design: Design, geo: Geometry, ctx: Parameters<Rule>[0]): Finding[] {
  const platform = topSurface(design, geo, 0.6)
  if (!platform) return [finding('bed.platform', 'recommendation', [], 'No encuentro la superficie donde va el colchón: una cama necesita una base continua o tablas a lo ancho.')]
  // A bed can lie either way in the room: the short side takes the mattress width.
  const [width, length] = [platform.box.x1 - platform.box.x0, platform.box.z1 - platform.box.z0].sort((a, b) => a - b)
  // The mattress its plan says; else one named in its name; else the one closest in width.
  const sizes = Object.keys(MATTRESSES) as (keyof typeof MATTRESSES)[]
  const name = design.name.toLowerCase()
  const size = design.mattress ?? sizes.find((k) => name.includes(k)) ?? [...sizes].sort((a, b) => Math.abs(MATTRESSES[a][0] - width) - Math.abs(MATTRESSES[b][0] - width))[0]
  const [mw, ml] = MATTRESSES[size]
  const found: Finding[] = []
  if (width < mw - MATTRESS_TOLERANCE.tight || length < ml - MATTRESS_TOLERANCE.tight)
    found.push(
      finding('bed.mattress-fit', 'critical', platform.ids, `El colchón ${size} (${mw} × ${ml} mm) no cabe: la base mide ${roundTo(width, 0)} × ${roundTo(length, 0)} mm.`, { width: roundTo(width, 0), length: roundTo(length, 0), mattress: size }, [
        { key: 'mattress-size', description: `Hacer la base de ${mw} × ${ml} mm`, data: { width: mw, length: ml } },
      ]),
    )
  else if (width > mw + MATTRESS_TOLERANCE.loose || length > ml + MATTRESS_TOLERANCE.loose)
    found.push(finding('bed.mattress-fit', 'recommendation', platform.ids, `La base mide ${roundTo(width, 0)} × ${roundTo(length, 0)} mm y el colchón ${size} ${mw} × ${ml}: le sobra espacio y se va a correr.`, { mattress: size }))
  for (const id of platform.ids) {
    const piece = design.pieces.find((p) => p.id === id)!
    const span = freeSpan(id, geo.boxes.get(id)!, ctx)
    if (span && span > BED_SPAN)
      found.push(
        finding('bed.span', 'critical', [id], `${piece.name} cruza ${roundTo(span, 0)} mm sin apoyo: con una persona encima se va a vencer.`, { span: roundTo(span, 0), max: BED_SPAN }, [
          { key: 'center-support', description: 'Agregar un travesaño o una pata al centro, debajo de la base', data: {} },
        ]),
      )
    else if (piece.load !== 'heavy') found.push(finding('bed.load', 'recommendation', [id], `${piece.name} carga el colchón y a una persona: márcala con carga pesada para revisar su flecha.`))
  }
  return found
}

/** Free space for the legs under the top: a gap at least as wide, tall and deep as a seated person needs. */
function kneeSpace(design: Design, geo: Geometry, top: Box) {
  const front = top.z1
  const blocking = [...geo.boxes.entries()]
    .filter(([id, b]) => !design.pieces.find((p) => p.id === id)?.group && b.y0 < KNEE.height && b.y1 > 0.5 && b.z1 > front - KNEE.depth && b.y1 <= top.y0 + 0.5)
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

function desk(design: Design, geo: Geometry): Finding[] {
  const top = topSurface(design, geo, 0.25)
  if (!top) return []
  const found: Finding[] = []
  const height = top.box.y1
  if (outside(height, DESK_HEIGHT)) found.push(finding('desk.height', 'recommendation', top.ids, `La cubierta queda a ${roundTo(height, 0)} mm; un escritorio cómodo va de ${DESK_HEIGHT[0]} a ${DESK_HEIGHT[1]} mm.`, { height: roundTo(height, 0) }))
  const free = kneeSpace(design, geo, top.box)
  if (free < KNEE.width)
    found.push(
      finding('desk.legroom', 'critical', top.ids, `Debajo de la cubierta no queda espacio para las piernas: hace falta un hueco libre de ${KNEE.width} mm de ancho, ${KNEE.height} de alto y ${KNEE.depth} de fondo, y el más ancho mide ${roundTo(free, 0)} mm.`, { free: roundTo(free, 0) }, [
        { key: 'legroom', description: `Dejar un hueco libre de al menos ${KNEE.width} mm de ancho debajo de la cubierta`, data: { width: KNEE.width } },
      ]),
    )
  return found
}

const TABLE_OF_KIND: Partial<Record<DesignKind, TableKind>> = { diningTable: 'dining', coffeeTable: 'coffee', sideTable: 'side' }

function table(design: Design, geo: Geometry, furniture: DesignKind): Finding[] {
  const top = topSurface(design, geo, 0.1)
  if (!top) return []
  // Which table the design says; a table that does not say, by its name.
  const name = design.name.toLowerCase()
  const kind: TableKind = TABLE_OF_KIND[furniture] ?? (/centro|caf[eé]/.test(name) ? 'coffee' : /comedor|cocina/.test(name) ? 'dining' : 'side')
  const range = TABLE_HEIGHT[kind]
  const label = { coffee: 'de centro', dining: 'de comedor', side: 'lateral' }[kind]
  return outside(top.box.y1, range) ? [finding('table.height', 'recommendation', top.ids, `Una mesa ${label} va de ${range[0]} a ${range[1]} mm de alto; esta queda a ${roundTo(top.box.y1, 0)} mm.`, { height: roundTo(top.box.y1, 0) })] : []
}

function drawers(design: Design, catalog: Catalog): Finding[] {
  const count = new Set(design.pieces.filter((p) => p.role === 'drawer-front' && p.group).map((p) => p.group)).size
  if (count < 2 || design.dimensions.height <= 700 || design.wallAnchored) return []
  return [
    finding('drawers.anchor', 'critical', design.pieces.filter((p) => p.role === 'side').map((p) => p.id), `Con ${count} cajones y ${design.dimensions.height} mm de alto, si se abren varios cajones o un niño se sube, se va de frente. Va anclada al muro.`, { drawers: count }, [
      { key: 'anchor-to-wall', description: 'Anclarla al muro con un kit antivuelco', data: antiTipData(catalog) },
    ]),
  ]
}

function wallCabinet(design: Design): Finding[] {
  const found: Finding[] = []
  if (!design.wallAnchored) found.push(finding('wall-cabinet.anchor', 'critical', [], 'Una alacena de pared va colgada del muro: márcala como anclada para revisar cómo se sostiene.', {}, [{ key: 'anchor-to-wall', description: 'Colgarla del muro', data: {} }]))
  if (!design.pieces.some((p) => p.role === 'brace'))
    found.push(
      finding('wall-cabinet.hanging-rail', 'recommendation', [], 'Para colgarla, conviene un listón de triplay arriba y atrás, por dentro: ahí van los tornillos al muro y no en la trasera delgada.', {}, [
        { key: 'hanging-rail', description: 'Agregar un listón de colgar arriba, atrás', data: {} },
      ]),
    )
  return found
}

/** `message` gets the depth there is and the depth that is usual. */
const minDepth = (check: string, design: Design, [min, max]: [number, number], message: (depth: number, usual: string) => string): Finding[] =>
  design.dimensions.depth < min ? [finding(check, 'recommendation', [], message(design.dimensions.depth, `${min}–${max} mm`), { depth: design.dimensions.depth, min: min })] : []

function wardrobe(design: Design): Finding[] {
  const found = minDepth('wardrobe.depth', design, WARDROBE_DEPTH, (depth, usual) => `Con ${depth} mm de fondo, los ganchos de ropa no caben de frente; un clóset lleva unos ${usual}.`)
  if (design.dimensions.height > 1500 && !design.wallAnchored)
    found.push(finding('wardrobe.anchor', 'critical', [], `Un clóset de ${design.dimensions.height} mm de alto va anclado al muro: con las puertas abiertas se puede ir de frente.`, {}, [{ key: 'anchor-to-wall', description: 'Anclarlo al muro', data: {} }]))
  return found
}

function bench(design: Design, geo: Geometry): Finding[] {
  const seat = topSurface(design, geo, 0.05)
  if (!seat) return []
  const found: Finding[] = []
  if (outside(seat.box.y1, BENCH_HEIGHT)) found.push(finding('bench.height', 'recommendation', seat.ids, `Un asiento cómodo va de ${BENCH_HEIGHT[0]} a ${BENCH_HEIGHT[1]} mm; este queda a ${roundTo(seat.box.y1, 0)} mm.`))
  for (const id of seat.ids) {
    const piece = design.pieces.find((p) => p.id === id)!
    if (piece.load !== 'heavy') found.push(finding('bench.load', 'recommendation', [id], `${piece.name} es asiento: márcalo con carga pesada para revisar su flecha.`))
  }
  return found
}

/** R10: what this kind of furniture needs to be used safely. */
export const typologyRule: Rule = (ctx) => {
  const { design, geo } = ctx
  const kind = detectKind(design)
  switch (kind) {
    case 'bed':
      return bed(design, geo, ctx)
    case 'desk':
      return desk(design, geo)
    case 'table':
    case 'diningTable':
    case 'coffeeTable':
    case 'sideTable':
      return table(design, geo, kind)
    case 'drawers':
    case 'nightstand':
      return drawers(design, ctx.catalog)
    case 'wallCabinet':
      return wallCabinet(design)
    case 'bookcase':
      return minDepth('bookcase.depth', design, BOOKCASE_DEPTH, (depth, usual) => `Con ${depth} mm de fondo, los libros grandes quedan de fuera; un librero lleva ${usual}.`)
    case 'wardrobe':
      return wardrobe(design)
    case 'shoeRack':
      return minDepth('shoe-rack.depth', design, SHOE_RACK_DEPTH, (depth, usual) => `Con ${depth} mm de fondo, los zapatos de adulto sobresalen; una zapatera lleva ${usual}.`)
    case 'bench':
      return bench(design, geo)
    // A box whose use is not known, or furniture Knotty does not recognize.
    case 'cabinet':
    case null:
      return []
  }
}
