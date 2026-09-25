import { startAt, endAt, makePiece, ref, extent, makeJoint } from '../diseno/builders'
import type { FaceRef, Piece, Joint } from '../diseno/schema'
import { parseFace, type Geometry } from '../diseno/resolve'
import { materialById, type Catalog, type Hardware } from '../materiales/catalog'
import { error, type DesignError } from '../validation/errors'

// A DIY drawer with an inset front and telescopic runners: a four-sided box screwed together, a bottom nailed underneath and a flush front.
// A request's fields are the expert's `addDrawer` operation.

export const FRONT_GAP = 2
const BOTTOM_GAP = 12
const TOP_GAP = 20
const BACK_CLEARANCE = 10

export interface DrawerRequest {
  group: string
  name: string
  left: FaceRef
  right: FaceRef
  bottom: FaceRef
  top: FaceRef
  front: FaceRef
  back: FaceRef
  material: string
  bottomMaterial: string
}

export const runners = (catalog: Catalog) =>
  catalog.herrajes.filter((h): h is Hardware & { largo: number; holguraLateral: number } => h.id.startsWith('corredera') && h.largo !== null && h.holguraLateral !== null)

/** The longest runner that fits the depth there is. */
export function runnerFor(depth: number, catalog: Catalog) {
  return runners(catalog)
    .filter((c) => c.largo <= depth - BACK_CLEARANCE)
    .sort((a, b) => b.largo - a.largo)[0]
}

