// Messages in Spanish for what can fail when calling the provider from the browser.
// The error's properties are checked instead of its class, so the Anthropic SDK is not loaded just for this.

const CORS = 'No se pudo conectar desde el navegador: revisa tu conexión a internet.'

interface ApiError {
  status?: number
  name?: string
  message?: string
  cause?: unknown
}

// The SDK leaves `name` as 'Error'; its connection failure is the only status-less error carrying the network error as `cause`.
const isSdkConnectionFailure = (e: ApiError) => e.status === undefined && e.cause instanceof Error

// The SDK's timeout is a status-less error with no `cause` and its fixed default message; the message survives minification, the class name does not.
const isSdkTimeout = (e: ApiError) => e.status === undefined && e.cause === undefined && e.message === 'Request timed out.'

export function describeError(err: unknown): string {
  if (!(err instanceof Error)) return 'Error desconocido.'
  const e = err as ApiError
  if (e.name === 'AbortError') return 'Cancelado.'
  if (e.name === 'APIConnectionTimeoutError' || isSdkTimeout(e)) return 'El proveedor tardó demasiado en responder.'
  if (e.name === 'APIConnectionError' || err instanceof TypeError || isSdkConnectionFailure(e)) return CORS
  switch (e.status) {
    case 401:
      return 'La API key no es válida.'
    case 403:
      return 'Tu API key no tiene permiso para ese modelo.'
    case 404:
      return 'El modelo no existe o no está disponible para tu cuenta.'
    case 429:
      return 'Límite de peticiones alcanzado; espera un momento.'
  }
  if (e.status) return `Error ${e.status} del proveedor: ${err.message}`
  return err.message
}

export class ProviderError extends Error {
  constructor(err: unknown) {
    super(describeError(err))
    this.name = err instanceof Error && err.name === 'AbortError' ? 'AbortError' : 'ErrorProveedor'
  }
}
