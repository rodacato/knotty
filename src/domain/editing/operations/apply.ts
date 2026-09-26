import { partway } from '../../design/builders'
import { DIMENSION_OF_AXIS, AXES, type Position, type Design, type Axis, type Piece, type Extent } from '../../design/schema'
import { parseFace, resolveGeometry, type Geometry } from '../../design/resolve'
import { materialById, type Catalog } from '../../materials/catalog'
import { contactBetween } from '../../design/validation/contact'
import { error, success, failure, type DesignWarning, type DesignError, type Result } from '../../design/validation/errors'
import { expandDrawer } from './drawer'
import type { Operation } from './schema'

// The operations the expert (or Knotty) asks for, applied in order on a copy.

interface Applied {
  design: Design
  warnings: DesignWarning[]
}

class InvalidOperation extends Error {
  constructor(readonly detail: DesignError) {
    super(detail.message)
  }
}

const invalid = (code: DesignError['code'], message: string, data?: Record<string, unknown>) => new InvalidOperation(error(code, message, data))

const refersTo = (position: Position | null, id: string) =>
  !!position && ((position.type === 'ref' && parseFace(position.ref).piece === id) || (position.type === 'between' && [position.a, position.b].some((r) => parseFace(r).piece === id)))

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
    const p = design.pieces.find((x) => x.id === id)
    if (!p) throw invalid('E_UNKNOWN_PIECE', `No existe la pieza "${id}".`, { piece: id })
    return p
  }
  const assertFreeId = (id: string) => {
    if (design.pieces.some((p) => p.id === id)) throw invalid('E_DUPLICATE_ID', `Ya existe una pieza "${id}".`, { piece: id })
  }

  /** Removing a piece freezes in millimetres whatever was tied to its faces, so nothing else moves. */
  function remove(id: string) {
    piece(id)
    const geo = geometry()
    const frozen = new Set<string>()
    for (const p of design.pieces) {
      if (p.id === id) continue
      for (const axis of AXES)
        for (const end of ['from', 'to'] as const) {
          const position = p[axis][end]
          if (!refersTo(position, id)) continue
          p[axis][end] = { type: 'mm', mm: geo.measure(position!, axis) }
          frozen.add(p.id)
        }
    }
    design.pieces = design.pieces.filter((p) => p.id !== id)
    design.joints = design.joints.filter((u) => u.a !== id && u.b !== id)
    if (frozen.size)
      warnings.push({ code: 'W_FROZEN_REFERENCE', message: `Al quitar "${id}", ${[...frozen].join(', ')} quedaron fijas en mm.`, data: { piece: id, affected: [...frozen] } })
  }

  function place(p: Piece, axis: Axis, position: Position, length: number) {
    p[axis] = axis === p.normal ? { from: position, to: null, length: null } : { from: position, to: null, length: length }
  }
  const lengthOf = (id: string, axis: Axis, geo: Geometry) => geo.boxes.get(id)![`${axis}1`] - geo.boxes.get(id)![`${axis}0`]

  const applyOne = (op: Operation) => {
    switch (op.op) {
      case 'addPiece':
        assertFreeId(op.piece.id)
        design.pieces.push(structuredClone(op.piece))
        return
      case 'removePiece':
        return remove(op.id)
      case 'removeGroup': {
        const ids = design.pieces.filter((p) => p.group === op.group).map((p) => p.id)
        if (!ids.length) throw invalid('E_UNKNOWN_PIECE', `No hay piezas en el grupo "${op.group}".`, { group: op.group })
        return ids.forEach(remove)
      }
      case 'duplicatePiece': {
        const source = piece(op.id)
        assertFreeId(op.newId)
        const geo = geometry()
        const copy: Piece = { ...structuredClone(source), id: op.newId, name: op.name }
        place(copy, op.axis, op.at, lengthOf(op.id, op.axis, geo))
        design.pieces.push(copy)
        const copied = design.joints
          .filter((u) => u.a === op.id || u.b === op.id)
          .map((u) => ({ ...structuredClone(u), id: `${u.id}-${op.newId}`, a: u.a === op.id ? op.newId : u.a, b: u.b === op.id ? op.newId : u.b }))
        const after = resolveGeometry(design, catalog)
        // A copied joint stays only where the copy still touches that piece.
        design.joints.push(
          ...copied.filter((u) => {
            if (!after.ok) return true
            const { boxes } = after.value
            return !!boxes.get(u.a) && !!boxes.get(u.b) && !!contactBetween(u.a, boxes.get(u.a)!, u.b, boxes.get(u.b)!)
          }),
        )
        return
      }
      case 'resize': {
        const p = piece(op.id)
        if (op.axis === p.normal) throw invalid('E_INVALID_OPERATION', `"${p.id}" tiene su espesor en ${op.axis}; para eso usa changeMaterial o move.`, { piece: p.id, axis: op.axis })
        const box = geometry().boxes.get(p.id)!
        const current = p[op.axis]
        const next: Extent =
          op.end === 'from'
            ? { from: op.at, to: current.to ?? { type: 'mm', mm: box[`${op.axis}1`] }, length: null }
            : { from: current.from ?? { type: 'mm', mm: box[`${op.axis}0`] }, to: op.at, length: null }
        p[op.axis] = next
        return
      }
      case 'move': {
        const p = piece(op.id)
        return place(p, op.axis, op.at, lengthOf(p.id, op.axis, geometry()))
      }
      case 'distribute': {
        const pieces = op.ids.map(piece)
        const across = pieces.find((p) => p.normal !== op.axis)
        if (across) throw invalid('E_INVALID_OPERATION', `Solo se reparte en el eje del espesor; "${across.id}" lo tiene en ${across.normal}.`, { piece: across.id, axis: op.axis })
        const geo = geometry()
        const n = pieces.length
        pieces
          .sort((a, b) => geo.boxes.get(a.id)![`${op.axis}0`] - geo.boxes.get(b.id)![`${op.axis}0`])
          .forEach((p, i) => {
            const thickness = geo.thicknesses.get(p.id)!
            p[op.axis] = { from: partway(op.a, op.b, (i + 1) / (n + 1), (thickness * (i - n)) / (n + 1)), to: null, length: null }
          })
        return
      }
      case 'changeMaterial': {
        if (!materialById(catalog, op.material)) throw invalid('E_UNKNOWN_MATERIAL', `El material "${op.material}" no está en el catálogo.`, { material: op.material })
        return op.ids.forEach((id) => (piece(id).material = op.material))
      }
      case 'changeProperties': {
        const p = piece(op.id)
        for (const field of ['name', 'role', 'grain', 'load', 'support', 'edges', 'confidence'] as const) if (op[field] !== null) Object.assign(p, { [field]: op[field] })
        return
      }
      case 'addJoint':
        if (design.joints.some((u) => u.id === op.joint.id)) throw invalid('E_DUPLICATE_ID', `Ya existe una unión "${op.joint.id}".`, { joint: op.joint.id })
        design.joints.push(structuredClone(op.joint))
        return
      case 'changeJoint': {
        const i = design.joints.findIndex((u) => u.id === op.joint.id)
        if (i < 0) throw invalid('E_UNKNOWN_JOINT', `No existe la unión "${op.joint.id}".`, { joint: op.joint.id })
        design.joints[i] = structuredClone(op.joint)
        return
      }
      case 'removeJoint':
        if (!design.joints.some((u) => u.id === op.id)) throw invalid('E_UNKNOWN_JOINT', `No existe la unión "${op.id}".`, { joint: op.id })
        design.joints = design.joints.filter((u) => u.id !== op.id)
        return
      case 'resizeFurniture': {
        const key = DIMENSION_OF_AXIS[op.axis]
        const factor = op.value / design.dimensions[key]
        design.dimensions[key] = op.value
        if (op.rule === 'proportional')
          for (const p of design.pieces) {
            const t = p[op.axis]
            for (const end of ['from', 'to'] as const) {
              const position = t[end]
              if (position?.type === 'mm') t[end] = { type: 'mm', mm: position.mm * factor }
            }
            if (t.length !== null && op.axis !== p.normal) t.length *= factor
          }
        return
      }
      case 'setWallAnchored':
        design.wallAnchored = op.value
        return
      case 'addDrawer': {
        if (design.pieces.some((p) => p.group === op.group)) throw invalid('E_DUPLICATE_ID', `Ya existe un cajón "${op.group}".`, { group: op.group })
        const drawer = expandDrawer(op, geometry(), catalog)
        if ('code' in drawer) throw new InvalidOperation(drawer)
        for (const p of drawer.pieces) assertFreeId(p.id)
        design.pieces.push(...drawer.pieces)
        design.joints.push(...drawer.joints)
        return
      }
    }
  }

  for (const [i, op] of operations.entries()) {
    try {
      applyOne(op)
    } catch (e) {
      if (!(e instanceof InvalidOperation)) throw e
      return failure([{ ...e.detail, data: { ...e.detail.data, operation: i, op: op.op } }])
    }
  }
  return success({ design, warnings })
}
