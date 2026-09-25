import { DIMENSION_DE_EJE, EJES, isDrawerPart, type Diseno } from '../diseno/esquema'
import { faceSize, roundTo, type Geometry } from '../diseno/resolve'
import { usableSheet, materialById, type Catalog } from '../materiales/catalog'
import { contacts, samePair, gapBetween, CONTACT_TOLERANCE, type Contact } from './contact'
import { error, type DesignWarning, type DesignError } from './errors'

// Whether the pieces make a piece of furniture: its measures add up, joints join touching pieces, nothing overlaps or floats, and every piece fits a sheet.
// The error payloads (codigo, mensaje, datos) keep their names: the expert reads them, and they share their shape with the structural findings.

const MEASURE_TOLERANCE = 1
/** The widest gap between a drawer and the piece beside it that a runner can bridge. */
const RUNNER_GAP = 20
/** An inset door hangs in its opening with this much gap all around: its hinge joins pieces that do not touch. */
const HINGE_GAP = 4
const NO_JOINT_WARNING = new Set(['puerta', 'frente-cajon'])

export interface GeometryValidation {
  errors: DesignError[]
  warnings: DesignWarning[]
  contacts: Contact[]
}

export function validateGeometry(design: Diseno, geo: Geometry, catalog: Catalog): GeometryValidation {
  const errors: DesignError[] = []
  const warnings: DesignWarning[] = []
  const all = contacts(geo.boxes)
  const byId = new Map(design.piezas.map((p) => [p.id, p]))

  const boxes = [...geo.boxes.values()]
  for (const axis of EJES) {
    const min = Math.min(...boxes.map((c) => c[`${axis}0`]))
    const max = Math.max(...boxes.map((c) => c[`${axis}1`]))
    const expected = design.dimensiones[DIMENSION_DE_EJE[axis]]
    if (boxes.length && (Math.abs(min) > MEASURE_TOLERANCE || Math.abs(max - expected) > MEASURE_TOLERANCE))
      errors.push(
        error('E_MEDIDA_GLOBAL', `Las piezas ocupan de ${roundTo(min)} a ${roundTo(max)} mm en ${DIMENSION_DE_EJE[axis]}, pero el mueble mide ${expected} mm.`, {
          eje: axis,
          desde: roundTo(min),
          hasta: roundTo(max),
          esperado: expected,
        }),
      )
  }

  for (const u of design.uniones) {
    const missing = [u.a, u.b].filter((id) => !byId.has(id))
    if (missing.length) {
      errors.push(error('E_PIEZA_INEXISTENTE', `La unión "${u.id}" refiere ${missing.map((f) => `"${f}"`).join(' y ')}, que no existe.`, { union: u.id, piezas: missing }))
      continue
    }
    if (u.tipo === 'corredera') {
      const gap = gapBetween(geo.boxes.get(u.a)!, geo.boxes.get(u.b)!)
      if (!gap || gap.axis !== 'x' || gap.distance > RUNNER_GAP)
        errors.push(error('E_UNION_SIN_CONTACTO', `La corredera "${u.id}" necesita a "${u.a}" y "${u.b}" uno frente al otro a lo ancho, a menos de ${RUNNER_GAP} mm.`, { union: u.id, a: u.a, b: u.b }))
      continue
    }
    if (u.tipo === 'bisagra-cazoleta' && !all.some((c) => samePair(c, u.a, u.b))) {
      const gap = gapBetween(geo.boxes.get(u.a)!, geo.boxes.get(u.b)!)
      if (!gap || gap.distance > HINGE_GAP)
        errors.push(error('E_UNION_SIN_CONTACTO', `La bisagra "${u.id}" necesita a "${u.a}" junto a "${u.b}", a menos de ${HINGE_GAP} mm.`, { union: u.id, a: u.a, b: u.b }))
      continue
    }
    if (!all.some((c) => samePair(c, u.a, u.b)))
      errors.push(error('E_UNION_SIN_CONTACTO', `La unión "${u.id}" junta "${u.a}" y "${u.b}", pero no se tocan.`, { union: u.id, a: u.a, b: u.b }))
  }

  // Touching pieces connect; overlapping ones only where a joint lets one go into the other (a groove, a rabbet).
  const connections = all.filter((c) => {
    if (c.axis) return true
    const allowed = design.uniones.some((u) => samePair(u, c.a, c.b) && u.penetracion !== null && c.depth <= u.penetracion + CONTACT_TOLERANCE)
    if (!allowed) errors.push(error('E_TRASLAPE', `"${c.a}" y "${c.b}" se enciman ${roundTo(c.depth)} mm.`, { a: c.a, b: c.b, profundidad: roundTo(c.depth) }))
    return allowed
  })

  // Runners and hinges hold pieces that do not touch; from the floor up, whatever is not reached floats.
  const hanging = design.uniones.filter((u) => (u.tipo === 'corredera' || u.tipo === 'bisagra-cazoleta') && geo.boxes.has(u.a) && geo.boxes.has(u.b))
  connections.push(...hanging.map((u) => ({ a: u.a, b: u.b, axis: 'x' as const, depth: 0 })))
  const reached = new Set([...geo.boxes].filter(([, c]) => c.y0 <= CONTACT_TOLERANCE).map(([id]) => id))
  for (let changed = true; changed; ) {
    changed = false
    for (const c of connections) {
      if (reached.has(c.a) !== reached.has(c.b)) {
        reached.add(c.a).add(c.b)
        changed = true
      }
    }
  }
  // A drawer hangs from its runners: whether it has something to hang from is a drawer rule (R9), with a way to fix it.
  const drawerParts = new Set(design.piezas.filter((p) => isDrawerPart(p) && p.grupo).map((p) => p.id))
  for (const id of geo.boxes.keys())
    if (!reached.has(id) && !drawerParts.has(id)) errors.push(error('E_FLOTANTE', `"${id}" no se apoya en nada: no toca ninguna pieza conectada al piso.`, { pieza: id }))

  for (const p of design.piezas) {
    const box = geo.boxes.get(p.id)
    const material = materialById(catalog, p.material)
    if (!box || !material) continue
    const [length, width] = faceSize(box, p.normal)
    const sheet = usableSheet(catalog, material)
    if (length > sheet.largo || width > sheet.ancho)
      errors.push(
        error('E_NO_CABE_EN_HOJA', `"${p.id}" mide ${roundTo(length)} × ${roundTo(width)} mm y la hoja útil es de ${sheet.largo} × ${sheet.ancho} mm.`, {
          pieza: p.id,
          largo: roundTo(length),
          ancho: roundTo(width),
          hoja: sheet,
        }),
      )
  }

  for (const c of connections) {
    const a = byId.get(c.a)!
    const b = byId.get(c.b)!
    if ([a, b].some((p) => NO_JOINT_WARNING.has(p.rol) || p.apoyo === 'movil')) continue
    if (!design.uniones.some((u) => samePair(u, c.a, c.b)))
      warnings.push({ code: 'A_CONTACTO_SIN_UNION', message: `"${c.a}" y "${c.b}" se tocan pero no tienen unión.`, data: { a: c.a, b: c.b } })
  }

  return { errors, warnings, contacts: all }
}
