import { findingKey, type RuleContext, type Finding, type Rule } from './finding'
import { drawerRule } from './rules/drawers'
import { rackingRule } from './rules/racking'
import { deflectionRule } from './rules/deflection'
import { screwRule } from './rules/screws'
import { jointThicknessRule } from './rules/jointThickness'
import { baseRule, doorRule, grainRule, tippingRule } from './rules/usage'
import { typologyRule } from '../typology/typology'

const REGLAS: Rule[] = [deflectionRule, jointThicknessRule, screwRule, tippingRule, rackingRule, doorRule, baseRule, grainRule, drawerRule, typologyRule]
const ORDEN = { critico: 0, recomendacion: 1, detalle: 2 }

export const reviewStructure = (ctx: RuleContext): Finding[] => REGLAS.flatMap((r) => r(ctx)).sort((a, b) => ORDEN[a.severity] - ORDEN[b.severity])

/** Los críticos que aparecen con un cambio: los que ya estaban no frenan un ajuste nuevo. */
export function newCriticals(antes: Finding[], despues: Finding[]) {
  const previos = new Set(antes.filter((h) => h.severity === 'critico').map(findingKey))
  return despues.filter((h) => h.severity === 'critico' && !previos.has(findingKey(h)))
}
