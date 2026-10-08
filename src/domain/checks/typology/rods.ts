import { ASSUMPTIONS } from '../../assumptions'
import { rodRuns } from '../../design/rods'
import type { Finding, RuleContext } from '../structure/finding'
import { WARDROBE_DEPTH } from './constraints'

// A rod to hang clothes from is judged wherever there is one, whatever the furniture is called: how far it runs, and the room the clothes on it have.

const names = (ctx: RuleContext, ids: string[]) => ids.map((id) => ctx.design.pieces.find((p) => p.id === id)?.name ?? id)

export function rodFindings(ctx: RuleContext): Finding[] {
  const { maxSpan, shortHang } = ASSUMPTIONS.rods
  const [minDepth] = WARDROBE_DEPTH
  return rodRuns(ctx.design, ctx.geo.boxes).flatMap((rod) => {
    const report = (check: string, message: string, data: Finding['data']): Finding => ({ code: 'R10_USE', severity: 'recommendation', pieces: [rod.ceiling, ...rod.walls], check, message, data, alternatives: [] })
    const [span, below, depth] = [rod.x1 - rod.x0, rod.below, rod.depth].map(Math.round)
    const [left, right] = names(ctx, rod.walls)
    const found: Finding[] = []
    if (span > maxSpan) found.push(report('rod.span', `El tubo para colgar cruza ${span} mm de ${left} a ${right} sin apoyo al centro: pasando de ${maxSpan} mm se cuelga con la ropa. Divide el hueco o ponle un soporte al centro.`, { span, max: maxSpan }))
    if (depth < minDepth) found.push(report('rod.depth', `El tubo entre ${left} y ${right} tiene ${depth} mm de fondo: los ganchos de ropa piden unos ${minDepth} para caber de frente.`, { depth, min: minDepth }))
    if (below < shortHang) found.push(report('rod.height', `Bajo el tubo entre ${left} y ${right} quedan ${below} mm: una camisa colgada pide unos ${shortHang}.`, { below, min: shortHang }))
    return found
  })
}
