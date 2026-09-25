import type { Diseno } from '../diseno/esquema'
import type { Geometry } from '../diseno/resolve'
import type { Catalogo } from '../materiales/catalogo'
import type { Contact } from '../validation/contact'

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

export const findingKey = (h: Pick<Finding, 'code' | 'pieces'>) => `${h.code}:${[...h.pieces].sort().join(',')}`