/** The drawer's pieces and joints, all tied to the faces of the opening so they follow when the furniture changes. */
export function expandDrawer(c: DrawerRequest, geo: Geometry, catalog: Catalog): { pieces: Piece[]; joints: Joint[] } | DesignError {
  for (const m of [c.material, c.bottomMaterial]) if (!materialById(catalog, m)) return error('E_UNKNOWN_MATERIAL', `El material "${m}" no está en el catálogo.`, { material: m })
  const frontThickness = materialById(catalog, c.material)!.espesor
  const frontZ = geo.measure({ type: 'ref', ref: c.front, offset: 0 }, 'z')
  const backZ = geo.measure({ type: 'ref', ref: c.back, offset: 0 }, 'z')
  // A drawer opens toward its front: forward as usual, or backward when the front is behind the bottom of the opening (the far side of a bed).
  const backward = frontZ < backZ
  const depth = Math.abs(frontZ - backZ) - frontThickness
  const runner = runnerFor(depth, catalog)
  if (!runner) {
    const shortest = Math.min(...runners(catalog).map((c) => c.largo))
    const missing = Math.ceil(shortest + BACK_CLEARANCE - depth)
    return error('E_INVALID_OPERATION', `No cabe un cajón: quedan ${Math.round(depth)} mm de fondo y la corredera más corta, de ${shortest / 10} cm, pide ${missing} mm más. Hazlo más profundo o usa una puerta.`, {
      depth: Math.round(depth),
      missing: missing,
    })
  }
  const width = geo.measure({ type: 'ref', ref: c.right, offset: 0 }, 'x') - geo.measure({ type: 'ref', ref: c.left, offset: 0 }, 'x')
  const height = geo.measure({ type: 'ref', ref: c.top, offset: 0 }, 'y') - geo.measure({ type: 'ref', ref: c.bottom, offset: 0 }, 'y')
  if (width < 2 * runner.holguraLateral + 150 || height < BOTTOM_GAP + TOP_GAP + 60)
    return error('E_INVALID_OPERATION', `El hueco de ${Math.round(width)} × ${Math.round(height)} mm es muy chico para un cajón.`, { width: Math.round(width), height: Math.round(height) })

  const g = c.group
  const id = (part: string) => `${g}-${part}`
  const gap = runner.holguraLateral
  const shared = { material: c.material, group: g, confidence: 'high' as const }
  /** The box runs from behind the front, as long as the runner. */
  const box = () => (backward ? extent(ref(`${id('frente')}.z1`), null, runner.largo) : extent(null, ref(`${id('frente')}.z0`), runner.largo))
  const pieces: Piece[] = [
    makePiece({
      ...shared,
      id: id('frente'),
      name: `Frente de ${c.name.toLowerCase()}`,
      role: 'drawer-front',
      normal: 'z',
      x: extent(ref(c.left, FRONT_GAP), ref(c.right, -FRONT_GAP)),
      y: extent(ref(c.bottom, FRONT_GAP), ref(c.top, -FRONT_GAP)),
      z: backward ? startAt(ref(c.front)) : endAt(ref(c.front)),
      edges: ['front', 'left', 'right', 'top', 'bottom'],
    }),
    makePiece({ ...shared, material: c.bottomMaterial, id: id('fondo'), name: `Fondo de ${c.name.toLowerCase()}`, role: 'drawer-bottom', normal: 'y', x: extent(ref(c.left, gap), ref(c.right, -gap)), y: startAt(ref(c.bottom, BOTTOM_GAP)), z: box(), grain: 'any' }),
    makePiece({ ...shared, id: id('costado-izq'), name: `Costado izquierdo de ${c.name.toLowerCase()}`, role: 'drawer-side', normal: 'x', x: startAt(ref(c.left, gap)), y: extent(ref(`${id('fondo')}.y1`), ref(c.top, -TOP_GAP)), z: box(), edges: ['top'] }),
    makePiece({ ...shared, id: id('costado-der'), name: `Costado derecho de ${c.name.toLowerCase()}`, role: 'drawer-side', normal: 'x', x: endAt(ref(c.right, -gap)), y: extent(ref(`${id('fondo')}.y1`), ref(c.top, -TOP_GAP)), z: box(), edges: ['top'] }),
    makePiece({ ...shared, id: id('contra'), name: `Contrafrente de ${c.name.toLowerCase()}`, role: 'drawer-side', normal: 'z', x: extent(ref(`${id('costado-izq')}.x1`), ref(`${id('costado-der')}.x0`)), y: extent(ref(`${id('fondo')}.y1`), ref(c.top, -TOP_GAP)), z: backward ? startAt(ref(`${id('frente')}.z1`)) : endAt(ref(`${id('frente')}.z0`)), edges: ['top'] }),
    makePiece({ ...shared, id: id('trasera'), name: `Trasera de ${c.name.toLowerCase()}`, role: 'drawer-side', normal: 'z', x: extent(ref(`${id('costado-izq')}.x1`), ref(`${id('costado-der')}.x0`)), y: extent(ref(`${id('fondo')}.y1`), ref(c.top, -TOP_GAP)), z: backward ? endAt(ref(`${id('costado-izq')}.z1`)) : startAt(ref(`${id('costado-izq')}.z0`)), edges: ['top'] }),
  ]

  const screw = [{ hardwareId: 'tornillo-8x2', count: null }]
  const joints: Joint[] = [
    ...['contra', 'trasera'].flatMap((b) => ['costado-izq', 'costado-der'].map((a) => makeJoint(`u-${g}-${a}-${b}`, id(a), id(b), 'butt-screw', screw))),
    makeJoint(`u-${g}-contra-frente`, id('contra'), id('frente'), 'butt-screw', [{ hardwareId: 'tornillo-8x1', count: 4 }]),
    ...['costado-izq', 'costado-der', 'contra', 'trasera'].map((b) => makeJoint(`u-${g}-fondo-${b}`, id('fondo'), id(b), 'glue-nail', [{ hardwareId: 'clavo-sin-cabeza-1', count: null }])),
  ]
  const leftSupport = parseFace(c.left).piece
  const rightSupport = parseFace(c.right).piece
  if (leftSupport !== 'mueble') joints.push(makeJoint(`u-${g}-corredera-izq`, id('costado-izq'), leftSupport, 'drawer-slide', [{ hardwareId: runner.id, count: 1 }]))
  if (rightSupport !== 'mueble') joints.push(makeJoint(`u-${g}-corredera-der`, id('costado-der'), rightSupport, 'drawer-slide', []))
  return { pieces, joints }
}
