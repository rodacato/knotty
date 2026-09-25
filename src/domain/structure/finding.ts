import type { Design } from '../design/schema'
import type { Geometry } from '../design/resolve'
import type { Catalog } from '../materials/catalog'
import type { Contact } from '../validation/contact'

// What a rule finds: which pieces, how serious, why, and the ways out it has already worked out.
// Severities and rule codes are data: the expert reads them and saved notices refer to them, so renaming one needs a migration.

export type Severity = 'critical' | 'recommendation' | 'detail'
export type RuleCode = 'R1_SAG' | 'R2_JOINT_THICKNESS' | 'R3_SCREWS' | 'R4_TIPPING' | 'R5_RACKING' | 'R6_DOORS' | 'R7_BASE' | 'R8_GRAIN' | 'R9_DRAWERS' | 'R10_USE'

export interface Alternative {
  key: string
  description: string
  data: Record<string, number | string>
}

export interface Finding {
  code: RuleCode
  severity: Severity
  pieces: string[]
  message: string
  data: Record<string, number | string>
  alternatives: Alternative[]
}

export interface RuleContext {
  design: Design
  geo: Geometry
  catalog: Catalog
  contacts: Contact[]
}

export type Rule = (ctx: RuleContext) => Finding[]

/** The same finding on the same pieces keeps its key across versions: accepting it or seeing it resolved refers to this. */
export const findingKey = (h: Pick<Finding, 'code' | 'pieces'>) => `${h.code}:${[...h.pieces].sort().join(',')}`
