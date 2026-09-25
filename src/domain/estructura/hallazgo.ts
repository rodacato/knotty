import type { Diseno } from '../diseno/esquema'
import type { Geometry } from '../diseno/resolve'
import type { Catalogo } from '../materiales/catalogo'
import type { Contact } from '../validation/contact'

export type Severidad = 'critico' | 'recomendacion' | 'detalle'
export type CodigoRegla = 'R1_FLECHA' | 'R2_ESPESOR_UNION' | 'R3_TORNILLOS' | 'R4_VUELCO' | 'R5_ESCUADRADO' | 'R6_PUERTAS' | 'R7_BASE' | 'R8_VETA' | 'R9_CAJONES' | 'R10_USO'

export interface Alternativa {
  clave: string
  descripcion: string
  datos: Record<string, number | string>
}

export interface Hallazgo {
  codigo: CodigoRegla
  severidad: Severidad
  piezas: string[]
  mensaje: string
  datos: Record<string, number | string>
  alternativas: Alternativa[]
}

export interface Contexto {
  diseno: Diseno
  geo: Geometry
  catalogo: Catalogo
  contactos: Contact[]
}

export type Regla = (ctx: Contexto) => Hallazgo[]

export const claveHallazgo = (h: Pick<Hallazgo, 'codigo' | 'piezas'>) => `${h.codigo}:${[...h.piezas].sort().join(',')}`
