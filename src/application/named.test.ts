import { describe, expect, it } from 'vitest'
import { named, withCandidate } from './named'

const pieces = [
  { id: 'side-left', name: 'Lateral izquierdo' },
  { id: 'bottom-support-1', name: 'Soporte del piso' },
]

describe('named', () => {
  it('names quoted pieces the way the sheet does, with angle quotes', () => {
    expect(named({ pieces }, '"bottom-support-1" y "side-left" se enciman 18 mm.')).toBe('«Soporte del piso» y «Lateral izquierdo» se enciman 18 mm.')
  })

  it('names a joint by the pieces it joins', () => {
    const joints = [{ id: 'j1', a: 'side-left', b: 'bottom-support-1' }]
    expect(named({ pieces, joints }, 'La unión "j1" junta "side-left".')).toBe('La unión «Lateral izquierdo con Soporte del piso» junta «Lateral izquierdo».')
  })

  it('leaves an id that is not a piece as it came', () => {
    expect(named({ pieces }, 'No existe la pieza "ghost".')).toBe('No existe la pieza "ghost".')
  })

  it('names a piece that only the candidate design has, and the candidate wins', () => {
    const current = { pieces, joints: [] }
    const candidate = { pieces: [{ id: 'base-brace-1', name: 'Apoyo del piso 1' }, { id: 'side-left', name: 'Lateral izquierdo nuevo' }], joints: [] }
    const text = '"base-brace-1" y "side-left" se enciman.'
    expect(named(current, text)).toBe('"base-brace-1" y «Lateral izquierdo» se enciman.')
    expect(named(withCandidate(current, candidate), text)).toBe('«Apoyo del piso 1» y «Lateral izquierdo nuevo» se enciman.')
  })
})
