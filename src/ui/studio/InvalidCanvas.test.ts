import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { analyze } from '../../domain/checks/analysis'
import type { Design } from '../../domain/design/schema'
import { exampleBookcase } from '../../domain/furniture/fixtures/bookcase'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import { previousUsableVersion, type Version } from '../../domain/session/history/history'
import { InvalidCanvas } from './InvalidCanvas'

const render = (previous: number | null) => renderToStaticMarkup(createElement(InvalidCanvas, { detail: 'La pieza X no cabe.', previous, onBack: () => {}, onNotices: () => {} }))

describe('InvalidCanvas', () => {
  it('says what happened and offers both ways out', () => {
    const html = render(2)
    expect(html).toContain('role="alert"')
    expect(html).toContain('Algo del diseño quedó roto y no se puede dibujar.')
    expect(html).toContain('Volver a la versión anterior')
    expect(html).toContain('Ver los avisos')
    expect(html).toContain('La pieza X no cabe.')
  })

  it('does not offer going back when there is no earlier version', () => {
    const html = render(null)
    expect(html).not.toContain('Volver a la versión anterior')
    expect(html).toContain('Ver los avisos')
  })
})

describe('previousUsableVersion', () => {
  const version = (n: number, design: Design): Version => ({ n, design, summary: '', reason: '', operations: [], date: '2026-10-01', origin: null, decisions: [], plan: null, extras: [], restores: null })
  const broken: Design = { ...exampleBookcase, pieces: exampleBookcase.pieces.filter((p) => p.id !== 'side-left') }
  const usable = (v: Version) => analyze(v.design, testCatalog).valid

  it('the fixtures really are valid and broken', () => {
    expect(usable(version(1, exampleBookcase))).toBe(true)
    expect(usable(version(2, broken))).toBe(false)
  })

  it('skips earlier versions that are also broken', () => {
    const versions = [version(1, exampleBookcase), version(2, broken), version(3, broken), version(4, broken)]
    expect(previousUsableVersion(versions, 4, usable)).toBe(1)
  })

  it('takes the closest valid one', () => {
    const versions = [version(1, exampleBookcase), version(2, exampleBookcase), version(3, broken)]
    expect(previousUsableVersion(versions, 3, usable)).toBe(2)
  })

  it('is null when no earlier version is valid', () => {
    expect(previousUsableVersion([version(1, broken), version(2, broken)], 2, usable)).toBeNull()
    expect(previousUsableVersion([version(1, exampleBookcase)], 1, usable)).toBeNull()
  })
})
