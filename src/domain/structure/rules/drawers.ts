import { roundTo } from '../../design/resolve'
import { gapBetween } from '../../validation/contact'
import type { Design } from '../../design/schema'
import { drawerSides } from '../../design/drawers'
import { CONTACT_TOLERANCE, drawerGroups } from '../../design/boxes'
import { slideFor, slideForBox, SLIDE_BACK_CLEARANCE, thinnestBoard, type Catalog } from '../../materials/catalog'
import type { Geometry } from '../../design/resolve'
import type { Finding, Rule } from '../finding'
import { ASSUMPTIONS } from '../assumptions'

/** R9: the runner fits exactly, the bottom holds, and neither the front nor the box rubs. */
export const drawerRule: Rule = ({ design, geo, catalog, contacts }) => {
  const found: Finding[] = []
  const groups = drawerGroups(design)

  for (const u of design.joints.filter((x) => x.type === 'drawer-slide')) {
    const a = geo.boxes.get(u.a)
    const b = geo.boxes.get(u.b)
    const gap = a && b ? gapBetween(a, b) : null
    const runner = catalog.hardware.find((h) => u.hardware.some((x) => x.hardwareId === h.id) && h.sideClearance !== null) ?? slideForBox(catalog, drawerSideLength(design, geo, u.a, u.b))
    if (!gap || !runner?.sideClearance) continue
    const off = gap.distance - runner.sideClearance
    if (Math.abs(off) <= ASSUMPTIONS.drawers.runnerTolerance) continue
    const name = design.pieces.find((p) => p.id === u.a)?.name ?? u.a
    found.push({
      code: 'R9_DRAWERS',
      check: 'drawer.slide-clearance',
      severity: 'critical',
      pieces: [u.a, u.b],
      message:
        off < 0
          ? `La corredera necesita ${runner.sideClearance} mm junto a ${name} y solo hay ${roundTo(gap.distance)}: el cajón no entra.`
          : `Junto a ${name} hay ${roundTo(gap.distance)} mm y la corredera ocupa ${runner.sideClearance}: el cajón quedaría flojo.`,
      data: { joint: u.id, gap: roundTo(gap.distance), needs: runner.sideClearance },
      alternatives: [{ key: 'fit-box', description: `Dejar ${runner.sideClearance} mm por lado entre la caja y el mueble`, data: { clearance: runner.sideClearance } }],
    })
  }

  found.push(...slideLength(design, geo, catalog), ...runnerSupport(design, geo, catalog), ...floorClearance(design, geo))

  for (const g of groups) {
    const bottom = design.pieces.find((p) => p.group === g && p.role === 'drawer-bottom')
    const bottomBox = bottom && geo.boxes.get(bottom.id)
    const thickness = bottom && geo.thicknesses.get(bottom.id)
    const thicker = thinnestBoard(catalog, 'back', ASSUMPTIONS.drawers.minBottom)
    if (bottom && bottomBox && thickness !== undefined && thickness < ASSUMPTIONS.drawers.minBottom && bottomBox.x1 - bottomBox.x0 > ASSUMPTIONS.drawers.thinBottomWidth)
      found.push({
        code: 'R9_DRAWERS',
        check: 'drawer.thin-bottom',
        severity: 'recommendation',
        pieces: [bottom.id],
        message: `${bottom.name} es de ${thickness} mm y mide ${Math.round(bottomBox.x1 - bottomBox.x0)} mm de ancho: con peso se vence y se sale de abajo.`,
        data: { thickness: thickness, width: Math.round(bottomBox.x1 - bottomBox.x0) },
        alternatives: thicker ? [{ key: 'bottom-6mm', description: `Fondo de ${thicker.thickness} mm`, data: { material: thicker.id } }] : [],
      })

    const front = design.pieces.find((p) => p.group === g && p.role === 'drawer-front')
    if (!front) continue
    const frontRubs = contacts.filter((c) => (c.a === front.id || c.b === front.id) && design.pieces.find((p) => p.id === (c.a === front.id ? c.b : c.a))?.group !== g)
    if (frontRubs.length)
      found.push({
        code: 'R9_DRAWERS',
        check: 'drawer.front-rubs',
        severity: 'recommendation',
        pieces: [front.id, ...frontRubs.map((c) => (c.a === front.id ? c.b : c.a))],
        message: `${front.name} toca otras piezas sin holgura: va a rozar al abrir.`,
        data: { touches: frontRubs.length },
        alternatives: [{ key: 'front-clearance', description: 'Dejar 2 mm de holgura alrededor del frente', data: { clearance: 2 } }],
      })

    const box = design.pieces.filter((p) => p.group === g && p.role !== 'drawer-front').map((p) => p.id)
    const rubs = contacts.filter((c) => box.includes(c.a) !== box.includes(c.b) && [c.a, c.b].some((id) => design.pieces.find((p) => p.id === id)?.group !== g))
    if (rubs.length) {
      const others = [...new Set(rubs.map((c) => (box.includes(c.a) ? c.b : c.a)))]
      found.push({
        code: 'R9_DRAWERS',
        check: 'drawer.box-rubs',
        severity: 'recommendation',
        pieces: [...new Set(rubs.map((c) => (box.includes(c.a) ? c.a : c.b))), ...others],
        message: `La caja de ${drawerName(design, g)} toca ${others.map((id) => design.pieces.find((p) => p.id === id)?.name ?? id).join(', ')}: va a rozar al abrir. Con correderas laterales la caja va separada de todo.`,
        data: { touches: others.length },
        alternatives: [],
      })
    }
  }
  return found
}

