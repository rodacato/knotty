import { faceSize, roundTo } from '../../diseno/resolve'
import type { Finding, Rule } from '../finding'
import { hingesFor, ASSUMPTIONS } from '../assumptions'
import { freeSpan } from './deflection'

/** R4: un mueble alto y poco profundo se va de frente al jalarlo o al subirse un niño. */
export const tippingRule: Rule = ({ design: diseno }): Finding[] => {
  const { alto, fondo } = diseno.dimensiones
  const relacion = alto / fondo
  const { recommendedRatio: relacionRecomendacion, criticalRatio: relacionCritica, criticalHeight: altoCritico } = ASSUMPTIONS.tipping
  if (diseno.anclajeMuro || relacion < relacionRecomendacion) return []
  const critico = alto > altoCritico && relacion >= relacionCritica
  return [
    {
      code: 'R4_VUELCO',
      severity: critico ? 'critico' : 'recomendacion',
      pieces: diseno.piezas.filter((p) => p.rol === 'lateral').map((p) => p.id),
      message: `Mide ${alto} mm de alto y solo ${fondo} de fondo (${roundTo(relacion)} a 1): se puede ir de frente si no va anclado al muro.`,
      data: { alto, fondo, relacion: roundTo(relacion) },
      alternatives: [
        { key: 'anclar-muro', description: 'Anclarlo al muro con un kit antivuelco', data: { herrajeId: 'kit-antivuelco' } },
        { key: 'mas-fondo', description: `Darle al menos ${Math.ceil(alto / relacionRecomendacion / 10) * 10} mm de fondo`, data: { fondo: Math.ceil(alto / relacionRecomendacion / 10) * 10 } },
      ],
    },
  ]
}

/** R6: bisagras según el alto de la puerta y puertas demasiado anchas para una sola hoja. */
export const doorRule: Rule = ({ design: diseno, geo }) =>
  diseno.piezas
    .filter((p) => p.rol === 'puerta')
    .flatMap((p): Finding[] => {
      const caja = geo.boxes.get(p.id)
      if (!caja) return []
      const alto = caja.y1 - caja.y0
      const ancho = caja.x1 - caja.x0
      const encontrados: Finding[] = []
      const bisagras = diseno.uniones.filter((u) => u.tipo === 'bisagra-cazoleta' && (u.a === p.id || u.b === p.id))
      const puestas = bisagras.reduce((n, u) => n + u.herrajes.reduce((m, h) => m + (h.cantidad ?? hingesFor(alto)), 0), 0)
      const necesarias = hingesFor(alto)
      if (bisagras.length && puestas < necesarias)
        encontrados.push({
          code: 'R6_PUERTAS',
          severity: necesarias - puestas >= 2 ? 'critico' : 'recomendacion',
          pieces: [p.id],
          message: `${p.nombre} mide ${Math.round(alto)} mm de alto y lleva ${puestas} bisagras; con esa altura van ${necesarias} para que no se descuelgue.`,
          data: { alto: Math.round(alto), puestas, necesarias },
          alternatives: [{ key: 'mas-bisagras', description: `Poner ${necesarias} bisagras`, data: { cantidad: necesarias } }],
        })
      if (ancho > ASSUMPTIONS.doors.maxWidth)
        encontrados.push({
          code: 'R6_PUERTAS',
          severity: 'recomendacion',
          pieces: [p.id],
          message: `${p.nombre} mide ${Math.round(ancho)} mm de ancho: una hoja tan ancha pesa en las bisagras y estorba al abrir.`,
          data: { ancho: Math.round(ancho), maximo: ASSUMPTIONS.doors.maxWidth },
          alternatives: [{ key: 'dos-puertas', description: 'Dividirla en dos puertas', data: { puertas: 2 } }],
        })
      return encontrados
    })

/** R7: un piso que no descansa en el suelo ni en un zoclo corrido necesita apoyo intermedio si el claro es largo. */
export const baseRule: Rule = (ctx) =>
  ctx.design.piezas
    .filter((p) => p.rol === 'piso' && p.normal === 'y')
    .flatMap((p): Finding[] => {
      const caja = ctx.geo.boxes.get(p.id)
      if (!caja || caja.y0 <= 0.5) return []
      const largo = caja.x1 - caja.x0
      const corrido = ctx.contacts.some((c) => {
        if (c.a !== p.id && c.b !== p.id) return false
        const otra = ctx.geo.boxes.get(c.a === p.id ? c.b : c.a)!
        return Math.abs(otra.y1 - caja.y0) <= 0.5 && Math.min(otra.x1, caja.x1) - Math.max(otra.x0, caja.x0) >= largo * 0.8
      })
      const claro = freeSpan(p.id, caja, ctx)
      if (corrido || !claro || claro <= ASSUMPTIONS.floorSpan) return []
      return [
        {
          code: 'R7_BASE',
          severity: 'recomendacion',
          pieces: [p.id],
          message: `${p.nombre} cruza ${roundTo(claro, 0)} mm sin nada debajo: con peso encima tiende a vencerse.`,
          data: { claro: roundTo(claro, 0), maximo: ASSUMPTIONS.floorSpan },
          alternatives: [
            { key: 'apoyo-central', description: 'Agregar un apoyo al centro, debajo del piso', data: {} },
            { key: 'zoclo', description: 'Agregar un zoclo corrido al frente', data: {} },
          ],
        },
      ]
    })

const VETA_VISIBLE = new Set(['lateral', 'entrepano', 'piso', 'techo', 'divisor', 'puerta'])

/** R8: la veta a lo ancho se ve rara en piezas largas y las hace menos rígidas. */
export const grainRule: Rule = ({ design: diseno, geo }) =>
  diseno.piezas.flatMap((p): Finding[] => {
    const caja = geo.boxes.get(p.id)
    if (!caja || p.veta !== 'ancho' || !VETA_VISIBLE.has(p.rol)) return []
    const [largo, ancho] = faceSize(caja, p.normal)
    if (largo < ancho * 1.5) return []
    return [
      {
        code: 'R8_VETA',
        severity: 'detalle',
        pieces: [p.id],
        message: `En ${p.nombre} la veta corre a lo ancho: se ve menos natural y la pieza es menos rígida.`,
        data: { largo: Math.round(largo), ancho: Math.round(ancho) },
        alternatives: [{ key: 'veta-a-lo-largo', description: 'Cortarla con la veta a lo largo', data: { veta: 'largo' } }],
      },
    ]
  })
