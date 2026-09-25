import { materialById, type Catalog } from '../materiales/catalog'
import { error, success, failure, type DesignError, type Result } from '../validation/errors'
import { DIMENSION_OF_AXIS, AXES, type FaceRef, type Position, type Design, type Axis, type Piece, type Extent } from './schema'

// From references to numbers: each piece's box in millimetres, following the faces it is tied to.

export interface Box {
  x0: number
  x1: number
  y0: number
  y1: number
  z0: number
  z1: number
}

export interface Geometry {
  boxes: Map<string, Box>
  thicknesses: Map<string, number>
  /** Where a cota lands in the resolved design. */
  measure: (cota: Position, axis: Axis) => number
}

const TOLERANCE = 0.5

class ResolveFailure extends Error {
  constructor(readonly detail: DesignError) {
    super(detail.message)
  }
}

export const faceAxes = (normal: Axis) => AXES.filter((e) => e !== normal) as [Axis, Axis]

export function parseFace(face: FaceRef) {
  const [piece, which] = face.split('.')
  return { piece, axis: which[0] as Axis, side: Number(which[1]) as 0 | 1 }
}

export const referencedPieces = (extent: Extent) =>
  [extent.desde, extent.hasta].flatMap((c) => (!c ? [] : c.tipo === 'ref' ? [c.ref] : c.tipo === 'entre' ? [c.a, c.b] : [])).map((r) => parseFace(r).piece)

