import { describe, expect, it } from 'vitest'
import { describeError } from './errors'

const withStatus = (status: number, message = 'detalle') => Object.assign(new Error(message), { status })
const withName = (name: string) => Object.assign(new Error('x'), { name })

describe('describeError', () => {
  it.each([
    [withStatus(401), 'La API key no es válida.'],
    [withStatus(403), 'Tu API key no tiene permiso para ese modelo.'],
    [withStatus(404), 'El modelo no existe o no está disponible para tu cuenta.'],
    [withStatus(429), 'Límite de peticiones alcanzado; espera un momento.'],
    [withStatus(500, 'se cayó'), 'Error 500 del proveedor: se cayó'],
    [withName('AbortError'), 'Cancelado.'],
    [withName('APIConnectionTimeoutError'), 'El proveedor tardó demasiado en responder.'],
    [new TypeError('Failed to fetch'), 'No se pudo conectar desde el navegador: revisa tu conexión a internet.'],
    ['nada', 'Error desconocido.'],
  ])('%s → %s', (err, expected) => {
    expect(describeError(err)).toBe(expected)
  })
})
