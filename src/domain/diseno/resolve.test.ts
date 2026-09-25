import { describe, expect, it } from 'vitest'
import { alacena } from '../fixtures/alacena'
import { buro } from '../fixtures/buro'
import { catalogo } from '../fixtures/catalogo.test-util'
import { librero } from '../fixtures/librero'
import { startAt, mm, makePiece, ref, extent } from './builders'
import { Diseno, type Diseno as TDiseno } from './esquema'
import { resolveGeometry, type Geometry } from './resolve'

const resolved = (d: TDiseno): Geometry => {
  const r = resolveGeometry(d, catalogo)
  if (!r.ok) throw new Error(JSON.stringify(r.errores))
  return r.valor
}

describe('resolveGeometry', () => {
  it.each([librero, buro, alacena])('the fixtures match the schema and resolve: $nombre', (d) => {
    expect(Diseno.safeParse(d).success).toBe(true)
    expect(resolved(d).boxes.size).toBe(d.piezas.length)
  })

  it('resolves references, thicknesses and proportional cotas of the bookcase', () => {
    const { boxes } = resolved(librero)
    expect(boxes.get('lat-izq')).toEqual({ x0: 0, x1: 18, y0: 0, y1: 1800, z0: 6, z1: 300 })
    expect(boxes.get('lat-der')).toMatchObject({ x0: 582, x1: 600 })
    expect(boxes.get('piso')).toMatchObject({ x0: 18, x1: 582, y0: 70, y1: 88 })
    expect(boxes.get('techo')).toMatchObject({ y0: 1782, y1: 1800 })
    const huecos = [boxes.get('piso')!, ...[1, 2, 3, 4].map((i) => boxes.get(`entrepano-${i}`)!), boxes.get('techo')!]
      .slice(1)
      .map((c, i, arr) => c.y0 - (i === 0 ? boxes.get('piso')!.y1 : arr[i - 1].y1))
    for (const h of huecos) expect(h).toBeCloseTo(huecos[0], 5)
  })

  it('carries a change of width to everything that refers to it', () => {
    const { boxes } = resolved({ ...librero, dimensiones: { ...librero.dimensiones, ancho: 900 } })
    expect(boxes.get('lat-der')).toMatchObject({ x0: 882, x1: 900 })
    expect(boxes.get('entrepano-2')).toMatchObject({ x0: 18, x1: 882 })
  })

  it('takes the catalog thickness along the normal axis', () => {
    const d = structuredClone(librero)
    d.piezas.find((p) => p.id === 'lat-izq')!.material = 'T15'
    expect(resolved(d).boxes.get('piso')).toMatchObject({ x0: 15 })
  })

  it('reports references to missing pieces and crossed axes', () => {
    const d = structuredClone(librero)
    d.piezas.push(makePiece({ id: 'extra', nombre: 'Extra', rol: 'otro', material: 'T18', normal: 'y', x: extent(ref('fantasma.x1'), ref('mueble.x1')), y: startAt(mm(500)), z: extent(ref('mueble.y0'), ref('mueble.z1')) }))
    const r = resolveGeometry(d, catalogo)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errores.map((e) => e.codigo).sort()).toEqual(['E_REF_EJE', 'E_REF_INEXISTENTE'])
  })

  it('finds reference cycles', () => {
    const d = structuredClone(librero)
    const lat = d.piezas.find((p) => p.id === 'lat-izq')!
    lat.x = startAt(ref('piso.x0', -18))
    const r = resolveGeometry(d, catalogo)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errores[0].codigo).toBe('E_CICLO')
  })

  it('rejects extents with zero or negative length and materials outside the catalog', () => {
    const d = structuredClone(librero)
    d.dimensiones.ancho = 30
    d.piezas.find((p) => p.id === 'techo')!.material = 'T25'
    const r = resolveGeometry(d, catalogo)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(new Set(r.errores.map((e) => e.codigo))).toEqual(new Set(['E_TRAMO_INVALIDO', 'E_ESPESOR_CATALOGO']))
  })

  it('accepts start + length and end + length across the face', () => {
    const { boxes } = resolved(librero)
    expect(boxes.get('zoclo')).toMatchObject({ y0: 0, y1: 70, z0: 252, z1: 270 })
  })
})
