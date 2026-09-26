import type { Design } from '../../design/schema'
import type { Geometry } from '../../design/resolve'
import type { Catalog } from '../../materials/catalog'
import type { Contact } from '../../design/validation/contact'
import type { AlternativeKey } from './alternatives'
import type { RuleCode } from './registry'

export type { RuleCode }

// What a rule finds: which pieces, how serious, why, and the ways out it has already worked out.
// Severities and rule codes are data: the expert reads them and saved notices refer to them, so renaming one needs a migration. Rule codes come from the registry.

export type Severity = 'critical' | 'recommendation' | 'detail'

export interface Alternative {
  key: AlternativeKey
  description: string
  data: Record<string, number | string>
}

export interface Finding {
  code: RuleCode
  severity: Severity
  pieces: string[]
  /** Which check of the rule, when one rule can find more than one thing on the same pieces ('wall-cabinet.anchor', 'door.hinges'). A stable id: it is part of the key. */
  check?: string
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

/**
 * The same finding on the same pieces keeps its key across versions: accepting it or seeing it resolved refers to this.
 * The check goes in only when there is one, so the keys of findings without it stay as they were saved.
 */
export const findingKey = (h: Pick<Finding, 'code' | 'pieces' | 'check'>) => `${h.code}:${[...h.pieces].sort().join(',')}${h.check ? `#${h.check}` : ''}`
