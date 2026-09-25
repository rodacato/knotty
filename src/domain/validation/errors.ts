// Typed errors: the code tells the expert what to fix and the data tells it where.
// The codes stay as they are: they are data, in the saved trace and in what the expert reads.

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
  code: ErrorCode
  message: string
  data?: Record<string, unknown>
}

export interface DesignWarning {
  code: WarningCode
  message: string
  data?: Record<string, unknown>
}

export const error = (code: ErrorCode, message: string, data?: Record<string, unknown>): DesignError => ({ code, message, ...(data ? { data } : {}) })

/** What comes of something that can fail with several errors at once. */
export type Result<T> = { ok: true; value: T } | { ok: false; errors: DesignError[] }

export const success = <T>(value: T): Result<T> => ({ ok: true, value })
export const failure = <T = never>(errors: DesignError[]): Result<T> => ({ ok: false, errors })