const cmOf = (mm: number) => `${roundTo(mm / 10, 1)} cm`

/** A slide as long as its box: longer, it does not fit behind the front; shorter than one the box takes, the drawer does not open all the way. */
function slideLength(design: Design, geo: Geometry, catalog: Catalog): Finding[] {
  return design.joints
    .filter((u) => u.type === 'drawer-slide')
    .flatMap((u): Finding[] => {
      const slide = u.hardware.map((h) => catalog.hardware.find((x) => x.id === h.hardwareId)).find((h) => h?.role === 'drawer-slide' && h.length !== null)
      if (!slide?.length) return []
      const length = drawerSideLength(design, geo, u.a, u.b)
      const group = design.pieces.find((p) => (p.id === u.a || p.id === u.b) && p.role === 'drawer-side')?.group
      if (!length || !group) return []
      const right = slideFor(catalog, length + SLIDE_BACK_CLEARANCE)
      const swap = right && right.id !== slide.id ? [{ key: 'matching-slide' as const, description: `Usar ${right.name.toLowerCase()}`, data: { joint: u.id, hardwareId: right.id } }] : []
      const name = drawerName(design, group)
      if (slide.length > length + CONTACT_TOLERANCE)
        return [
          {
            code: 'R9_DRAWERS',
            check: 'drawer.slide-too-long',
            severity: 'critical',
            pieces: [u.a, u.b],
            message: `La corredera de ${cmOf(slide.length)} es más larga que la caja de ${name}, que mide ${roundTo(length, 0)} mm de fondo: no se puede atornillar completa.`,
            data: { joint: u.id, slide: slide.length, box: roundTo(length, 0) },
            alternatives: swap,
          },
        ]
      if (right && right.length > slide.length)
        return [
          {
            code: 'R9_DRAWERS',
            check: 'drawer.slide-too-short',
            severity: 'recommendation',
            pieces: [u.a, u.b],
            message: `La caja de ${name} mide ${roundTo(length, 0)} mm de fondo y su corredera ${cmOf(slide.length)}: el cajón no abre completo. La de ${cmOf(right.length)} le queda.`,
            data: { joint: u.id, slide: slide.length, box: roundTo(length, 0) },
            alternatives: swap,
          },
        ]
      return []
    })
}

