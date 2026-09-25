import { roundTo } from '../../diseno/resolve'
import { gapBetween } from '../../validation/contact'
import type { Diseno } from '../../diseno/esquema'
import { drawerSides } from '../../diseno/drawers'
import type { Geometry } from '../../diseno/resolve'
import type { Hallazgo, Regla } from '../hallazgo'
import { SUPUESTOS } from '../supuestos'

/** R9: que la corredera entre justa, que el fondo aguante y que el frente no roce. */
export const reglaCajones: Regla = ({ diseno, geo, catalogo, contactos }) => {
  const encontrados: Hallazgo[] = []
  const grupos = [...new Set(diseno.piezas.filter((p) => p.rol === 'frente-cajon' && p.grupo).map((p) => p.grupo!))]

  for (const u of diseno.uniones.filter((x) => x.tipo === 'corredera')) {
    const a = geo.boxes.get(u.a)
    const b = geo.boxes.get(u.b)
    const hueco = a && b ? gapBetween(a, b) : null
    const herraje = catalogo.herrajes.find((h) => u.herrajes.some((x) => x.herrajeId === h.id) && h.holguraLateral !== null) ?? catalogo.herrajes.find((h) => h.holguraLateral !== null)
    if (!hueco || !herraje?.holguraLateral) continue
    const diferencia = hueco.distance - herraje.holguraLateral
    if (Math.abs(diferencia) <= SUPUESTOS.cajones.toleranciaCorredera) continue
    const nombre = diseno.piezas.find((p) => p.id === u.a)?.nombre ?? u.a
    encontrados.push({
      codigo: 'R9_CAJONES',
      severidad: 'critico',
      piezas: [u.a, u.b],
      mensaje:
        diferencia < 0
          ? `La corredera necesita ${herraje.holguraLateral} mm junto a ${nombre} y solo hay ${roundTo(hueco.distance)}: el cajón no entra.`
          : `Junto a ${nombre} hay ${roundTo(hueco.distance)} mm y la corredera ocupa ${herraje.holguraLateral}: el cajón quedaría flojo.`,
      datos: { union: u.id, hueco: roundTo(hueco.distance), necesita: herraje.holguraLateral },
      alternativas: [{ clave: 'ajustar-caja', descripcion: `Dejar ${herraje.holguraLateral} mm por lado entre la caja y el mueble`, datos: { holgura: herraje.holguraLateral } }],
    })
  }

  encontrados.push(...runnerSupport(diseno, geo, catalogo), ...floorClearance(diseno, geo))

  for (const g of grupos) {
    const fondo = diseno.piezas.find((p) => p.grupo === g && p.rol === 'fondo-cajon')
    const caja = fondo && geo.boxes.get(fondo.id)
    const espesor = fondo && geo.thicknesses.get(fondo.id)
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

    const box = diseno.piezas.filter((p) => p.grupo === g && p.rol !== 'frente-cajon').map((p) => p.id)
    const rubs = contactos.filter((c) => box.includes(c.a) !== box.includes(c.b) && [c.a, c.b].some((id) => diseno.piezas.find((p) => p.id === id)?.grupo !== g))
    if (rubs.length) {
      const others = [...new Set(rubs.map((c) => (box.includes(c.a) ? c.b : c.a)))]
      encontrados.push({
        codigo: 'R9_CAJONES',
        severidad: 'recomendacion',
        piezas: [...new Set(rubs.map((c) => (box.includes(c.a) ? c.a : c.b))), ...others],
        mensaje: `La caja de ${drawerName(diseno, g)} toca ${others.map((id) => diseno.piezas.find((p) => p.id === id)?.nombre ?? id).join(', ')}: va a rozar al abrir. Con correderas laterales la caja va separada de todo.`,
        datos: { toca: others.length },
        alternativas: [],
      })
    }
  }
  return encontrados
}

