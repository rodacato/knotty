import { describe, expect, it } from 'vitest'
import { librero } from '../fixtures/librero'
import { actualizarDecisiones, bitacoraCompacta, podarVersiones, type Version } from './historial'

const version = (n: number): Version => ({ n, diseno: librero, resumen: `cambio ${n}`, motivo: `pedido ${n}`, operaciones: ['x→900 estirar'], fecha: '2026-09-24', origen: null })

describe('historial', () => {
  it('compacta la bitácora: 8 completas, hasta 30 resumidas y el resto contado', () => {
    const lineas = bitacoraCompacta(Array.from({ length: 35 }, (_, i) => version(i + 1)))
    expect(lineas[0]).toBe('(5 cambios anteriores)')
    expect(lineas[1]).toBe('v6: cambio 6')
    expect(lineas.at(-1)).toBe('v35: cambio 35 — pedido: "pedido 35" — x→900 estirar')
    expect(lineas.filter((l) => l.includes('pedido:'))).toHaveLength(8)
    expect(lineas).toHaveLength(31)
  })

  it('una decisión nueva reemplaza la del mismo tema', () => {
    const d = actualizarDecisiones([{ tema: 'trasera', texto: 'TR3' }, { tema: 'espesor', texto: '15 mm' }], [{ tema: 'trasera', texto: 'TR6 para escuadrar' }])
    expect(d).toEqual([{ tema: 'espesor', texto: '15 mm' }, { tema: 'trasera', texto: 'TR6 para escuadrar' }])
  })

  it('poda versiones conservando la primera', () => {
    const podadas = podarVersiones(Array.from({ length: 50 }, (_, i) => version(i + 1)))
    expect(podadas).toHaveLength(40)
    expect(podadas[0].n).toBe(1)
    expect(podadas[1].n).toBe(12)
  })
})