/** How long the drawer side of a runner joint is, front to back: the length its slide takes. */
function drawerSideLength(design: Design, geo: Geometry, a: string, b: string) {
  const side = [a, b].find((id) => design.pieces.find((p) => p.id === id)?.role === 'drawer-side') ?? a
  const box = geo.boxes.get(side)
  return box ? box.z1 - box.z0 : 0
}

const drawerName = (design: Design, group: string) => {
  const front = design.pieces.find((p) => p.group === group && p.role === 'drawer-front')
  return front ? front.name.replace(/^Frente de /i, '') : group
}
/** Each side of a drawer box needs something beside it to screw the runner to, at the runner's gap: freeform designs too. */
function runnerSupport(design: Design, geo: Geometry, catalog: Catalog): Finding[] {
  return drawerSides(design, geo.boxes).flatMap(({ group, side, towards, support }): Finding[] => {
    const box = geo.boxes.get(side.id)!
    const runner = slideForBox(catalog, box.z1 - box.z0)
    if (!runner) return []
    const gap = runner.sideClearance
    // A declared runner joint is checked above, with its own hardware.
    if (support && design.joints.some((u) => u.type === 'drawer-slide' && [u.a, u.b].includes(side.id))) return []
    const direction = towards < 0 ? 'left' : 'right'
    if (!support)
      return [
        {
          code: 'R9_DRAWERS',
          check: 'drawer.no-slide-support',
          severity: 'critical',
          pieces: [side.id],
          message: `El lado ${towards < 0 ? 'izquierdo' : 'derecho'} de ${drawerName(design, group)} no tiene dónde atornillar la corredera: hace falta una pieza a ${gap} mm de la caja.`,
          data: { side: direction, group },
          alternatives: [{ key: 'slide-support', description: `Una pieza junto al cajón, a ${gap} mm, para la corredera`, data: { side: direction, group } }],
        },
      ]
    if (Math.abs(support.distance - gap) <= ASSUMPTIONS.drawers.runnerTolerance) return []
    return [
      {
        code: 'R9_DRAWERS',
        check: 'drawer.slide-gap',
        severity: 'critical',
        pieces: [side.id, support.piece.id],
        message:
          support.distance < gap
            ? `La corredera necesita ${gap} mm junto a ${support.piece.name} y solo hay ${roundTo(support.distance)}: ${drawerName(design, group)} no entra.`
            : `Junto a ${support.piece.name} hay ${roundTo(support.distance)} mm y la corredera ocupa ${gap}: ${drawerName(design, group)} quedaría flojo.`,
        data: { gap: roundTo(support.distance), needs: gap, group: group },
        alternatives: [{ key: 'fit-box', description: `Dejar ${gap} mm por lado entre la caja y el mueble`, data: { clearance: gap } }],
      },
    ]
  })
}

/** A drawer that reaches the ground drags on it when it opens. */
function floorClearance(design: Design, geo: Geometry): Finding[] {
  return drawerGroups(design).flatMap((g): Finding[] => {
    const pieces = design.pieces.filter((p) => p.group === g && geo.boxes.has(p.id))
    const bottom = Math.min(...pieces.map((p) => geo.boxes.get(p.id)!.y0))
    if (bottom >= ASSUMPTIONS.drawers.floorClearance) return []
    return [
      {
        code: 'R9_DRAWERS',
        check: 'drawer.floor',
        severity: 'critical',
        pieces: pieces.map((p) => p.id),
        message: `${drawerName(design, g).replace(/^./, (c) => c.toUpperCase())} llega al suelo (queda a ${roundTo(bottom)} mm): arrastraría al abrir. Deja al menos ${ASSUMPTIONS.drawers.floorClearance} mm abajo.`,
        data: { bottom: roundTo(bottom), group: g },
        alternatives: [{ key: 'raise-drawer', description: `Subir el cajón ${ASSUMPTIONS.drawers.floorClearance} mm sobre el suelo`, data: { clearance: ASSUMPTIONS.drawers.floorClearance } }],
      },
    ]
  })
}
