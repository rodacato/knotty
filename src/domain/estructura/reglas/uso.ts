import { medidasCara, redondear } from '../../diseno/resolver'
import type { Hallazgo, Regla } from '../hallazgo'
import { bisagrasPara, SUPUESTOS } from '../supuestos'
import { claroLibre } from './flecha'

/** R4: un mueble alto y poco profundo se va de frente al jalarlo o al subirse un niño. */
export const reglaVuelco: Regla = ({ diseno }): Hallazgo[] => {
  const { alto, fondo } = diseno.dimensiones
  const relacion = alto / fondo
  const { relacionRecomendacion, relacionCritica, altoCritico } = SUPUESTOS.vuelco
  if (diseno.anclajeMuro || relacion < relacionRecomendacion) return []
  const critico = alto > altoCritico && relacion >= relacionCritica
  return [
    {
      codigo: 'R4_VUELCO',
      severidad: critico ? 'critico' : 'recomendacion',
      piezas: diseno.piezas.filter((p) => p.rol === 'lateral').map((p) => p.id),
      mensaje: `Mide ${alto} mm de alto y solo ${fondo} de fondo (${redondear(relacion)} a 1): se puede ir de frente si no va anclado al muro.`,
      datos: { alto, fondo, relacion: redondear(relacion) },
      alternativas: [
        { clave: 'anclar-muro', descripcion: 'Anclarlo al muro con un kit antivuelco', datos: { herrajeId: 'kit-antivuelco' } },
        { clave: 'mas-fondo', descripcion: `Darle al menos ${Math.ceil(alto / relacionRecomendacion / 10) * 10} mm de fondo`, datos: { fondo: Math.ceil(alto / relacionRecomendacion / 10) * 10 } },
      ],
    },
  ]
}

/** R6: bisagras según el alto de la puerta y puertas demasiado anchas para una sola hoja. */
export const reglaPuertas: Regla = ({ diseno, geo }) =>
  diseno.piezas
    .filter((p) => p.rol === 'puerta')
    .flatMap((p): Hallazgo[] => {
      const caja = geo.cajas.get(p.id)
      if (!caja) return []
      const alto = caja.y1 - caja.y0
      const ancho = caja.x1 - caja.x0
      const encontrados: Hallazgo[] = []
      const bisagras = diseno.uniones.filter((u) => u.tipo === 'bisagra-cazoleta' && (u.a === p.id || u.b === p.id))
      const puestas = bisagras.reduce((n, u) => n + u.herrajes.reduce((m, h) => m + (h.cantidad ?? bisagrasPara(alto)), 0), 0)
      const necesarias = bisagrasPara(alto)
      if (bisagras.length && puestas < necesarias)
        encontrados.push({
          codigo: 'R6_PUERTAS',
          severidad: necesarias - puestas >= 2 ? 'critico' : 'recomendacion',
          piezas: [p.id],
          mensaje: `${p.nombre} mide ${Math.round(alto)} mm de alto y lleva ${puestas} bisagras; con esa altura van ${necesarias} para que no se descuelgue.`,
          datos: { alto: Math.round(alto), puestas, necesarias },
          alternativas: [{ clave: 'mas-bisagras', descripcion: `Poner ${necesarias} bisagras`, datos: { cantidad: necesarias } }],
        })
      if (ancho > SUPUESTOS.puertas.anchoMaximo)
        encontrados.push({
          codigo: 'R6_PUERTAS',
          severidad: 'recomendacion',
          piezas: [p.id],
          mensaje: `${p.nombre} mide ${Math.round(ancho)} mm de ancho: una hoja tan ancha pesa en las bisagras y estorba al abrir.`,
          datos: { ancho: Math.round(ancho), maximo: SUPUESTOS.puertas.anchoMaximo },
          alternativas: [{ clave: 'dos-puertas', descripcion: 'Dividirla en dos puertas', datos: { puertas: 2 } }],
        })
      return encontrados
    })

/** R7: un piso que no descansa en el suelo ni en un zoclo corrido necesita apoyo intermedio si el claro es largo. */
export const reglaBase: Regla = (ctx) =>
  ctx.diseno.piezas
    .filter((p) => p.rol === 'piso' && p.normal === 'y')
    .flatMap((p): Hallazgo[] => {
      const caja = ctx.geo.cajas.get(p.id)
      if (!caja || caja.y0 <= 0.5) return []
      const largo = caja.x1 - caja.x0
      const corrido = ctx.contactos.some((c) => {
        if (c.a !== p.id && c.b !== p.id) return false
        const otra = ctx.geo.cajas.get(c.a === p.id ? c.b : c.a)!
        return Math.abs(otra.y1 - caja.y0) <= 0.5 && Math.min(otra.x1, caja.x1) - Math.max(otra.x0, caja.x0) >= largo * 0.8
      })
      const claro = claroLibre(p.id, caja, ctx)
      if (corrido || !claro || claro <= SUPUESTOS.claroPiso) return []
      return [
        {
          codigo: 'R7_BASE',
          severidad: 'recomendacion',
          piezas: [p.id],
          mensaje: `${p.nombre} cruza ${redondear(claro, 0)} mm sin nada debajo: con peso encima tiende a vencerse.`,
          datos: { claro: redondear(claro, 0), maximo: SUPUESTOS.claroPiso },
          alternativas: [
            { clave: 'apoyo-central', descripcion: 'Agregar un apoyo al centro, debajo del piso', datos: {} },
            { clave: 'zoclo', descripcion: 'Agregar un zoclo corrido al frente', datos: {} },
          ],
        },
      ]
    })

const VETA_VISIBLE = new Set(['lateral', 'entrepano', 'piso', 'techo', 'divisor', 'puerta'])

/** R8: la veta a lo ancho se ve rara en piezas largas y las hace menos rígidas. */
export const reglaVeta: Regla = ({ diseno, geo }) =>
  diseno.piezas.flatMap((p): Hallazgo[] => {
    const caja = geo.cajas.get(p.id)
    if (!caja || p.veta !== 'ancho' || !VETA_VISIBLE.has(p.rol)) return []
    const [largo, ancho] = medidasCara(caja, p.normal)
    if (largo < ancho * 1.5) return []
    return [
      {
        codigo: 'R8_VETA',
        severidad: 'detalle',
        piezas: [p.id],
        mensaje: `En ${p.nombre} la veta corre a lo ancho: se ve menos natural y la pieza es menos rígida.`,
        datos: { largo: Math.round(largo), ancho: Math.round(ancho) },
        alternativas: [{ clave: 'veta-a-lo-largo', descripcion: 'Cortarla con la veta a lo largo', datos: { veta: 'largo' } }],
      },
    ]
  })
