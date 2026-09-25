import { describe, expect, it } from 'vitest'
import { exampleBookcase } from '../../domain/fixtures/bookcase'
import type { DesignState } from '../../domain/sesion/state'
import { createLocalRepository } from './localStorage'

function almacen(limite = Infinity): Storage {
  const datos = new Map<string, string>()
  return {
    getItem: (k) => datos.get(k) ?? null,
    setItem: (k, v) => {
      if (v.length > limite) throw new DOMException('lleno', 'QuotaExceededError')
      datos.set(k, v)
    },
    removeItem: (k) => void datos.delete(k),
    clear: () => datos.clear(),
    key: () => null,
    get length() {
      return datos.size
    },
  }
}

const estado = (versiones = 1): DesignState => ({
  formato: 1,
  medidas: exampleBookcase.dimensiones,
  versiones: Array.from({ length: versiones }, (_, i) => ({ n: i + 1, diseno: exampleBookcase, resumen: `v${i + 1}`, motivo: '', operaciones: [], fecha: '', origen: null, decisiones: [], plan: null, extras: [] })),
  actual: versiones,
  requisitos: [],
  decisiones: [],
  chat: [],
  miniaturas: [{ angulo: 'frente', dataUrl: 'data:image/jpeg;base64,' + 'A'.repeat(5000) }],
  propuesta: null,
  dictamen: null,
  trace: [],
  accepted: [],
  tray: [],
})

describe('localStorage repository', () => {
  it('saves and loads, validating the schema', () => {
    const repo = createLocalRepository(almacen())
    repo.save(estado())
    expect(repo.load()).toEqual(estado())
    repo.clear()
    expect(repo.load()).toBeNull()
  })

  it('ignora datos corruptos', () => {
    const a = almacen()
    a.setItem('despiece:v1:diseno', '{"formato":1')
    expect(createLocalRepository(a).load()).toBeNull()
  })

  it('if it does not fit, drops thumbnails and then old versions', () => {
    const tamano = JSON.stringify({ ...estado(6), miniaturas: [] }).length
    const repo = createLocalRepository(almacen(tamano - 100))
    repo.save(estado(6))
    const cargado = repo.load()!
    expect(cargado.miniaturas).toEqual([])
    expect(cargado.versiones.map((v) => v.n)).toEqual([1, 3, 4, 5, 6])
  })
})
