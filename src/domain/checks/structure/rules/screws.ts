import { roundTo } from '../../../design/resolve'
import { contactBetween, jointLength } from '../../../design/validation/contact'
import { hardwareByRole } from '../../../materials/catalog'
import type { Finding, Rule } from '../finding'
import { ASSUMPTIONS, pocketScrewFor } from '../assumptions'
import { noReference, type Source } from '../../../sources'

const INCH = 25.4
export const SCREW_RULE_SOURCES: Record<string, Source> = { INCH: noReference('a unit: millimetres in an inch, how screws are sold') }
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
    const screws = u.hardware.map((h) => catalog.hardware.find((x) => x.id === h.hardwareId)).filter((h) => h?.length)

    const tb = geo.thicknesses.get(u.b) ?? 0
    // Touching b's face, the screw goes straight into it: what matters is that it does not come out the other side.
    const intoFace = contactBetween(u.a, boxA, u.b, boxB)?.axis === b.normal
    for (const t of screws) {
      const length = t!.length!
      if (u.type === 'butt-screw' && intoFace) {
        const bite = length - ta
        if (bite <= tb - ASSUMPTIONS.screws.faceMargin) continue
        const longest = ta + tb - ASSUMPTIONS.screws.faceMargin
        found.push({
          code: 'R3_SCREWS',
          severity: 'critical',
          pieces: [u.a, u.b],
          check: 'screw.pokes-through',
          message: `El ${t!.name.toLowerCase()} atraviesa ${a.name} (${ta} mm) y entra ${roundTo(bite)} mm en la cara de ${b.name}, que mide ${tb} mm: se asoma del otro lado.`,
          data: { joint: u.id, length: length, bite: roundTo(bite), thickness: tb },
          alternatives: [{ key: 'shorter-screw', description: `Un tornillo de ${inches(longest)} o menos`, data: { length: longest } }],
        })
      } else if (u.type === 'butt-screw') {
        const bite = length - ta
        if (bite >= ASSUMPTIONS.screws.minPenetration) continue
        const suggested = hardwareByRole(catalog, 'screw')
          .filter((h) => h.length && h.length - ta >= ASSUMPTIONS.screws.minPenetration)
          .sort((x, y) => x.length! - y.length!)[0]
        found.push({
          code: 'R3_SCREWS',
          severity: 'recommendation',
          pieces: [u.a, u.b],
          check: 'screw.short-bite',
          message: `El ${t!.name.toLowerCase()} atraviesa ${a.name} (${ta} mm) y solo entra ${roundTo(bite)} mm en ${b.name}; conviene que entre al menos ${ASSUMPTIONS.screws.minPenetration} mm.`,
          data: { joint: u.id, length: length, bite: roundTo(bite) },
          alternatives: suggested ? [{ key: 'longer-screw', description: `Usar ${suggested.name.toLowerCase()}`, data: { hardwareId: suggested.id } }] : [],
        })
      } else {
        const fitting = pocketScrewFor(ta)
        if (!fitting || length <= fitting.length + 0.5) continue
        const longest = fitting.length
        found.push({
          code: 'R3_SCREWS',
          severity: 'recommendation',
          pieces: [u.a, u.b],
          check: 'pocket-screw.too-long',
          message: `En ${a.name} de ${ta} mm, un tornillo de bolsillo de ${inches(length)} puede asomarse; para ese espesor va de ${inches(longest)}.`,
          data: { joint: u.id, length: length, max: longest },
          alternatives: [{ key: 'short-pocket-screw', description: `Tornillo de bolsillo de ${inches(longest)}`, data: { length: longest, hardwareId: fitting.hardwareId } }],
        })
      }
    }

    const joint = jointLength(boxA, boxB)
    const count = u.hardware.reduce((n, h) => n + (h.count ?? 2), 0)
    if (u.type === 'butt-screw' && !intoFace && joint > 0 && count >= 2 && joint < 2 * ASSUMPTIONS.screws.endDistance + ASSUMPTIONS.screws.pairRoom)
      found.push({
        code: 'R3_SCREWS',
        severity: 'recommendation',
        pieces: [u.a, u.b],
        check: 'screw.end-distance',
        message: `La junta entre ${a.name} y ${b.name} mide ${roundTo(joint, 0)} mm: dos tornillos quedarían a menos de ${ASSUMPTIONS.screws.endDistance} mm del extremo y pueden rajar el canto.`,
        data: { joint: u.id, jointLength: roundTo(joint, 0) },
        alternatives: [
          { key: 'one-screw', description: 'Un solo tornillo al centro', data: { count: 1 } },
          { key: 'dowel', description: 'Tarugo con pegamento', data: { type: 'dowel' } },
        ],
      })
    return found
  })
