import type { Rule } from './finding'
import type { DesignKind } from '../../design/kind'
import { drawerRule } from './rules/drawers'
import { rackingRule } from './rules/racking'
import { deflectionRule } from './rules/deflection'
import { screwRule } from './rules/screws'
import { jointThicknessRule } from './rules/jointThickness'
import { baseRule, doorRule, grainRule, tippingRule } from './rules/usage'
import { typologyRule } from '../typology/typology'

// Every rule Knotty checks, once: its code, the title a notice shows the person, which furniture it applies to and the check itself.
// The order is the order of the review; codes are data (saved notices refer to them), so renaming one needs a migration.

export interface RuleDefinition<C extends string = string> {
  code: C
  /** What the notice is called, in Spanish ("Entrepaños que se pandean"). */
  title: string
  /** The kinds of furniture it checks; 'all' for any. */
  appliesTo: readonly DesignKind[] | 'all'
  /** Goes up when the rule judges differently (a threshold, the model), not for a new wording: older acceptances show as pending again. */
  version: number
  check: Rule
}

export const defineRule = <const C extends string>(rule: Omit<RuleDefinition<C>, 'appliesTo' | 'version'> & Partial<Pick<RuleDefinition<C>, 'appliesTo' | 'version'>>): RuleDefinition<C> => ({ appliesTo: 'all', version: 1, ...rule })

export const RULES = [
  defineRule({ code: 'R1_SAG', title: 'Entrepaños que se pandean', version: 2, check: deflectionRule }),
  defineRule({ code: 'R2_JOINT_THICKNESS', title: 'Espesor para la unión', check: jointThicknessRule }),
  defineRule({ code: 'R3_SCREWS', title: 'Tornillos', check: screwRule }),
  defineRule({ code: 'R4_TIPPING', title: 'Riesgo de vuelco', version: 3, check: tippingRule }),
  defineRule({ code: 'R5_RACKING', title: 'Escuadrado', version: 2, check: rackingRule }),
  defineRule({ code: 'R6_DOORS', title: 'Puertas', check: doorRule }),
  defineRule({ code: 'R7_BASE', title: 'Base', version: 2, check: baseRule }),
  defineRule({ code: 'R8_GRAIN', title: 'Veta', check: grainRule }),
  defineRule({ code: 'R9_DRAWERS', title: 'Cajones', check: drawerRule }),
  defineRule({ code: 'R10_USE', title: 'Uso del mueble', check: typologyRule }),
] as const

export type RuleCode = (typeof RULES)[number]['code']

export const ruleTitle = (code: RuleCode) => RULES.find((r) => r.code === code)?.title ?? code

/** R1 went to 2 when its reference values changed (step 21 of the proposal); R4 to 2 then and to 3 when it read the depth of the legs, and R7 to 2 when it checked the legs (step 30). */
export const ruleVersion = (code: RuleCode) => RULES.find((r) => r.code === code)?.version ?? 1

/** Whether a rule checks this kind of furniture (null: a kind Knotty does not recognize). */
export const appliesTo = (rule: RuleDefinition, kind: DesignKind | null) => rule.appliesTo === 'all' || (kind !== null && rule.appliesTo.includes(kind))