const drawerName = (design: Diseno, group: string) => {
  const front = design.piezas.find((p) => p.grupo === group && p.rol === 'frente-cajon')
  return front ? front.nombre.replace(/^Frente de /i, '') : group
}
/** Each side of a drawer box needs something beside it to screw the runner to, at the runner's gap: freeform designs too. */
function runnerSupport(design: Diseno, geo: Geometry, catalog: Parameters<Regla>[0]['catalogo']): Hallazgo[] {
  const runner = catalog.herrajes.find((h) => h.id.startsWith('corredera') && h.holguraLateral !== null)
  if (!runner?.holguraLateral) return []
  const gap = runner.holguraLateral
  return drawerSides(design, geo.boxes).flatMap(({ group, side, towards, support }): Hallazgo[] => {
    // A declared runner joint is checked above, with its own hardware.
    if (support && design.uniones.some((u) => u.tipo === 'corredera' && [u.a, u.b].includes(side.id))) return []
    const lado = towards < 0 ? 'izq' : 'der'
    if (!support)
      return [
        {
          codigo: 'R9_CAJONES',
          severidad: 'critico',
          piezas: [side.id],
          mensaje: `El lado ${towards < 0 ? 'izquierdo' : 'derecho'} de ${drawerName(design, group)} no tiene dónde atornillar la corredera: hace falta una pieza a ${gap} mm de la caja.`,
          datos: { lado, grupo: group },
          alternativas: [{ clave: 'apoyo-corredera', descripcion: `Una pieza junto al cajón, a ${gap} mm, para la corredera`, datos: { lado, grupo: group } }],
        },
      ]
    if (Math.abs(support.distance - gap) <= SUPUESTOS.cajones.toleranciaCorredera) return []
    return [
      {
        codigo: 'R9_CAJONES',
        severidad: 'critico',
        piezas: [side.id, support.piece.id],
        mensaje:
          support.distance < gap
            ? `La corredera necesita ${gap} mm junto a ${support.piece.nombre} y solo hay ${roundTo(support.distance)}: ${drawerName(design, group)} no entra.`
            : `Junto a ${support.piece.nombre} hay ${roundTo(support.distance)} mm y la corredera ocupa ${gap}: ${drawerName(design, group)} quedaría flojo.`,
        datos: { hueco: roundTo(support.distance), necesita: gap, grupo: group },
        alternativas: [{ clave: 'ajustar-caja', descripcion: `Dejar ${gap} mm por lado entre la caja y el mueble`, datos: { holgura: gap } }],
      },
    ]
  })
}

/** A drawer that reaches the ground drags on it when it opens. */
function floorClearance(design: Diseno, geo: Geometry): Hallazgo[] {
  const groups = [...new Set(design.piezas.filter((p) => p.rol === 'frente-cajon' && p.grupo).map((p) => p.grupo!))]
  return groups.flatMap((g): Hallazgo[] => {
    const pieces = design.piezas.filter((p) => p.grupo === g && geo.boxes.has(p.id))
    const bottom = Math.min(...pieces.map((p) => geo.boxes.get(p.id)!.y0))
    if (bottom >= SUPUESTOS.cajones.holguraSuelo) return []
    return [
      {
        codigo: 'R9_CAJONES',
        severidad: 'critico',
        piezas: pieces.map((p) => p.id),
        mensaje: `${drawerName(design, g).replace(/^./, (c) => c.toUpperCase())} llega al suelo (queda a ${roundTo(bottom)} mm): arrastraría al abrir. Deja al menos ${SUPUESTOS.cajones.holguraSuelo} mm abajo.`,
        datos: { abajo: roundTo(bottom), grupo: g },
        alternativas: [{ clave: 'subir-cajon', descripcion: `Subir el cajón ${SUPUESTOS.cajones.holguraSuelo} mm sobre el suelo`, datos: { holgura: SUPUESTOS.cajones.holguraSuelo } }],
      },
    ]
  })
}
