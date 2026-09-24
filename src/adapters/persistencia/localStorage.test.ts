import { describe, expect, it } from 'vitest'
import { librero } from '../../domain/fixtures/librero'
import type { EstadoDiseno } from '../../domain/sesion/estado'
import { crearRepositorioLocal } from './localStorage'

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

const estado = (versiones = 1): EstadoDiseno => ({
  formato: 1,
  medidas: librero.dimensiones,
  versiones: Array.from({ length: versiones }, (_, i) => ({ n: i + 1, diseno: librero, resumen: `v${i + 1}`, motivo: '', operaciones: [], fecha: '', origen: null })),
  actual: versiones,
  requisitos: [],
  decisiones: [],
  chat: [],
  miniaturas: [{ angulo: 'frente', dataUrl: 'data:image/jpeg;base64,' + 'A'.repeat(5000) }],
  propuesta: null,
})

describe('repositorio localStorage', () => {
  it('guarda y recupera validando el esquema', () => {
    const repo = crearRepositorioLocal(almacen())
    repo.guardar(estado())
    expect(repo.cargar()).toEqual(estado())
    repo.borrar()
    expect(repo.cargar()).toBeNull()
  })

  it('ignora datos corruptos', () => {
    const a = almacen()
    a.setItem('despiece:v1:diseno', '{"formato":1')
    expect(crearRepositorioLocal(a).cargar()).toBeNull()
  })

  it('si no cabe, suelta miniaturas y luego versiones viejas', () => {
    const tamano = JSON.stringify({ ...estado(6), miniaturas: [] }).length
    const repo = crearRepositorioLocal(almacen(tamano - 100))
    repo.guardar(estado(6))
    const cargado = repo.cargar()!
    expect(cargado.miniaturas).toEqual([])
    expect(cargado.versiones.map((v) => v.n)).toEqual([1, 3, 4, 5, 6])
  })
})
