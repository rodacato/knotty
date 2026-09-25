import { findingKey, type RuleContext, type Finding, type Rule } from './finding'
import { drawerRule } from './rules/drawers'
import { rackingRule } from './rules/racking'
import { deflectionRule } from './rules/deflection'
import { screwRule } from './rules/screws'
import { jointThicknessRule } from './rules/jointThickness'
import { baseRule, doorRule, grainRule, tippingRule } from './rules/usage'
import { typologyRule } from '../typology/typology'

// Every rule over the design, the most serious findings first.

const RULES: Rule[] = [deflectionRule, jointThicknessRule, screwRule, tippingRule, rackingRule, doorRule, baseRule, grainRule, drawerRule, typologyRule]
const ORDER = { critico: 0, recomendacion: 1, detalle: 2 }

export const reviewStructure = (ctx: RuleContext): Finding[] => RULES.flatMap((r) => r(ctx)).sort((a, b) => ORDER[a.severity] - ORDER[b.severity])

/** The critical findings a change brings: those already there do not hold a new change back. */
export function newCriticals(before: Finding[], after: Finding[]) {
  const previous = new Set(before.filter((h) => h.severity === 'critico').map(findingKey))
  return after.filter((h) => h.severity === 'critico' && !previous.has(findingKey(h)))
}
