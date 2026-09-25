import { startAt, endAt, makePiece, ref, extent, makeJoint } from '../diseno/builders'
import type { FaceRef, Piece, Joint } from '../diseno/schema'
import { parseFace, type Geometry } from '../diseno/resolve'
import { materialById, type Catalog, type Hardware } from '../materiales/catalog'
import { error, type DesignError } from '../validation/errors'

// A DIY drawer with an inset front and telescopic runners: a four-sided box screwed together, a bottom nailed underneath and a flush front.
// A request's fields are the expert's `agregarCajon` operation and stay as they are.

export const FRONT_GAP = 2
const BOTTOM_GAP = 12
const TOP_GAP = 20
const BACK_CLEARANCE = 10

export interface DrawerRequest {
  grupo: string
  nombre: string
  izquierda: FaceRef
  derecha: FaceRef
  abajo: FaceRef
  arriba: FaceRef
  frente: FaceRef
  fondo: FaceRef
  material: string
  materialFondo: string
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
export function expandDrawer(c: DrawerRequest, geo: Geometry, catalog: Catalog): { piezas: Piece[]; uniones: Joint[] } | DesignError {
  for (const m of [c.material, c.materialFondo]) if (!materialById(catalog, m)) return error('E_ESPESOR_CATALOGO', `El material "${m}" no está en el catálogo.`, { material: m })
  const frontThickness = materialById(catalog, c.material)!.espesor
  const frontZ = geo.measure({ tipo: 'ref', ref: c.frente, mas: 0 }, 'z')
  const backZ = geo.measure({ tipo: 'ref', ref: c.fondo, mas: 0 }, 'z')
  // A drawer opens toward its front: forward as usual, or backward when the front is behind the bottom of the opening (the far side of a bed).
  const backward = frontZ < backZ
  const depth = Math.abs(frontZ - backZ) - frontThickness
  const runner = runnerFor(depth, catalog)
  if (!runner) {
    const shortest = Math.min(...runners(catalog).map((c) => c.largo))
    const missing = Math.ceil(shortest + BACK_CLEARANCE - depth)
    return error('E_OPERACION_INVALIDA', `No cabe un cajón: quedan ${Math.round(depth)} mm de fondo y la corredera más corta, de ${shortest / 10} cm, pide ${missing} mm más. Hazlo más profundo o usa una puerta.`, {
      depth: Math.round(depth),
      missing: missing,
    })
  }
  const width = geo.measure({ tipo: 'ref', ref: c.derecha, mas: 0 }, 'x') - geo.measure({ tipo: 'ref', ref: c.izquierda, mas: 0 }, 'x')
  const height = geo.measure({ tipo: 'ref', ref: c.arriba, mas: 0 }, 'y') - geo.measure({ tipo: 'ref', ref: c.abajo, mas: 0 }, 'y')
  if (width < 2 * runner.holguraLateral + 150 || height < BOTTOM_GAP + TOP_GAP + 60)
    return error('E_OPERACION_INVALIDA', `El hueco de ${Math.round(width)} × ${Math.round(height)} mm es muy chico para un cajón.`, { width: Math.round(width), height: Math.round(height) })

  const g = c.grupo
  const id = (part: string) => `${g}-${part}`
  const gap = runner.holguraLateral
  const shared = { material: c.material, grupo: g, confianza: 'alta' as const }
  /** The box runs from behind the front, as long as the runner. */
  const box = () => (backward ? extent(ref(`${id('frente')}.z1`), null, runner.largo) : extent(null, ref(`${id('frente')}.z0`), runner.largo))
  const pieces: Piece[] = [
    makePiece({
      ...shared,
      id: id('frente'),
      nombre: `Frente de ${c.nombre.toLowerCase()}`,
      rol: 'frente-cajon',
      normal: 'z',
      x: extent(ref(c.izquierda, FRONT_GAP), ref(c.derecha, -FRONT_GAP)),
      y: extent(ref(c.abajo, FRONT_GAP), ref(c.arriba, -FRONT_GAP)),
      z: backward ? startAt(ref(c.frente)) : endAt(ref(c.frente)),
      cantos: ['frente', 'izq', 'der', 'arriba', 'abajo'],
    }),
    makePiece({ ...shared, material: c.materialFondo, id: id('fondo'), nombre: `Fondo de ${c.nombre.toLowerCase()}`, rol: 'fondo-cajon', normal: 'y', x: extent(ref(c.izquierda, gap), ref(c.derecha, -gap)), y: startAt(ref(c.abajo, BOTTOM_GAP)), z: box(), veta: 'libre' }),
    makePiece({ ...shared, id: id('costado-izq'), nombre: `Costado izquierdo de ${c.nombre.toLowerCase()}`, rol: 'costado-cajon', normal: 'x', x: startAt(ref(c.izquierda, gap)), y: extent(ref(`${id('fondo')}.y1`), ref(c.arriba, -TOP_GAP)), z: box(), cantos: ['arriba'] }),
    makePiece({ ...shared, id: id('costado-der'), nombre: `Costado derecho de ${c.nombre.toLowerCase()}`, rol: 'costado-cajon', normal: 'x', x: endAt(ref(c.derecha, -gap)), y: extent(ref(`${id('fondo')}.y1`), ref(c.arriba, -TOP_GAP)), z: box(), cantos: ['arriba'] }),
    makePiece({ ...shared, id: id('contra'), nombre: `Contrafrente de ${c.nombre.toLowerCase()}`, rol: 'costado-cajon', normal: 'z', x: extent(ref(`${id('costado-izq')}.x1`), ref(`${id('costado-der')}.x0`)), y: extent(ref(`${id('fondo')}.y1`), ref(c.arriba, -TOP_GAP)), z: backward ? startAt(ref(`${id('frente')}.z1`)) : endAt(ref(`${id('frente')}.z0`)), cantos: ['arriba'] }),
    makePiece({ ...shared, id: id('trasera'), nombre: `Trasera de ${c.nombre.toLowerCase()}`, rol: 'costado-cajon', normal: 'z', x: extent(ref(`${id('costado-izq')}.x1`), ref(`${id('costado-der')}.x0`)), y: extent(ref(`${id('fondo')}.y1`), ref(c.arriba, -TOP_GAP)), z: backward ? endAt(ref(`${id('costado-izq')}.z1`)) : startAt(ref(`${id('costado-izq')}.z0`)), cantos: ['arriba'] }),
  ]

  const screw = [{ herrajeId: 'tornillo-8x2', cantidad: null }]
  const joints: Joint[] = [
    ...['contra', 'trasera'].flatMap((b) => ['costado-izq', 'costado-der'].map((a) => makeJoint(`u-${g}-${a}-${b}`, id(a), id(b), 'tope-tornillo', screw))),
    makeJoint(`u-${g}-contra-frente`, id('contra'), id('frente'), 'tope-tornillo', [{ herrajeId: 'tornillo-8x1', cantidad: 4 }]),
    ...['costado-izq', 'costado-der', 'contra', 'trasera'].map((b) => makeJoint(`u-${g}-fondo-${b}`, id('fondo'), id(b), 'clavo-pegamento', [{ herrajeId: 'clavo-sin-cabeza-1', cantidad: null }])),
  ]
  const leftSupport = parseFace(c.izquierda).piece
  const rightSupport = parseFace(c.derecha).piece
  if (leftSupport !== 'mueble') joints.push(makeJoint(`u-${g}-corredera-izq`, id('costado-izq'), leftSupport, 'corredera', [{ herrajeId: runner.id, cantidad: 1 }]))
  if (rightSupport !== 'mueble') joints.push(makeJoint(`u-${g}-corredera-der`, id('costado-der'), rightSupport, 'corredera', []))
  return { piezas: pieces, uniones: joints }
}
