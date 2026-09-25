import type { Design } from '../diseno/schema'
import { roundTo, type Box, type Geometry } from '../diseno/resolve'
import type { Finding, Rule } from '../structure/finding'
import { freeSpan } from '../structure/rules/deflection'

// Checks by kind of furniture: what a bed, a desk or a chest of drawers needs to be usable and safe. Structure and use, not style.

export type Kind = 'bed' | 'desk' | 'table' | 'drawers' | 'wallCabinet' | 'bookcase' | 'wardrobe' | 'shoeRack' | 'bench'
export type TableKind = 'coffee' | 'dining' | 'side'

const KINDS: [Kind, RegExp][] = [
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

export function detectKind(design: Pick<Design, 'name'>): Kind | null {
  const name = design.name.toLowerCase()
  return KINDS.find(([, pattern]) => pattern.test(name))?.[0] ?? null
}

/** Mattress sizes sold in Mexico, width × length in mm. */
export const MATTRESSES = { individual: [990, 1900], matrimonial: [1350, 1900], queen: [1520, 2000], king: [1930, 2000] } as const
const TABLE_HEIGHT: Record<TableKind, [number, number]> = { coffee: [350, 500], side: [450, 650], dining: [720, 770] }
const DESK_HEIGHT: [number, number] = [700, 780]
const KNEE = { width: 600, height: 620, depth: 450 }
const MATTRESS_TOLERANCE = { tight: 20, loose: 80 }
const BED_SPAN = 800
const BENCH_HEIGHT: [number, number] = [420, 480]

const finding = (severidad: Finding['severity'], piezas: string[], mensaje: string, datos: Finding['data'] = {}, alternativas: Finding['alternatives'] = []): Finding => ({
  code: 'R10_USE',
  severity: severidad,
  pieces: piezas,
  message: mensaje,
  data: datos,
  alternatives: alternativas,
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
  if (!platform) return [finding('recommendation', [], 'No encuentro la superficie donde va el colchón: una cama necesita una base continua o tablas a lo ancho.')]
  // A bed can lie either way in the room: the short side takes the mattress width.
  const [width, length] = [platform.box.x1 - platform.box.x0, platform.box.z1 - platform.box.z0].sort((a, b) => a - b)
  const name = design.name.toLowerCase()
  const size = (Object.keys(MATTRESSES) as (keyof typeof MATTRESSES)[]).find((k) => name.includes(k)) ?? (Object.keys(MATTRESSES) as (keyof typeof MATTRESSES)[]).sort((a, b) => Math.abs(MATTRESSES[a][0] - width) - Math.abs(MATTRESSES[b][0] - width))[0]
  const [mw, ml] = MATTRESSES[size]
  const found: Finding[] = []
  if (width < mw - MATTRESS_TOLERANCE.tight || length < ml - MATTRESS_TOLERANCE.tight)
    found.push(
      finding('critical', platform.ids, `El colchón ${size} (${mw} × ${ml} mm) no cabe: la base mide ${roundTo(width, 0)} × ${roundTo(length, 0)} mm.`, { width: roundTo(width, 0), length: roundTo(length, 0), mattress: size }, [
        { key: 'mattress-size', description: `Hacer la base de ${mw} × ${ml} mm`, data: { width: mw, length: ml } },
      ]),
    )
  else if (width > mw + MATTRESS_TOLERANCE.loose || length > ml + MATTRESS_TOLERANCE.loose)
    found.push(finding('recommendation', platform.ids, `La base mide ${roundTo(width, 0)} × ${roundTo(length, 0)} mm y el colchón ${size} ${mw} × ${ml}: le sobra espacio y se va a correr.`, { mattress: size }))
  for (const id of platform.ids) {
    const piece = design.pieces.find((p) => p.id === id)!
    const span = freeSpan(id, geo.boxes.get(id)!, ctx)
    if (span && span > BED_SPAN)
      found.push(
        finding('critical', [id], `${piece.name} cruza ${roundTo(span, 0)} mm sin apoyo: con una persona encima se va a vencer.`, { span: roundTo(span, 0), max: BED_SPAN }, [
          { key: 'center-support', description: 'Agregar un travesaño o una pata al centro, debajo de la base', data: {} },
        ]),
      )
    else if (piece.load !== 'heavy') found.push(finding('recommendation', [id], `${piece.name} carga el colchón y a una persona: márcala con carga pesada para revisar su flecha.`))
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
  if (outside(height, DESK_HEIGHT)) found.push(finding('recommendation', top.ids, `La cubierta queda a ${roundTo(height, 0)} mm; un escritorio cómodo va de ${DESK_HEIGHT[0]} a ${DESK_HEIGHT[1]} mm.`, { height: roundTo(height, 0) }))
  const free = kneeSpace(design, geo, top.box)
  if (free < KNEE.width)
    found.push(
      finding('critical', top.ids, `Debajo de la cubierta no queda espacio para las piernas: hace falta un hueco libre de ${KNEE.width} mm de ancho, ${KNEE.height} de alto y ${KNEE.depth} de fondo, y el más ancho mide ${roundTo(free, 0)} mm.`, { free: roundTo(free, 0) }, [
        { key: 'legroom', description: `Dejar un hueco libre de al menos ${KNEE.width} mm de ancho debajo de la cubierta`, data: { width: KNEE.width } },
      ]),
    )
  return found
}

function table(design: Design, geo: Geometry): Finding[] {
  const top = topSurface(design, geo, 0.1)
  if (!top) return []
  const name = design.name.toLowerCase()
  const kind: TableKind = /centro|caf[eé]/.test(name) ? 'coffee' : /comedor|cocina/.test(name) ? 'dining' : 'side'
  const range = TABLE_HEIGHT[kind]
  const label = { coffee: 'de centro', dining: 'de comedor', side: 'lateral' }[kind]
  return outside(top.box.y1, range) ? [finding('recommendation', top.ids, `Una mesa ${label} va de ${range[0]} a ${range[1]} mm de alto; esta queda a ${roundTo(top.box.y1, 0)} mm.`, { height: roundTo(top.box.y1, 0) })] : []
}

function drawers(design: Design): Finding[] {
  const count = new Set(design.pieces.filter((p) => p.role === 'drawer-front' && p.group).map((p) => p.group)).size
  if (count < 2 || design.dimensions.height <= 700 || design.wallAnchored) return []
  return [
    finding('critical', design.pieces.filter((p) => p.role === 'side').map((p) => p.id), `Con ${count} cajones y ${design.dimensions.height} mm de alto, si se abren varios cajones o un niño se sube, se va de frente. Va anclada al muro.`, { drawers: count }, [
      { key: 'anchor-to-wall', description: 'Anclarla al muro con un kit antivuelco', data: { hardwareId: 'anti-tip-kit' } },
    ]),
  ]
}

function wallCabinet(design: Design): Finding[] {
  const found: Finding[] = []
  if (!design.wallAnchored) found.push(finding('critical', [], 'Una alacena de pared va colgada del muro: márcala como anclada para revisar cómo se sostiene.', {}, [{ key: 'anchor-to-wall', description: 'Colgarla del muro', data: {} }]))
  if (!design.pieces.some((p) => p.role === 'brace'))
    found.push(
      finding('recommendation', [], 'Para colgarla, conviene un listón de triplay arriba y atrás, por dentro: ahí van los tornillos al muro y no en la trasera delgada.', {}, [
        { key: 'hanging-rail', description: 'Agregar un listón de colgar arriba, atrás', data: {} },
      ]),
    )
  return found
}

const minDepth = (design: Design, min: number, message: string): Finding[] =>
  design.dimensions.depth < min ? [finding('recommendation', [], message.replace('{fondo}', String(design.dimensions.depth)), { depth: design.dimensions.depth, min: min })] : []

function wardrobe(design: Design): Finding[] {
  const found = minDepth(design, 550, 'Con {fondo} mm de fondo, los ganchos de ropa no caben de frente; un clóset lleva unos 550–600 mm.')
  if (design.dimensions.height > 1500 && !design.wallAnchored)
    found.push(finding('critical', [], `Un clóset de ${design.dimensions.height} mm de alto va anclado al muro: con las puertas abiertas se puede ir de frente.`, {}, [{ key: 'anchor-to-wall', description: 'Anclarlo al muro', data: {} }]))
  return found
}

function bench(design: Design, geo: Geometry): Finding[] {
  const seat = topSurface(design, geo, 0.05)
  if (!seat) return []
  const found: Finding[] = []
  if (outside(seat.box.y1, BENCH_HEIGHT)) found.push(finding('recommendation', seat.ids, `Un asiento cómodo va de ${BENCH_HEIGHT[0]} a ${BENCH_HEIGHT[1]} mm; este queda a ${roundTo(seat.box.y1, 0)} mm.`))
  for (const id of seat.ids) {
    const piece = design.pieces.find((p) => p.id === id)!
    if (piece.load !== 'heavy') found.push(finding('recommendation', [id], `${piece.name} es asiento: márcalo con carga pesada para revisar su flecha.`))
  }
  return found
}

/** R10: what this kind of furniture needs to be used safely. */
export const typologyRule: Rule = (ctx) => {
  const { design: design, geo } = ctx
  switch (detectKind(design)) {
    case 'bed':
      return bed(design, geo, ctx)
    case 'desk':
      return desk(design, geo)
    case 'table':
      return table(design, geo)
    case 'drawers':
      return drawers(design)
    case 'wallCabinet':
      return wallCabinet(design)
    case 'bookcase':
      return minDepth(design, 230, 'Con {fondo} mm de fondo, los libros grandes quedan de fuera; un librero lleva 230–300 mm.')
    case 'wardrobe':
      return wardrobe(design)
    case 'shoeRack':
      return minDepth(design, 300, 'Con {fondo} mm de fondo, los zapatos de adulto sobresalen; una zapatera lleva 300–350 mm.')
    case 'bench':
      return bench(design, geo)
    default:
      return []
  }
}
