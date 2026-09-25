import { roundTo } from '../../diseno/resolve'
import { gapBetween } from '../../validation/contact'
import type { Design } from '../../diseno/schema'
import { drawerSides } from '../../diseno/drawers'
import type { Geometry } from '../../diseno/resolve'
import type { Finding, Rule } from '../finding'
import { ASSUMPTIONS } from '../assumptions'

/** R9: the runner fits exactly, the bottom holds, and neither the front nor the box rubs. */
export const drawerRule: Rule = ({ design, geo, catalog, contacts }) => {
  const found: Finding[] = []
  const groups = [...new Set(design.pieces.filter((p) => p.role === 'drawer-front' && p.group).map((p) => p.group!))]

  for (const u of design.joints.filter((x) => x.type === 'drawer-slide')) {
    const a = geo.boxes.get(u.a)
    const b = geo.boxes.get(u.b)
    const gap = a && b ? gapBetween(a, b) : null
    const runner = catalog.herrajes.find((h) => u.hardware.some((x) => x.hardwareId === h.id) && h.holguraLateral !== null) ?? catalog.herrajes.find((h) => h.holguraLateral !== null)
    if (!gap || !runner?.holguraLateral) continue
    const off = gap.distance - runner.holguraLateral
    if (Math.abs(off) <= ASSUMPTIONS.drawers.runnerTolerance) continue
    const name = design.pieces.find((p) => p.id === u.a)?.name ?? u.a
    found.push({
      code: 'R9_DRAWERS',
      severity: 'critical',
      pieces: [u.a, u.b],
      message:
        off < 0
          ? `La corredera necesita ${runner.holguraLateral} mm junto a ${name} y solo hay ${roundTo(gap.distance)}: el cajón no entra.`
          : `Junto a ${name} hay ${roundTo(gap.distance)} mm y la corredera ocupa ${runner.holguraLateral}: el cajón quedaría flojo.`,
      data: { union: u.id, hueco: roundTo(gap.distance), necesita: runner.holguraLateral },
      alternatives: [{ key: 'ajustar-caja', description: `Dejar ${runner.holguraLateral} mm por lado entre la caja y el mueble`, data: { holgura: runner.holguraLateral } }],
    })
  }

  found.push(...runnerSupport(design, geo, catalog), ...floorClearance(design, geo))

  for (const g of groups) {
    const bottom = design.pieces.find((p) => p.group === g && p.role === 'drawer-bottom')
    const bottomBox = bottom && geo.boxes.get(bottom.id)
    const thickness = bottom && geo.thicknesses.get(bottom.id)
    if (bottom && bottomBox && thickness !== undefined && thickness < ASSUMPTIONS.drawers.minBottom && bottomBox.x1 - bottomBox.x0 > ASSUMPTIONS.drawers.thinBottomWidth)
      found.push({
        code: 'R9_DRAWERS',
        severity: 'recommendation',
        pieces: [bottom.id],
        message: `${bottom.name} es de ${thickness} mm y mide ${Math.round(bottomBox.x1 - bottomBox.x0)} mm de ancho: con peso se vence y se sale de abajo.`,
        data: { espesor: thickness, ancho: Math.round(bottomBox.x1 - bottomBox.x0) },
        alternatives: [{ key: 'fondo-6', description: 'Fondo de 6 mm', data: { material: 'TR6' } }],
      })

    const front = design.pieces.find((p) => p.group === g && p.role === 'drawer-front')
    if (!front) continue
    const frontRubs = contacts.filter((c) => (c.a === front.id || c.b === front.id) && design.pieces.find((p) => p.id === (c.a === front.id ? c.b : c.a))?.group !== g)
    if (frontRubs.length)
      found.push({
        code: 'R9_DRAWERS',
        severity: 'recommendation',
        pieces: [front.id, ...frontRubs.map((c) => (c.a === front.id ? c.b : c.a))],
        message: `${front.name} toca otras piezas sin holgura: va a rozar al abrir.`,
        data: { toca: frontRubs.length },
        alternatives: [{ key: 'holgura-frente', description: 'Dejar 2 mm de holgura alrededor del frente', data: { holgura: 2 } }],
      })

    const box = design.pieces.filter((p) => p.group === g && p.role !== 'drawer-front').map((p) => p.id)
    const rubs = contacts.filter((c) => box.includes(c.a) !== box.includes(c.b) && [c.a, c.b].some((id) => design.pieces.find((p) => p.id === id)?.group !== g))
    if (rubs.length) {
      const others = [...new Set(rubs.map((c) => (box.includes(c.a) ? c.b : c.a)))]
      found.push({
        code: 'R9_DRAWERS',
        severity: 'recommendation',
        pieces: [...new Set(rubs.map((c) => (box.includes(c.a) ? c.a : c.b))), ...others],
        message: `La caja de ${drawerName(design, g)} toca ${others.map((id) => design.pieces.find((p) => p.id === id)?.name ?? id).join(', ')}: va a rozar al abrir. Con correderas laterales la caja va separada de todo.`,
        data: { toca: others.length },
        alternatives: [],
      })
    }
  }
  return found
}

