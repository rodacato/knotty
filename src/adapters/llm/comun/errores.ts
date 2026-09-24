// Mensajes en español para lo que puede fallar al llamar al proveedor desde el navegador.
// Se revisan las propiedades del error en vez de sus clases para no cargar el SDK de Anthropic solo para esto.

const CORS = 'No se pudo conectar desde el navegador: revisa tu conexión a internet.'

interface ErrorDeApi {
  status?: number
  name?: string
  message?: string
}

export function describirError(err: unknown): string {
  if (!(err instanceof Error)) return 'Error desconocido.'
  const e = err as ErrorDeApi
  if (e.name === 'AbortError') return 'Cancelado.'
  if (e.name === 'APIConnectionTimeoutError') return 'El proveedor tardó demasiado en responder.'
  if (e.name === 'APIConnectionError' || err instanceof TypeError) return CORS
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

export class ErrorProveedor extends Error {
  constructor(err: unknown) {
    super(describirError(err))
    this.name = err instanceof Error && err.name === 'AbortError' ? 'AbortError' : 'ErrorProveedor'
  }
}
