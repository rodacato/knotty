import { roundTo } from '../../diseno/resolve'
import { contactBetween, jointLength } from '../../validation/contact'
import type { Finding, Rule } from '../finding'
import { ASSUMPTIONS } from '../assumptions'

const INCH = 25.4
/** Millimetres as a hardware store says them: 1¼", ⅝". */
const inches = (mm: number) => {
  const eighths = Math.round((mm / INCH) * 8)
  const whole = Math.floor(eighths / 8)
  const rest = eighths % 8
  const fraction = rest ? { 2: '¼', 4: '½', 6: '¾' }[rest] ?? `${rest}/8` : ''
  return `${whole || ''}${fraction}"`
}

/** R3: a screw bites enough, a pocket screw does not poke out, and none sits too close to the end of the joint. */
export const screwRule: Rule = ({ design, geo, catalog }) =>
  design.joints.flatMap((u): Finding[] => {
    if (u.type !== 'butt-screw' && u.type !== 'pocket-screw') return []
    const a = design.pieces.find((p) => p.id === u.a)
    const b = design.pieces.find((p) => p.id === u.b)
    const ta = geo.thicknesses.get(u.a)
    const boxA = geo.boxes.get(u.a)
    const boxB = geo.boxes.get(u.b)
    if (!a || !b || ta === undefined || !boxA || !boxB) return []
    const found: Finding[] = []
    const screws = u.hardware.map((h) => catalog.herrajes.find((x) => x.id === h.hardwareId)).filter((h) => h?.largo)

    const tb = geo.thicknesses.get(u.b) ?? 0
    // Touching b's face, the screw goes straight into it: what matters is that it does not come out the other side.
    const intoFace = contactBetween(u.a, boxA, u.b, boxB)?.axis === b.normal
    for (const t of screws) {
      const length = t!.largo!
      if (u.type === 'butt-screw' && intoFace) {
        const bite = length - ta
        if (bite <= tb - 3) continue
        found.push({
          code: 'R3_TORNILLOS',
          severity: 'critico',
          pieces: [u.a, u.b],
          message: `El ${t!.nombre.toLowerCase()} atraviesa ${a.name} (${ta} mm) y entra ${roundTo(bite)} mm en la cara de ${b.name}, que mide ${tb} mm: se asoma del otro lado.`,
          data: { union: u.id, largo: length, entra: roundTo(bite), espesor: tb },
          alternatives: [{ key: 'tornillo-mas-corto', description: `Un tornillo de ${inches(ta + tb - 5)} o menos`, data: { largo: ta + tb - 5 } }],
        })
      } else if (u.type === 'butt-screw') {
        const bite = length - ta
        if (bite >= ASSUMPTIONS.screws.minPenetration) continue
        const suggested = catalog.herrajes
          .filter((h) => h.largo && h.id.startsWith('tornillo-') && !h.id.includes('bolsillo') && h.largo - ta >= ASSUMPTIONS.screws.minPenetration)
          .sort((x, y) => x.largo! - y.largo!)[0]
        found.push({
          code: 'R3_TORNILLOS',
          severity: 'recomendacion',
          pieces: [u.a, u.b],
          message: `El ${t!.nombre.toLowerCase()} atraviesa ${a.name} (${ta} mm) y solo entra ${roundTo(bite)} mm en ${b.name}; conviene que entre al menos ${ASSUMPTIONS.screws.minPenetration} mm.`,
          data: { union: u.id, largo: length, entra: roundTo(bite) },
          alternatives: suggested ? [{ key: 'tornillo-mas-largo', description: `Usar ${suggested.nombre.toLowerCase()}`, data: { herrajeId: suggested.id } }] : [],
        })
      } else {
        const longest = ASSUMPTIONS.screws.pocketScrews.find((f) => ta <= f.upTo)?.length
        if (longest === undefined || length <= longest + 0.5) continue
        found.push({
          code: 'R3_TORNILLOS',
          severity: 'recomendacion',
          pieces: [u.a, u.b],
          message: `En ${a.name} de ${ta} mm, un tornillo de bolsillo de ${inches(length)} puede asomarse; para ese espesor va de ${inches(longest)}.`,
          data: { union: u.id, largo: length, maximo: longest },
          alternatives: [{ key: 'tornillo-bolsillo-corto', description: `Tornillo de bolsillo de ${inches(longest)}`, data: { largo: longest } }],
        })
      }
    }

    const joint = jointLength(boxA, boxB)
    const count = u.hardware.reduce((n, h) => n + (h.count ?? 2), 0)
    if (u.type === 'butt-screw' && !intoFace && joint > 0 && count >= 2 && joint < 2 * ASSUMPTIONS.screws.endDistance + 20)
      found.push({
        code: 'R3_TORNILLOS',
        severity: 'recomendacion',
        pieces: [u.a, u.b],
        message: `La junta entre ${a.name} y ${b.name} mide ${roundTo(joint, 0)} mm: dos tornillos quedarían a menos de ${ASSUMPTIONS.screws.endDistance} mm del extremo y pueden rajar el canto.`,
        data: { union: u.id, junta: roundTo(joint, 0) },
        alternatives: [
          { key: 'un-tornillo', description: 'Un solo tornillo al centro', data: { cantidad: 1 } },
          { key: 'tarugo', description: 'Tarugo con pegamento', data: { tipo: 'tarugo' } },
        ],
      })
    return found
  })
