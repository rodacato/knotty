import { describe, expect, it } from 'vitest'
import { bytesDeBase64, dimensionesReducidas, LADO_LARGO } from './canvas'

describe('reducción de fotos', () => {
  it('una foto grande queda con el lado largo en 1568 y conserva la proporción', () => {
    expect(dimensionesReducidas(4032, 3024, LADO_LARGO)).toEqual({ ancho: 1568, alto: 1176 })
    expect(dimensionesReducidas(3000, 4000, LADO_LARGO)).toEqual({ ancho: 1176, alto: 1568 })
  })

  it('una foto chica no se agranda', () => {
    expect(dimensionesReducidas(800, 600, LADO_LARGO)).toEqual({ ancho: 800, alto: 600 })
  })

  it('cuenta los bytes reales del base64', () => {
    expect(bytesDeBase64(btoa('abc'))).toBe(3)
    expect(bytesDeBase64(btoa('abcd'))).toBe(4)
    expect(bytesDeBase64(btoa('abcde'))).toBe(5)
  })
})
