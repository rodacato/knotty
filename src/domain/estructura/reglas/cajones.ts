import { redondear } from '../../diseno/resolver'
import { separacionEntre } from '../../validacion/contacto'
import type { Hallazgo, Regla } from '../hallazgo'
import { SUPUESTOS } from '../supuestos'

/** R9: que la corredera entre justa, que el fondo aguante y que el frente no roce. */
export const reglaCajones: Regla = ({ diseno, geo, catalogo, contactos }) => {
  const encontrados: Hallazgo[] = []
  const grupos = [...new Set(diseno.piezas.filter((p) => p.rol === 'frente-cajon' && p.grupo).map((p) => p.grupo!))]

  for (const u of diseno.uniones.filter((x) => x.tipo === 'corredera')) {
    const a = geo.cajas.get(u.a)
    const b = geo.cajas.get(u.b)
    const hueco = a && b ? separacionEntre(a, b) : null
    const herraje = catalogo.herrajes.find((h) => u.herrajes.some((x) => x.herrajeId === h.id) && h.holguraLateral !== null) ?? catalogo.herrajes.find((h) => h.holguraLateral !== null)
    if (!hueco || !herraje?.holguraLateral) continue
    const diferencia = hueco.distancia - herraje.holguraLateral
    if (Math.abs(diferencia) <= SUPUESTOS.cajones.toleranciaCorredera) continue
    const nombre = diseno.piezas.find((p) => p.id === u.a)?.nombre ?? u.a
    encontrados.push({
      codigo: 'R9_CAJONES',
      severidad: 'critico',
      piezas: [u.a, u.b],
      mensaje:
        diferencia < 0
          ? `La corredera necesita ${herraje.holguraLateral} mm junto a ${nombre} y solo hay ${redondear(hueco.distancia)}: el cajón no entra.`
          : `Junto a ${nombre} hay ${redondear(hueco.distancia)} mm y la corredera ocupa ${herraje.holguraLateral}: el cajón quedaría flojo.`,
      datos: { union: u.id, hueco: redondear(hueco.distancia), necesita: herraje.holguraLateral },
      alternativas: [{ clave: 'ajustar-caja', descripcion: `Dejar ${herraje.holguraLateral} mm por lado entre la caja y el mueble`, datos: { holgura: herraje.holguraLateral } }],
    })
  }

  for (const g of grupos) {
    const fondo = diseno.piezas.find((p) => p.grupo === g && p.rol === 'fondo-cajon')
    const caja = fondo && geo.cajas.get(fondo.id)
    const espesor = fondo && geo.espesores.get(fondo.id)
    if (fondo && caja && espesor !== undefined && espesor < SUPUESTOS.cajones.fondoMinimo && caja.x1 - caja.x0 > SUPUESTOS.cajones.anchoFondoDelgado)
      encontrados.push({
        codigo: 'R9_CAJONES',
        severidad: 'recomendacion',
        piezas: [fondo.id],
        mensaje: `${fondo.nombre} es de ${espesor} mm y mide ${Math.round(caja.x1 - caja.x0)} mm de ancho: con peso se vence y se sale de abajo.`,
        datos: { espesor, ancho: Math.round(caja.x1 - caja.x0) },
        alternativas: [{ clave: 'fondo-6', descripcion: 'Fondo de 6 mm', datos: { material: 'TR6' } }],
      })

    const frente = diseno.piezas.find((p) => p.grupo === g && p.rol === 'frente-cajon')
    if (!frente) continue
    const roza = contactos.filter((c) => (c.a === frente.id || c.b === frente.id) && diseno.piezas.find((p) => p.id === (c.a === frente.id ? c.b : c.a))?.grupo !== g)
    if (roza.length)
      encontrados.push({
        codigo: 'R9_CAJONES',
        severidad: 'recomendacion',
        piezas: [frente.id, ...roza.map((c) => (c.a === frente.id ? c.b : c.a))],
        mensaje: `${frente.nombre} toca otras piezas sin holgura: va a rozar al abrir.`,
        datos: { toca: roza.length },
        alternativas: [{ clave: 'holgura-frente', descripcion: 'Dejar 2 mm de holgura alrededor del frente', datos: { holgura: 2 } }],
      })
  }
  return encontrados
}
