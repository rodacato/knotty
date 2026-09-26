import { z } from 'zod'
import { findingKey, type Finding, type Severity } from './finding'
import { ruleVersion } from './registry'

// An acceptance holds for the finding as it was: if it gets worse, or its rule now judges differently, it is pending again and says why.

const SEVERITIES = ['critical', 'recommendation', 'detail'] as const satisfies readonly Severity[]

export const AcceptedFinding = z.object({
  key: z.string(),
  title: z.string(),
  at: z.string(),
  /** Null for what an older Knotty saved, which did not keep it. */
  severity: z.enum(SEVERITIES).nullable(),
  version: z.number().int().positive(),
})
export type AcceptedFinding = z.infer<typeof AcceptedFinding>

const RANK: Record<Severity, number> = { detail: 0, recommendation: 1, critical: 2 }
const LABEL: Record<Severity, string> = { critical: 'crítico', recommendation: 'recomendación', detail: 'detalle' }

type Accepting = Pick<Finding, 'code' | 'pieces' | 'check' | 'severity'>

export const acceptFinding = (finding: Accepting, title: string, at: string): AcceptedFinding => ({ key: findingKey(finding), title, at, severity: finding.severity, version: ruleVersion(finding.code) })

const acceptanceOf = (finding: Accepting, accepted: readonly AcceptedFinding[]) => accepted.find((a) => a.key === findingKey(finding))

/** Why the acceptance of this finding no longer holds, for the person; null when it holds or there is none. Without a saved severity it holds unless critical. */
export function reopenReason(finding: Accepting, accepted: readonly AcceptedFinding[]): string | null {
  const a = acceptanceOf(finding, accepted)
  if (!a) return null
  if (a.severity === null && finding.severity === 'critical') return 'Lo aceptaste con una versión anterior de Knotty, que no guardaba qué tan grave era; ahora es crítico.'
  if (a.severity !== null && RANK[finding.severity] > RANK[a.severity]) return `Lo habías aceptado como ${LABEL[a.severity]}; ahora es ${LABEL[finding.severity]}.`
  if (a.version !== ruleVersion(finding.code)) return 'Knotty cambió cómo revisa esto desde que lo aceptaste.'
  return null
}

export const isAccepted = (finding: Accepting, accepted: readonly AcceptedFinding[]) => acceptanceOf(finding, accepted) !== undefined && reopenReason(finding, accepted) === null

/** The acceptance that still holds for this finding, if any. */
export const heldAcceptance = (finding: Accepting, accepted: readonly AcceptedFinding[]) => (isAccepted(finding, accepted) ? acceptanceOf(finding, accepted) : undefined)
