import type { Diseno } from '../diseno/esquema'
import type { Geometry } from '../diseno/resolve'
import type { Catalogo } from '../materiales/catalogo'
import type { Contact } from '../validation/contact'

// What a rule finds: which pieces, how serious, why, and the ways out it has already worked out.
// Severities and rule codes are data: the expert reads them and saved notices refer to them.

export type Severity = 'critico' | 'recomendacion' | 'detalle'
export type RuleCode = 'R1_FLECHA' | 'R2_ESPESOR_UNION' | 'R3_TORNILLOS' | 'R4_VUELCO' | 'R5_ESCUADRADO' | 'R6_PUERTAS' | 'R7_BASE' | 'R8_VETA' | 'R9_CAJONES' | 'R10_USO'

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
  design: Diseno
  geo: Geometry
  catalog: Catalogo
  contacts: Contact[]
}

export type Rule = (ctx: RuleContext) => Finding[]

/** The same finding on the same pieces keeps its key across versions: accepting it or seeing it resolved refers to this. */
export const findingKey = (h: Pick<Finding, 'code' | 'pieces'>) => `${h.code}:${[...h.pieces].sort().join(',')}`
