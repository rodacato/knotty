import { findingKey, type RuleContext, type Finding } from './finding'
import { RULES, appliesTo } from './registry'
import { detectKind } from '../typology/typology'

// Every rule over the design that applies to its kind of furniture, the most serious findings first.

const ORDER = { critical: 0, recommendation: 1, detail: 2 }

export function reviewStructure(ctx: RuleContext): Finding[] {
  const kind = detectKind(ctx.design)
  return RULES.filter((r) => appliesTo(r, kind))
    .flatMap((r) => r.check(ctx))
    .sort((a, b) => ORDER[a.severity] - ORDER[b.severity])
}

/** The critical findings a change brings: those already there do not hold a new change back. */
export function newCriticals(before: Finding[], after: Finding[]) {
  const previous = new Set(before.filter((h) => h.severity === 'critical').map(findingKey))
  return after.filter((h) => h.severity === 'critical' && !previous.has(findingKey(h)))
}
