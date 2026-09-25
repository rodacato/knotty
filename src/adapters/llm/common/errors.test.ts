import { describe, expect, it } from 'vitest'
import { describeError } from './errors'

const conStatus = (status: number, message = 'detalle') => Object.assign(new Error(message), { status })
const conNombre = (name: string) => Object.assign(new Error('x'), { name })

describe('describeError', () => {
  it.each([
    [conStatus(401), 'La API key no es válida.'],
    [conStatus(403), 'Tu API key no tiene permiso para ese modelo.'],
    [conStatus(404), 'El modelo no existe o no está disponible para tu cuenta.'],
    [conStatus(429), 'Límite de peticiones alcanzado; espera un momento.'],
    [conStatus(500, 'se cayó'), 'Error 500 del proveedor: se cayó'],
    [conNombre('AbortError'), 'Cancelado.'],
    [conNombre('APIConnectionTimeoutError'), 'El proveedor tardó demasiado en responder.'],
    [new TypeError('Failed to fetch'), 'No se pudo conectar desde el navegador: revisa tu conexión a internet.'],
    ['nada', 'Error desconocido.'],
  ])('%s → %s', (err, esperado) => {
    expect(describeError(err)).toBe(esperado)
  })
})