const drawerName = (design: Design, group: string) => {
  const front = design.pieces.find((p) => p.group === group && p.role === 'drawer-front')
  return front ? front.name.replace(/^Frente de /i, '') : group
}
/** Each side of a drawer box needs something beside it to screw the runner to, at the runner's gap: freeform designs too. */
function runnerSupport(design: Design, geo: Geometry, catalog: Parameters<Rule>[0]['catalog']): Finding[] {
  const runner = catalog.herrajes.find((h) => h.id.startsWith('corredera') && h.holguraLateral !== null)
  if (!runner?.holguraLateral) return []
  const gap = runner.holguraLateral
  return drawerSides(design, geo.boxes).flatMap(({ group, side, towards, support }): Finding[] => {
    // A declared runner joint is checked above, with its own hardware.
    if (support && design.joints.some((u) => u.type === 'drawer-slide' && [u.a, u.b].includes(side.id))) return []
    const lado = towards < 0 ? 'izq' : 'der'
    if (!support)
      return [
        {
          code: 'R9_DRAWERS',
          severity: 'critical',
          pieces: [side.id],
          message: `El lado ${towards < 0 ? 'izquierdo' : 'derecho'} de ${drawerName(design, group)} no tiene dónde atornillar la corredera: hace falta una pieza a ${gap} mm de la caja.`,
          data: { lado, grupo: group },
          alternatives: [{ key: 'apoyo-corredera', description: `Una pieza junto al cajón, a ${gap} mm, para la corredera`, data: { lado, grupo: group } }],
        },
      ]
    if (Math.abs(support.distance - gap) <= ASSUMPTIONS.drawers.runnerTolerance) return []
    return [
      {
        code: 'R9_DRAWERS',
        severity: 'critical',
        pieces: [side.id, support.piece.id],
        message:
          support.distance < gap
            ? `La corredera necesita ${gap} mm junto a ${support.piece.name} y solo hay ${roundTo(support.distance)}: ${drawerName(design, group)} no entra.`
            : `Junto a ${support.piece.name} hay ${roundTo(support.distance)} mm y la corredera ocupa ${gap}: ${drawerName(design, group)} quedaría flojo.`,
        data: { hueco: roundTo(support.distance), necesita: gap, grupo: group },
        alternatives: [{ key: 'ajustar-caja', description: `Dejar ${gap} mm por lado entre la caja y el mueble`, data: { holgura: gap } }],
      },
    ]
  })
}

/** A drawer that reaches the ground drags on it when it opens. */
function floorClearance(design: Design, geo: Geometry): Finding[] {
  const groups = [...new Set(design.pieces.filter((p) => p.role === 'drawer-front' && p.group).map((p) => p.group!))]
  return groups.flatMap((g): Finding[] => {
    const pieces = design.pieces.filter((p) => p.group === g && geo.boxes.has(p.id))
    const bottom = Math.min(...pieces.map((p) => geo.boxes.get(p.id)!.y0))
    if (bottom >= ASSUMPTIONS.drawers.floorClearance) return []
    return [
      {
        code: 'R9_DRAWERS',
        severity: 'critical',
        pieces: pieces.map((p) => p.id),
        message: `${drawerName(design, g).replace(/^./, (c) => c.toUpperCase())} llega al suelo (queda a ${roundTo(bottom)} mm): arrastraría al abrir. Deja al menos ${ASSUMPTIONS.drawers.floorClearance} mm abajo.`,
        data: { abajo: roundTo(bottom), grupo: g },
        alternatives: [{ key: 'subir-cajon', description: `Subir el cajón ${ASSUMPTIONS.drawers.floorClearance} mm sobre el suelo`, data: { holgura: ASSUMPTIONS.drawers.floorClearance } }],
      },
    ]
  })
}
