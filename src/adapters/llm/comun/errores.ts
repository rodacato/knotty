import Anthropic from '@anthropic-ai/sdk'

const CORS = 'No se pudo conectar desde el navegador: revisa tu conexión a internet.'

/** Mensajes en español para lo que puede fallar al llamar al proveedor desde el navegador. */
export function describirError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return 'La API key no es válida.'
  if (err instanceof Anthropic.PermissionDeniedError) return 'Tu API key no tiene permiso para ese modelo.'
  if (err instanceof Anthropic.RateLimitError) return 'Límite de peticiones alcanzado; espera un momento.'
  if (err instanceof Anthropic.NotFoundError) return 'El modelo no existe o no está disponible para tu cuenta.'
  if (err instanceof Anthropic.APIConnectionTimeoutError) return 'El proveedor tardó demasiado en responder.'
  if (err instanceof Anthropic.APIConnectionError) return CORS
  if (err instanceof Anthropic.APIError) return `Error ${err.status ?? ''} del proveedor: ${err.message}`.trim()
  if (err instanceof Error) {
    if (err.name === 'AbortError') return 'Cancelado.'
    if (err instanceof TypeError) return CORS
    return err.message
  }
  return 'Error desconocido.'
}

export class ErrorProveedor extends Error {
  constructor(err: unknown) {
    super(describirError(err))
    this.name = err instanceof Error && err.name === 'AbortError' ? 'AbortError' : 'ErrorProveedor'
  }
}
