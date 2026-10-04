import type { Load, Piece } from '../../../design/schema'
import { roundTo, type Box } from '../../../design/resolve'
import { CONTACT_TOLERANCE, freeSpan } from '../../../design/boxes'
import { boardsFor, materialById, type BoardMaterial, type Catalog } from '../../../materials/catalog'
import { stiffness } from '../../../materials/grades'
import type { Alternative, Finding, Rule, Severity } from '../finding'
import { ASSUMPTIONS, type LoadDuration } from '../../../assumptions'
import { personSurface } from '../../typology/constraint'
import { useOf } from '../../typology/typology'

// R1: how much a horizontal piece sags between its supports under its load.

const LOAD_NAME: Record<Load, string> = { none: 'sin carga', light: 'carga ligera', medium: 'carga media', heavy: 'libros' }

/** What the board measures, for the sag: the nominal thickness less the allowance, except for thin boards. */
export const sagThickness = (nominal: number) => (nominal >= ASSUMPTIONS.realThicknessFrom ? nominal - ASSUMPTIONS.realThicknessAllowance : nominal)

/** Simply supported beam under a uniform load: δ = 5·w·L⁴ / (384·E·I) × creep, the final sag. In mm. */
export function deflection(span: number, depth: number, nominal: number, load: Load, modulus: number, duration: LoadDuration = 'permanent') {
  const w = (ASSUMPTIONS.loads[load] * ASSUMPTIONS.gravity * depth) / 1e6
  const inertia = (depth * sagThickness(nominal) ** 3) / 12
  return ((5 * w * span ** 4) / (384 * modulus * inertia)) * ASSUMPTIONS.creep[duration]
}

/** The longest span (of a board of this nominal thickness) whose sag stays within span / the recommended limit. */
export function maxSpan(depth: number, nominal: number, load: Load, modulus: number, duration: LoadDuration = 'permanent') {
  const w = (ASSUMPTIONS.loads[load] * ASSUMPTIONS.gravity * depth) / 1e6
  const inertia = (depth * sagThickness(nominal) ** 3) / 12
  return Math.cbrt((384 * modulus * inertia) / (5 * w * ASSUMPTIONS.creep[duration] * ASSUMPTIONS.deflectionLimit.recommended))
}

export function deflectionSeverity(delta: number, span: number): Severity | null {
  if (delta > span / ASSUMPTIONS.deflectionLimit.critical) return 'critical'
  if (delta > span / ASSUMPTIONS.deflectionLimit.recommended) return 'recommendation'
  return null
}

type GrainToSpan = 'parallel' | 'perpendicular'

/** The span runs along x: the face grain goes with it or across it. */
function grainToSpan(p: Piece, box: Box): GrainToSpan {
  const longSideIsX = box.x1 - box.x0 >= box.z1 - box.z0
  const grainAlongX = p.grain === 'length' ? longSideIsX : p.grain === 'width' ? !longSideIsX : false
  return grainAlongX ? 'parallel' : 'perpendicular'
}

/** The board's stiffness in MPa, from its grade and thickness. */
const modulusOf = (board: BoardMaterial, grain: GrainToSpan) => stiffness(board.grade, board.thickness)[grain]

interface Beam {
  span: number
  depth: number
  thickness: number
  load: Load
  modulus: number
  duration: LoadDuration
}

function alternatives(p: Piece, { span, depth, thickness, load, modulus, duration }: Beam, grain: GrainToSpan, catalog: Catalog): Alternative[] {
  const list: Alternative[] = []
  const thicker = boardsFor(catalog, 'carcass')
    .filter((m) => m.thickness > thickness)
    .sort((a, b) => a.thickness - b.thickness)[0]
  if (thicker)
    list.push({
      key: 'thicker-board',
      description: `Subir a ${thicker.name}`,
      data: { material: thicker.id, sag: roundTo(deflection(span, depth, thicker.thickness, load, modulusOf(thicker, grain), duration)) },
    })
  const half = (span - thickness) / 2
  list.push({
    key: 'center-divider',
    description: p.role === 'bottom' ? 'Agregar un apoyo al centro, debajo del piso' : 'Agregar un divisor vertical al centro',
    data: { span: roundTo(half, 0), sag: roundTo(deflection(half, depth, thickness, load, modulus, duration)) },
  })
  return list
}

/** A cabinet's shelves are built for a medium load; in a bookcase they hold books. Read here, not at build, because the person can change the kind without rebuilding. */
const loadOf = (p: Piece, use: ReturnType<typeof useOf>): Load => (use === 'bookcase' && p.role === 'shelf' && p.load === 'medium' ? 'heavy' : p.load)

export const deflectionRule: Rule = (ctx) => {
  // A person on a bed or a bench gets off: that load does not creep. What a shelf holds stays.
  const use = useOf(ctx.design)
  const person = personSurface(ctx, use)
  return ctx.design.pieces.flatMap((p): Finding[] => {
    const load = loadOf(p, use)
    const box = ctx.geo.boxes.get(p.id)
    const thickness = ctx.geo.thicknesses.get(p.id)
    const board = materialById(ctx.catalog, p.material)
    if (!box || !thickness || !board || p.normal !== 'y' || load === 'none') return []
    // A piece lying on the floor has the floor under all of it: there is no span to sag.
    if (box.y0 <= CONTACT_TOLERANCE) return []
    const span = freeSpan(p.id, box, ctx)
    if (!span) return []
    const depth = box.z1 - box.z0
    const grain = grainToSpan(p, box)
    const modulus = modulusOf(board, grain)
    const duration: LoadDuration = person.has(p.id) ? 'passing' : 'permanent'
    const delta = deflection(span, depth, thickness, load, modulus, duration)
    const severity = deflectionSeverity(delta, span)
    if (!severity) return []
    const limit = span / ASSUMPTIONS.deflectionLimit.recommended
    const loadName = duration === 'passing' ? 'una persona encima' : LOAD_NAME[load]
    const beam = { span, depth, thickness, load, modulus, duration }
    return [
      {
        code: 'R1_SAG',
        severity,
        pieces: [p.id],
        message: `${p.name} se pandearía ~${roundTo(delta)} mm con ${loadName} en un claro de ${roundTo(span, 0)} mm (lo aceptable es hasta ${roundTo(limit)} mm).`,
        // The longest span this board takes: a fact for the expert, not a way out.
        data: { span: roundTo(span, 0), depth: roundTo(depth, 0), thickness: thickness, load, sag: roundTo(delta), limit: roundTo(limit), modulus: modulus, maxSpan: roundTo(maxSpan(depth, thickness, load, modulus, duration), 0) },
        alternatives: alternatives(p, beam, grain, ctx.catalog),
      },
    ]
  })
}
