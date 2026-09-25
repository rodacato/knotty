import { startAt, endAt, makePiece, ref, extent, makeJoint } from '../design/builders'
import type { FaceRef, Piece, Joint } from '../design/schema'
import { parseFace, type Geometry } from '../design/resolve'
import { materialById, type Catalog, type Hardware } from '../materials/catalog'
import { error, type DesignError } from '../validation/errors'

// A DIY drawer with an inset front and telescopic runners: a four-sided box screwed together, a bottom nailed underneath and a flush front.
// A request's fields are the expert's `addDrawer` operation.

const FRONT_GAP = 2
const BOTTOM_GAP = 12
const TOP_GAP = 20
const BACK_CLEARANCE = 10

interface DrawerRequest {
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

const runners = (catalog: Catalog) =>
  catalog.hardware.filter((h): h is Hardware & { length: number; sideClearance: number } => h.id.startsWith('drawer-slide') && h.length !== null && h.sideClearance !== null)

/** The longest runner that fits the depth there is. */
function runnerFor(depth: number, catalog: Catalog) {
  return runners(catalog)
    .filter((c) => c.length <= depth - BACK_CLEARANCE)
    .sort((a, b) => b.length - a.length)[0]
}

/** The drawer's pieces and joints, all tied to the faces of the opening so they follow when the furniture changes. */
export function expandDrawer(c: DrawerRequest, geo: Geometry, catalog: Catalog): { pieces: Piece[]; joints: Joint[] } | DesignError {
  for (const m of [c.material, c.bottomMaterial]) if (!materialById(catalog, m)) return error('E_UNKNOWN_MATERIAL', `El material "${m}" no está en el catálogo.`, { material: m })
  const frontThickness = materialById(catalog, c.material)!.thickness
  const frontZ = geo.measure({ type: 'ref', ref: c.front, offset: 0 }, 'z')
  const backZ = geo.measure({ type: 'ref', ref: c.back, offset: 0 }, 'z')
  // A drawer opens toward its front: forward as usual, or backward when the front is behind the bottom of the opening (the far side of a bed).
  const backward = frontZ < backZ
  const depth = Math.abs(frontZ - backZ) - frontThickness
  const runner = runnerFor(depth, catalog)
  if (!runner) {
    const shortest = Math.min(...runners(catalog).map((c) => c.length))
    const missing = Math.ceil(shortest + BACK_CLEARANCE - depth)
    return error('E_INVALID_OPERATION', `No cabe un cajón: quedan ${Math.round(depth)} mm de fondo y la corredera más corta, de ${shortest / 10} cm, pide ${missing} mm más. Hazlo más profundo o usa una puerta.`, {
      depth: Math.round(depth),
      missing: missing,
    })
  }
  const width = geo.measure({ type: 'ref', ref: c.right, offset: 0 }, 'x') - geo.measure({ type: 'ref', ref: c.left, offset: 0 }, 'x')
  const height = geo.measure({ type: 'ref', ref: c.top, offset: 0 }, 'y') - geo.measure({ type: 'ref', ref: c.bottom, offset: 0 }, 'y')
  if (width < 2 * runner.sideClearance + 150 || height < BOTTOM_GAP + TOP_GAP + 60)
    return error('E_INVALID_OPERATION', `El hueco de ${Math.round(width)} × ${Math.round(height)} mm es muy chico para un cajón.`, { width: Math.round(width), height: Math.round(height) })

  const g = c.group
  const id = (part: string) => `${g}-${part}`
  const gap = runner.sideClearance
  const shared = { material: c.material, group: g, confidence: 'high' as const }
  /** The box runs from behind the front, as long as the runner. */
  const box = () => (backward ? extent(ref(`${id('front')}.z1`), null, runner.length) : extent(null, ref(`${id('front')}.z0`), runner.length))
  const pieces: Piece[] = [
    makePiece({
      ...shared,
      id: id('front'),
      name: `Frente de ${c.name.toLowerCase()}`,
      role: 'drawer-front',
      normal: 'z',
      x: extent(ref(c.left, FRONT_GAP), ref(c.right, -FRONT_GAP)),
      y: extent(ref(c.bottom, FRONT_GAP), ref(c.top, -FRONT_GAP)),
      z: backward ? startAt(ref(c.front)) : endAt(ref(c.front)),
      edges: ['front', 'left', 'right', 'top', 'bottom'],
    }),
    makePiece({ ...shared, material: c.bottomMaterial, id: id('bottom'), name: `Fondo de ${c.name.toLowerCase()}`, role: 'drawer-bottom', normal: 'y', x: extent(ref(c.left, gap), ref(c.right, -gap)), y: startAt(ref(c.bottom, BOTTOM_GAP)), z: box(), grain: 'any' }),
    makePiece({ ...shared, id: id('side-left'), name: `Costado izquierdo de ${c.name.toLowerCase()}`, role: 'drawer-side', normal: 'x', x: startAt(ref(c.left, gap)), y: extent(ref(`${id('bottom')}.y1`), ref(c.top, -TOP_GAP)), z: box(), edges: ['top'] }),
    makePiece({ ...shared, id: id('side-right'), name: `Costado derecho de ${c.name.toLowerCase()}`, role: 'drawer-side', normal: 'x', x: endAt(ref(c.right, -gap)), y: extent(ref(`${id('bottom')}.y1`), ref(c.top, -TOP_GAP)), z: box(), edges: ['top'] }),
    makePiece({ ...shared, id: id('subfront'), name: `Contrafrente de ${c.name.toLowerCase()}`, role: 'drawer-side', normal: 'z', x: extent(ref(`${id('side-left')}.x1`), ref(`${id('side-right')}.x0`)), y: extent(ref(`${id('bottom')}.y1`), ref(c.top, -TOP_GAP)), z: backward ? startAt(ref(`${id('front')}.z1`)) : endAt(ref(`${id('front')}.z0`)), edges: ['top'] }),
    makePiece({ ...shared, id: id('back'), name: `Trasera de ${c.name.toLowerCase()}`, role: 'drawer-side', normal: 'z', x: extent(ref(`${id('side-left')}.x1`), ref(`${id('side-right')}.x0`)), y: extent(ref(`${id('bottom')}.y1`), ref(c.top, -TOP_GAP)), z: backward ? endAt(ref(`${id('side-left')}.z1`)) : startAt(ref(`${id('side-left')}.z0`)), edges: ['top'] }),
  ]

  const screw = [{ hardwareId: 'screw-8x2', count: null }]
  const joints: Joint[] = [
    ...['subfront', 'back'].flatMap((b) => ['side-left', 'side-right'].map((a) => makeJoint(`j-${g}-${a}-${b}`, id(a), id(b), 'butt-screw', screw))),
    makeJoint(`j-${g}-subfront-front`, id('subfront'), id('front'), 'butt-screw', [{ hardwareId: 'screw-8x1', count: 4 }]),
    ...['side-left', 'side-right', 'subfront', 'back'].map((b) => makeJoint(`j-${g}-bottom-${b}`, id('bottom'), id(b), 'glue-nail', [{ hardwareId: 'brad-nail-1', count: null }])),
  ]
  const leftSupport = parseFace(c.left).piece
  const rightSupport = parseFace(c.right).piece
  if (leftSupport !== 'furniture') joints.push(makeJoint(`j-${g}-slide-left`, id('side-left'), leftSupport, 'drawer-slide', [{ hardwareId: runner.id, count: 1 }]))
  if (rightSupport !== 'furniture') joints.push(makeJoint(`j-${g}-slide-right`, id('side-right'), rightSupport, 'drawer-slide', []))
  return { pieces, joints }
}
