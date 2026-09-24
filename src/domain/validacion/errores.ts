// Errores tipados: el código le dice al LLM qué corregir y los datos le dicen dónde.

export type CodigoError =
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

export type CodigoAviso = 'A_CONTACTO_SIN_UNION' | 'A_REFERENCIA_CONGELADA'

export interface ErrorDiseno {
  codigo: CodigoError
  mensaje: string
  datos?: Record<string, unknown>
}

export interface AvisoDiseno {
  codigo: CodigoAviso
  mensaje: string
  datos?: Record<string, unknown>
}

export const error = (codigo: CodigoError, mensaje: string, datos?: Record<string, unknown>): ErrorDiseno => ({ codigo, mensaje, ...(datos ? { datos } : {}) })

/** Resultado de algo que puede fallar con varios errores a la vez. */
export type Resultado<T> = { ok: true; valor: T } | { ok: false; errores: ErrorDiseno[] }

export const exito = <T>(valor: T): Resultado<T> => ({ ok: true, valor })
export const fallo = <T = never>(errores: ErrorDiseno[]): Resultado<T> => ({ ok: false, errores })
