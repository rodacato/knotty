import { partway } from '../diseno/builders'
import { DIMENSION_OF_AXIS, AXES, type Position, type Design, type Axis, type Piece, type Extent } from '../diseno/schema'
import { parseFace, resolveGeometry, type Geometry } from '../diseno/resolve'
import { materialById, type Catalog } from '../materiales/catalog'
import { contactBetween } from '../validation/contact'
import { error, success, failure, type DesignWarning, type DesignError, type Result } from '../validation/errors'
import { expandDrawer } from './drawer'
import type { Operation } from './schema'

// The operations the expert (or Knotty) asks for, applied in order on a copy. Their names and fields are the expert's and stay as they are.

export interface Applied {
  design: Design
  warnings: DesignWarning[]
}

class InvalidOperation extends Error {
  constructor(readonly detail: DesignError) {
    super(detail.message)
  }
}

const invalid = (code: DesignError['code'], message: string, data?: Record<string, unknown>) => new InvalidOperation(error(code, message, data))

const refersTo = (cota: Position | null, id: string) =>
  !!cota && ((cota.tipo === 'ref' && parseFace(cota.ref).piece === id) || (cota.tipo === 'entre' && [cota.a, cota.b].some((r) => parseFace(r).piece === id)))

/** Applies the operations in order on a copy. If one fails, none is applied. */
export function applyOperations(original: Design, operations: Operation[], catalog: Catalog): Result<Applied> {
  const design = structuredClone(original)
  const warnings: DesignWarning[] = []

  const geometry = (): Geometry => {
    const r = resolveGeometry(design, catalog)
    if (!r.ok) throw new InvalidOperation(r.errors[0])
    return r.value
  }
  const piece = (id: string) => {
    const p = design.piezas.find((x) => x.id === id)
    if (!p) throw invalid('E_PIEZA_INEXISTENTE', `No existe la pieza "${id}".`, { pieza: id })
    return p
  }
  const assertFreeId = (id: string) => {
    if (design.piezas.some((p) => p.id === id)) throw invalid('E_ID_DUPLICADO', `Ya existe una pieza "${id}".`, { pieza: id })
  }

  /** Removing a piece freezes in millimetres whatever was tied to its faces, so nothing else moves. */
  function remove(id: string) {
    piece(id)
    const geo = geometry()
    const frozen = new Set<string>()
    for (const p of design.piezas) {
      if (p.id === id) continue
      for (const axis of AXES)
        for (const end of ['desde', 'hasta'] as const) {
          const cota = p[axis][end]
          if (!refersTo(cota, id)) continue
          p[axis][end] = { tipo: 'mm', mm: geo.measure(cota!, axis) }
          frozen.add(p.id)
        }
    }
    design.piezas = design.piezas.filter((p) => p.id !== id)
    design.uniones = design.uniones.filter((u) => u.a !== id && u.b !== id)
    if (frozen.size)
      warnings.push({ code: 'A_REFERENCIA_CONGELADA', message: `Al quitar "${id}", ${[...frozen].join(', ')} quedaron fijas en mm.`, data: { pieza: id, afectadas: [...frozen] } })
  }

  function place(p: Piece, axis: Axis, cota: Position, length: number) {
    p[axis] = axis === p.normal ? { desde: cota, hasta: null, largo: null } : { desde: cota, hasta: null, largo: length }
  }
  const lengthOf = (id: string, axis: Axis, geo: Geometry) => geo.boxes.get(id)![`${axis}1`] - geo.boxes.get(id)![`${axis}0`]

  const applyOne = (op: Operation) => {
    switch (op.op) {
      case 'agregarPieza':
        assertFreeId(op.pieza.id)
        design.piezas.push(structuredClone(op.pieza))
        return
      case 'eliminarPieza':
        return remove(op.id)
      case 'eliminarGrupo': {
        const ids = design.piezas.filter((p) => p.grupo === op.grupo).map((p) => p.id)
        if (!ids.length) throw invalid('E_PIEZA_INEXISTENTE', `No hay piezas en el grupo "${op.grupo}".`, { grupo: op.grupo })
        return ids.forEach(remove)
      }
      case 'duplicarPieza': {
        const source = piece(op.id)
        assertFreeId(op.nuevoId)
        const geo = geometry()
        const copy: Piece = { ...structuredClone(source), id: op.nuevoId, nombre: op.nombre }
        place(copy, op.eje, op.cota, lengthOf(op.id, op.eje, geo))
        design.piezas.push(copy)
        const copied = design.uniones
          .filter((u) => u.a === op.id || u.b === op.id)
          .map((u) => ({ ...structuredClone(u), id: `${u.id}-${op.nuevoId}`, a: u.a === op.id ? op.nuevoId : u.a, b: u.b === op.id ? op.nuevoId : u.b }))
        const after = resolveGeometry(design, catalog)
        // A copied joint stays only where the copy still touches that piece.
        design.uniones.push(
          ...copied.filter((u) => {
            if (!after.ok) return true
            const { boxes } = after.value
            return !!boxes.get(u.a) && !!boxes.get(u.b) && !!contactBetween(u.a, boxes.get(u.a)!, u.b, boxes.get(u.b)!)
          }),
        )
        return
      }
      case 'redimensionar': {
        const p = piece(op.id)
        if (op.eje === p.normal) throw invalid('E_OPERACION_INVALIDA', `"${p.id}" tiene su espesor en ${op.eje}; para eso usa cambiarEspesor o mover.`, { pieza: p.id, eje: op.eje })
        const box = geometry().boxes.get(p.id)!
        const current = p[op.eje]
        const next: Extent =
          op.extremo === 'desde'
            ? { desde: op.cota, hasta: current.hasta ?? { tipo: 'mm', mm: box[`${op.eje}1`] }, largo: null }
            : { desde: current.desde ?? { tipo: 'mm', mm: box[`${op.eje}0`] }, hasta: op.cota, largo: null }
        p[op.eje] = next
        return
      }
      case 'mover': {
        const p = piece(op.id)
        return place(p, op.eje, op.cota, lengthOf(p.id, op.eje, geometry()))
      }
      case 'distribuir': {
        const pieces = op.ids.map(piece)
        const across = pieces.find((p) => p.normal !== op.eje)
        if (across) throw invalid('E_OPERACION_INVALIDA', `Solo se reparte en el eje del espesor; "${across.id}" lo tiene en ${across.normal}.`, { pieza: across.id, eje: op.eje })
        const geo = geometry()
        const n = pieces.length
        pieces
          .sort((a, b) => geo.boxes.get(a.id)![`${op.eje}0`] - geo.boxes.get(b.id)![`${op.eje}0`])
          .forEach((p, i) => {
            const thickness = geo.thicknesses.get(p.id)!
            p[op.eje] = { desde: partway(op.a, op.b, (i + 1) / (n + 1), (thickness * (i - n)) / (n + 1)), hasta: null, largo: null }
          })
        return
      }
      case 'cambiarEspesor': {
        if (!materialById(catalog, op.material)) throw invalid('E_ESPESOR_CATALOGO', `El material "${op.material}" no está en el catálogo.`, { material: op.material })
        return op.ids.forEach((id) => (piece(id).material = op.material))
      }
      case 'cambiarPropiedades': {
        const p = piece(op.id)
        for (const field of ['nombre', 'rol', 'veta', 'carga', 'apoyo', 'cantos', 'confianza'] as const) if (op[field] !== null) Object.assign(p, { [field]: op[field] })
        return
      }
      case 'agregarUnion':
        if (design.uniones.some((u) => u.id === op.union.id)) throw invalid('E_ID_DUPLICADO', `Ya existe una unión "${op.union.id}".`, { union: op.union.id })
        design.uniones.push(structuredClone(op.union))
        return
      case 'cambiarUnion': {
        const i = design.uniones.findIndex((u) => u.id === op.union.id)
        if (i < 0) throw invalid('E_UNION_INEXISTENTE', `No existe la unión "${op.union.id}".`, { union: op.union.id })
        design.uniones[i] = structuredClone(op.union)
        return
      }
      case 'eliminarUnion':
        if (!design.uniones.some((u) => u.id === op.id)) throw invalid('E_UNION_INEXISTENTE', `No existe la unión "${op.id}".`, { union: op.id })
        design.uniones = design.uniones.filter((u) => u.id !== op.id)
        return
      case 'cambiarDimensionGlobal': {
        const key = DIMENSION_OF_AXIS[op.eje]
        const factor = op.valor / design.dimensiones[key]
        design.dimensiones[key] = op.valor
        if (op.regla === 'proporcional')
          for (const p of design.piezas) {
            const t = p[op.eje]
            for (const end of ['desde', 'hasta'] as const) {
              const cota = t[end]
              if (cota?.tipo === 'mm') t[end] = { tipo: 'mm', mm: cota.mm * factor }
            }
            if (t.largo !== null && op.eje !== p.normal) t.largo *= factor
          }
        return
      }
      case 'cambiarAnclajeMuro':
        design.anclajeMuro = op.valor
        return
      case 'agregarCajon': {
        if (design.piezas.some((p) => p.grupo === op.grupo)) throw invalid('E_ID_DUPLICADO', `Ya existe un cajón "${op.grupo}".`, { grupo: op.grupo })
        const drawer = expandDrawer(op, geometry(), catalog)
        if ('code' in drawer) throw new InvalidOperation(drawer)
        for (const p of drawer.piezas) assertFreeId(p.id)
        design.piezas.push(...drawer.piezas)
        design.uniones.push(...drawer.uniones)
        return
      }
    }
  }

  for (const [i, op] of operations.entries()) {
    try {
      applyOne(op)
    } catch (e) {
      if (!(e instanceof InvalidOperation)) throw e
      return failure([{ ...e.detail, data: { ...e.detail.data, operacion: i, op: op.op } }])
    }
  }
  return success({ design, warnings })
}
