import { describe, expect, it } from 'vitest'
import { catalogDestination, routeFrom } from './routes'

describe('public entry compatibility', () => {
  it('leaves the landing and its section links at the root', () => {
    for (const suffix of ['', '#catalogo', '#como-funciona', '#preguntas', '?utm_source=share']) expect(catalogDestination(new URL(`https://example.test/knotty/${suffix}`))).toBeNull()
  })

  it('carries old ficha options, filters and hash links to the catalog without losing them', () => {
    for (const suffix of ['?ficha=KC-APA-01&acabado=paint', '?q=librero&cuarto=oficina', '#ficha=KC-MES-03&armado=bolts', '#estudio/materiales', '#catalogo/ajustar/KC-APA-01']) {
      expect(catalogDestination(new URL(`https://example.test/knotty/${suffix}`))).toBe(`https://example.test/knotty/catalogo/${suffix}${suffix.includes('#') ? '' : '#catalogo'}`)
    }
    expect(catalogDestination(new URL('https://example.test/?q=mesa'))).toBe('https://example.test/catalogo/?q=mesa#catalogo')
  })

  it('keeps old installed icons pointing at the saved studio under both hosting bases', () => {
    expect(catalogDestination(new URL('https://example.test/knotty/index.html'), true)).toBe('https://example.test/knotty/catalogo/#estudio')
    expect(catalogDestination(new URL('https://example.test/'), true)).toBe('https://example.test/catalogo/#estudio')
  })
})

describe('view fragments', () => {
  it('reads catalog, adjustment, studio panels and editing views', () => {
    expect(routeFrom('#catalogo/ajustar/KC-ESC-07')).toEqual({ screen: 'catalog', code: 'KC-ESC-07' })
    expect(routeFrom('#estudio/materiales')).toEqual({ screen: 'studio', panel: 'materials' })
    expect(routeFrom('#estudio/editar/exterior/pedestal/pieza/side-right')).toEqual({ screen: 'studio', side: 'outside', part: 'pedestal', piece: 'side-right' })
    expect(routeFrom('#estudio/pieza/pieza%20con%20espacios')).toEqual({ screen: 'studio', piece: 'pieza con espacios' })
    expect(routeFrom('#para-llevar')).toEqual({ screen: 'takeaway' })
  })

  it('does not interpret malformed or unknown fragments as commands or a design', () => {
    for (const hash of ['', '#ficha=KC-MES-03', '#estudio/editar/otro', '#catalogo/ajustar', '#estudio/constructor', '#estudio/%ZZ', '#estudio/materiales/extra']) expect(routeFrom(hash)).toBeNull()
  })
})