export function resolveGeometry(design: Design, catalog: Catalog): Result<Geometry> {
  const byId = new Map(design.piezas.map((p) => [p.id, p]))
  const extents = new Map<string, [number, number]>()
  const visiting: string[] = []

  const thicknessOf = (p: Piece) => {
    const material = materialById(catalog, p.material)
    if (!material) throw new ResolveFailure(error('E_ESPESOR_CATALOGO', `"${p.id}" usa el material "${p.material}", que no está en el catálogo.`, { pieza: p.id, material: p.material }))
    return material.espesor
  }

  const face = (ref: FaceRef, axis: Axis, who: string): number => {
    const { piece, axis: refAxis, side } = parseFace(ref)
    if (refAxis !== axis) throw new ResolveFailure(error('E_REF_EJE', `"${who}" usa "${ref}" en el eje ${axis}; una cota solo puede referir caras del mismo eje.`, { pieza: who, ref, eje: axis }))
    if (piece === 'mueble') return side === 0 ? 0 : design.dimensiones[DIMENSION_OF_AXIS[axis]]
    const other = byId.get(piece)
    if (!other) throw new ResolveFailure(error('E_REF_INEXISTENTE', `"${who}" refiere "${ref}", pero no existe la pieza "${piece}".`, { pieza: who, ref }))
    return extentOf(other, axis)[side]
  }

  const value = (cota: Position, axis: Axis, who: string): number => {
    if (cota.tipo === 'mm') return cota.mm
    if (cota.tipo === 'ref') return face(cota.ref, axis, who) + cota.mas
    const a = face(cota.a, axis, who)
    return a + cota.t * (face(cota.b, axis, who) - a) + cota.mas
  }

  function extentOf(p: Piece, axis: Axis): [number, number] {
    const key = `${p.id}.${axis}`
    const done = extents.get(key)
    if (done) return done
    if (visiting.includes(key)) {
      const cycle = [...visiting.slice(visiting.indexOf(key)), key]
      throw new ResolveFailure(error('E_CICLO', `Referencias circulares: ${cycle.join(' → ')}.`, { ciclo: cycle }))
    }
    visiting.push(key)
    try {
      const result = axis === p.normal ? normalExtent(p, axis) : faceExtent(p, axis)
      if (result[1] - result[0] <= 0)
        throw new ResolveFailure(error('E_TRAMO_INVALIDO', `"${p.id}" queda con largo ${roundTo(result[1] - result[0])} mm en el eje ${axis}.`, { pieza: p.id, eje: axis, desde: result[0], hasta: result[1] }))
      extents.set(key, result)
      return result
    } finally {
      visiting.pop()
    }
  }

  /** Along its normal a piece is as thick as its board: one end is enough. */
  function normalExtent(p: Piece, axis: Axis): [number, number] {
    const thickness = thicknessOf(p)
    const { desde: start, hasta: end } = p[axis]
    if (start) {
      const s = value(start, axis, p.id)
      if (end && Math.abs(value(end, axis, p.id) - s - thickness) > TOLERANCE)
        throw new ResolveFailure(error('E_TRAMO_INVALIDO', `En su eje normal (${axis}) "${p.id}" debe llevar solo desde o solo hasta; el largo es su espesor de ${thickness} mm.`, { pieza: p.id, eje: axis }))
      return [s, s + thickness]
    }
    if (end) {
      const e = value(end, axis, p.id)
      return [e - thickness, e]
    }
    throw new ResolveFailure(error('E_TRAMO_INVALIDO', `"${p.id}" no tiene posición en su eje normal (${axis}).`, { pieza: p.id, eje: axis }))
  }

  /** Across its face a piece needs two of: where it starts, where it ends, how long it is. */
  function faceExtent(p: Piece, axis: Axis): [number, number] {
    const { desde: start, hasta: end, largo: length } = p[axis]
    if (start && end) {
      const s = value(start, axis, p.id)
      const e = value(end, axis, p.id)
      if (length !== null && Math.abs(e - s - length) > TOLERANCE)
        throw new ResolveFailure(error('E_TRAMO_INVALIDO', `"${p.id}" en ${axis}: desde, hasta y largo no coinciden (${roundTo(e - s)} ≠ ${length}).`, { pieza: p.id, eje: axis }))
      return [s, e]
    }
    if (start && length !== null) {
      const s = value(start, axis, p.id)
      return [s, s + length]
    }
    if (end && length !== null) {
      const e = value(end, axis, p.id)
      return [e - length, e]
    }
    throw new ResolveFailure(error('E_TRAMO_INVALIDO', `"${p.id}" en ${axis} necesita dos de: desde, hasta, largo.`, { pieza: p.id, eje: axis }))
  }

  const errors: DesignError[] = []
  const boxes = new Map<string, Box>()
  const thicknesses = new Map<string, number>()
  const seen = new Set<string>()
  for (const p of design.piezas) {
    if (seen.has(p.id)) errors.push(error('E_ID_DUPLICADO', `Hay dos piezas con el id "${p.id}".`, { pieza: p.id }))
    seen.add(p.id)
    const perAxis = AXES.map((axis) => {
      try {
        return extentOf(p, axis)
      } catch (e) {
        if (!(e instanceof ResolveFailure)) throw e
        if (!errors.some((other) => other.message === e.detail.message)) errors.push(e.detail)
        return null
      }
    })
    if (perAxis.some((t) => !t)) continue
    const [[x0, x1], [y0, y1], [z0, z1]] = perAxis as [number, number][]
    boxes.set(p.id, { x0, x1, y0, y1, z0, z1 })
    thicknesses.set(p.id, thicknessOf(p))
  }
  if (errors.length) return failure(errors)
  return success({ boxes, thicknesses, measure: (cota, axis) => value(cota, axis, 'consulta') })
}

export const roundTo = (mm: number, decimals = 1) => Math.round(mm * 10 ** decimals) / 10 ** decimals

export const sizeOf = (box: Box) => ({ x: box.x1 - box.x0, y: box.y1 - box.y0, z: box.z1 - box.z0 })

/** The two measures of a piece's face, larger first. */
export function faceSize(box: Box, normal: Axis): [number, number] {
  const m = sizeOf(box)
  const [a, b] = faceAxes(normal).map((e) => m[e])
  return a >= b ? [a, b] : [b, a]
}
