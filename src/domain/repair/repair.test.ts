import { describe, expect, it } from 'vitest'
import { analizar } from '../analisis'
import { mm, ref, union } from '../diseno/construir'
import type { Diseno, Pieza } from '../diseno/esquema'
import { catalogo } from '../fixtures/catalogo.test-util'
import { alacena } from '../fixtures/alacena'
import { librero } from '../fixtures/librero'
import { repairDesign } from './repair'

const shelf = (d: Diseno) => d.piezas.find((p) => p.id === 'entrepano-1')!
const withPiece = (d: Diseno, id: string, change: (p: Pieza) => Pieza): Diseno => ({ ...d, piezas: d.piezas.map((p) => (p.id === id ? change(p) : p)) })
const valid = (d: Diseno) => analizar(d, catalogo).valido
const box = (d: Diseno, id: string) => {
  const a = analizar(d, catalogo)
  if (!a.valido) throw new Error(a.errores[0].mensaje)
  return a.geo.cajas.get(id)!
}

describe('repairDesign', () => {
  it('removes a piece that is a copy inside another one', () => {
    const broken = { ...librero, piezas: [...librero.piezas, { ...shelf(librero), id: 'entrepano-extra', nombre: 'Entrepaño extra' }] }
    expect(valid(broken)).toBe(false)
    const { design, repairs } = repairDesign(broken, catalogo)
    expect(valid(design)).toBe(true)
    expect(design.piezas.some((p) => p.id === 'entrepano-extra')).toBe(false)
    expect(repairs.map((r) => r.message)).toEqual(['Quité Entrepaño extra: estaba completa dentro de Entrepaño 1.'])
  })

  it('trims a shelf that runs into the side, up to the side', () => {
    const broken = withPiece(librero, 'entrepano-1', (p) => ({ ...p, x: { ...p.x, hasta: ref('mueble.x1') } }))
    const { design, repairs } = repairDesign(broken, catalogo)
    expect(valid(design)).toBe(true)
    expect(box(design, 'entrepano-1').x1).toBe(box(librero, 'lat-der').x0)
    expect(repairs[0].message).toBe('Recorté Entrepaño 1 hasta Lateral derecho: se encimaban 18 mm.')
  })

  it('moves a shelf that sinks into the bottom so it sits on it, keeping its thickness', () => {
    const broken = withPiece(librero, 'entrepano-1', (p) => ({ ...p, y: { desde: ref('piso.y1', -10), hasta: null, largo: null } }))
    const { design, repairs } = repairDesign(broken, catalogo)
    expect(valid(design)).toBe(true)
    const fixed = box(design, 'entrepano-1')
    expect(fixed.y0).toBe(box(librero, 'piso').y1)
    expect(fixed.y1 - fixed.y0).toBe(18)
    expect(repairs[0].message).toMatch(/^Moví Entrepaño 1 junto a Piso/)
  })

  it('an overlay door sunk into the carcass with no room in front: the carcass steps back, the door keeps its size', () => {
    const door = box(alacena, 'puerta-izq')
    const into = mm(door.z0 + 16)
    const broken = ['lat-izq', 'lat-der', 'piso', 'techo'].reduce((d, id) => withPiece(d, id, (p) => ({ ...p, z: { ...p.z, hasta: into } })), alacena)
    expect(valid(broken)).toBe(false)
    const { design, repairs } = repairDesign(broken, catalogo)
    expect(valid(design)).toBe(true)
    expect(box(design, 'puerta-izq')).toEqual(door)
    expect(box(design, 'lat-izq').z1).toBe(door.z0)
    expect(repairs.every((r) => r.message.startsWith('Recorté') && !r.message.startsWith('Recorté Puerta'))).toBe(true)
  })

  it('drops a joint between pieces that do not touch', () => {
    const broken = { ...librero, uniones: [...librero.uniones, union('u-suelta', 'entrepano-1', 'techo', 'tope-tornillo')] }
    const { design, repairs } = repairDesign(broken, catalogo)
    expect(valid(design)).toBe(true)
    expect(design.uniones.some((u) => u.id === 'u-suelta')).toBe(false)
    expect(repairs[0].code).toBe('E_UNION_SIN_CONTACTO')
  })

  it('also repairs pieces the model grouped into parts', () => {
    const broken = withPiece(librero, 'entrepano-1', (p) => ({ ...p, grupo: 'casco', x: { ...p.x, hasta: ref('mueble.x1') } }))
    expect(valid(repairDesign(broken, catalogo).design)).toBe(true)
  })

  it('leaves a valid design alone', () => {
    expect(repairDesign(librero, catalogo)).toEqual({ design: librero, repairs: [] })
  })
})
