import { faceSize, roundTo } from '../../diseno/resolve'
import type { Finding, Rule } from '../finding'
import { hingesFor, ASSUMPTIONS } from '../assumptions'
import { freeSpan } from './deflection'

// How the piece of furniture is used: it must not tip over, its doors must hang, its floor must hold and its grain should run along.

/** R4: tall and shallow furniture falls forward when pulled or when a child climbs it. */
export const tippingRule: Rule = ({ design }): Finding[] => {
  const { height: height, depth: depth } = design.dimensions
  const ratio = height / depth
  const { recommendedRatio, criticalRatio, criticalHeight } = ASSUMPTIONS.tipping
  if (design.wallAnchored || ratio < recommendedRatio) return []
  const critical = height > criticalHeight && ratio >= criticalRatio
  return [
    {
      code: 'R4_VUELCO',
      severity: critical ? 'critico' : 'recomendacion',
      pieces: design.pieces.filter((p) => p.role === 'side').map((p) => p.id),
      message: `Mide ${height} mm de alto y solo ${depth} de fondo (${roundTo(ratio)} a 1): se puede ir de frente si no va anclado al muro.`,
      data: { alto: height, fondo: depth, relacion: roundTo(ratio) },
      alternatives: [
        { key: 'anclar-muro', description: 'Anclarlo al muro con un kit antivuelco', data: { herrajeId: 'kit-antivuelco' } },
        { key: 'mas-fondo', description: `Darle al menos ${Math.ceil(height / recommendedRatio / 10) * 10} mm de fondo`, data: { fondo: Math.ceil(height / recommendedRatio / 10) * 10 } },
      ],
    },
  ]
}

/** R6: hinges by the height of the door, and doors too wide for a single leaf. */
export const doorRule: Rule = ({ design, geo }) =>
  design.pieces
    .filter((p) => p.role === 'door')
    .flatMap((p): Finding[] => {
      const box = geo.boxes.get(p.id)
      if (!box) return []
      const height = box.y1 - box.y0
      const width = box.x1 - box.x0
      const found: Finding[] = []
      const hinges = design.joints.filter((u) => u.type === 'cup-hinge' && (u.a === p.id || u.b === p.id))
      const fitted = hinges.reduce((n, u) => n + u.hardware.reduce((m, h) => m + (h.count ?? hingesFor(height)), 0), 0)
      const needed = hingesFor(height)
      if (hinges.length && fitted < needed)
        found.push({
          code: 'R6_PUERTAS',
          severity: needed - fitted >= 2 ? 'critico' : 'recomendacion',
          pieces: [p.id],
          message: `${p.name} mide ${Math.round(height)} mm de alto y lleva ${fitted} bisagras; con esa altura van ${needed} para que no se descuelgue.`,
          data: { alto: Math.round(height), puestas: fitted, necesarias: needed },
          alternatives: [{ key: 'mas-bisagras', description: `Poner ${needed} bisagras`, data: { cantidad: needed } }],
        })
      if (width > ASSUMPTIONS.doors.maxWidth)
        found.push({
          code: 'R6_PUERTAS',
          severity: 'recomendacion',
          pieces: [p.id],
          message: `${p.name} mide ${Math.round(width)} mm de ancho: una hoja tan ancha pesa en las bisagras y estorba al abrir.`,
          data: { ancho: Math.round(width), maximo: ASSUMPTIONS.doors.maxWidth },
          alternatives: [{ key: 'dos-puertas', description: 'Dividirla en dos puertas', data: { puertas: 2 } }],
        })
      return found
    })

/** R7: a floor that rests neither on the ground nor on a full kick needs support in between over a long span. */
export const baseRule: Rule = (ctx) =>
  ctx.design.pieces
    .filter((p) => p.role === 'bottom' && p.normal === 'y')
    .flatMap((p): Finding[] => {
      const box = ctx.geo.boxes.get(p.id)
      if (!box || box.y0 <= 0.5) return []
      const length = box.x1 - box.x0
      const restsOnARun = ctx.contacts.some((c) => {
        if (c.a !== p.id && c.b !== p.id) return false
        const other = ctx.geo.boxes.get(c.a === p.id ? c.b : c.a)!
        return Math.abs(other.y1 - box.y0) <= 0.5 && Math.min(other.x1, box.x1) - Math.max(other.x0, box.x0) >= length * 0.8
      })
      const span = freeSpan(p.id, box, ctx)
      if (restsOnARun || !span || span <= ASSUMPTIONS.floorSpan) return []
      return [
        {
          code: 'R7_BASE',
          severity: 'recomendacion',
          pieces: [p.id],
          message: `${p.name} cruza ${roundTo(span, 0)} mm sin nada debajo: con peso encima tiende a vencerse.`,
          data: { claro: roundTo(span, 0), maximo: ASSUMPTIONS.floorSpan },
          alternatives: [
            { key: 'apoyo-central', description: 'Agregar un apoyo al centro, debajo del piso', data: {} },
            { key: 'zoclo', description: 'Agregar un zoclo corrido al frente', data: {} },
          ],
        },
      ]
    })

const GRAIN_SHOWS = new Set(['side', 'shelf', 'bottom', 'top', 'divider', 'door'])

/** R8: grain across a long piece looks odd and makes it less stiff. */
export const grainRule: Rule = ({ design, geo }) =>
  design.pieces.flatMap((p): Finding[] => {
    const box = geo.boxes.get(p.id)
    if (!box || p.grain !== 'width' || !GRAIN_SHOWS.has(p.role)) return []
    const [length, width] = faceSize(box, p.normal)
    if (length < width * 1.5) return []
    return [
      {
        code: 'R8_VETA',
        severity: 'detalle',
        pieces: [p.id],
        message: `En ${p.name} la veta corre a lo ancho: se ve menos natural y la pieza es menos rígida.`,
        data: { largo: Math.round(length), ancho: Math.round(width) },
        alternatives: [{ key: 'veta-a-lo-largo', description: 'Cortarla con la veta a lo largo', data: { veta: 'largo' } }],
      },
    ]
  })
