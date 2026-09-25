// Typed errors: the code tells the expert what to fix and the data tells it where.
// Their fields and codes stay in Spanish until the structural findings, which share their shape, move to English.

export type ErrorCode =
  | 'E_ESQUEMA'
  | 'E_ID_DUPLICADO'
  | 'E_PIEZA_INEXISTENTE'
  | 'E_UNION_INEXISTENTE'
  | 'E_REF_INEXISTENTE'
  | 'E_REF_EJE'
  | 'E_CICLO'
  | 'E_TRAMO_INVALIDO'
  | 'E_TRASLAPE'
  | 'E_FLOTANTE'
  | 'E_MEDIDA_GLOBAL'
  | 'E_ESPESOR_CATALOGO'
  | 'E_NO_CABE_EN_HOJA'
  | 'E_UNION_SIN_CONTACTO'
  | 'E_REQUISITO'
  | 'E_OPERACION_INVALIDA'

export type WarningCode = 'A_CONTACTO_SIN_UNION' | 'A_REFERENCIA_CONGELADA'

export interface DesignError {
  codigo: ErrorCode
  mensaje: string
  datos?: Record<string, unknown>
}

export interface DesignWarning {
  codigo: WarningCode
  mensaje: string
  datos?: Record<string, unknown>
}

export const error = (codigo: ErrorCode, mensaje: string, datos?: Record<string, unknown>): DesignError => ({ codigo, mensaje, ...(datos ? { datos } : {}) })

/** What comes of something that can fail with several errors at once. */
export type Result<T> = { ok: true; valor: T } | { ok: false; errores: DesignError[] }

export const success = <T>(valor: T): Result<T> => ({ ok: true, valor })
export const failure = <T = never>(errores: DesignError[]): Result<T> => ({ ok: false, errores })
