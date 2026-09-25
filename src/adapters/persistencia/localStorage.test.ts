import { describe, expect, it } from 'vitest'
import { exampleBookcase } from '../../domain/fixtures/bookcase'
import type { DesignState } from '../../domain/sesion/state'
import saved from '../../domain/sesion/state-v1.fixture.json'
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
  format: 3,
  measures: exampleBookcase.dimensions,
  versions: Array.from({ length: versiones }, (_, i) => ({ n: i + 1, design: exampleBookcase, summary: `v${i + 1}`, reason: '', operations: [], date: '', origin: null, decisions: [], plan: null, extras: [] })),
  current: versiones,
  requirements: [],
  decisions: [],
  chat: [],
  thumbnails: [{ angle: 'front', dataUrl: 'data:image/jpeg;base64,' + 'A'.repeat(5000) }],
  proposal: null,
  review: null,
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

  it('ignores corrupt data', () => {
    const a = almacen()
    a.setItem('despiece:v1:diseno', '{"formato":1')
    expect(createLocalRepository(a).load()).toBeNull()
  })

  it('reads a session an older Knotty saved and migrates it', () => {
    const a = almacen()
    a.setItem('despiece:v1:diseno', JSON.stringify(saved))
    const loaded = createLocalRepository(a).load()
    expect(loaded?.format).toBe(3)
    expect(loaded?.versions).toHaveLength(saved.versiones.length)
  })

  it('if it does not fit, drops thumbnails and then old versions', () => {
    const tamano = JSON.stringify({ ...estado(6), thumbnails: [] }).length
    const repo = createLocalRepository(almacen(tamano - 100))
    repo.save(estado(6))
    const cargado = repo.load()!
    expect(cargado.thumbnails).toEqual([])
    expect(cargado.versions.map((v) => v.n)).toEqual([1, 3, 4, 5, 6])
  })
})
