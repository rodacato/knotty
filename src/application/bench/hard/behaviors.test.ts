import { describe, expect, it } from 'vitest'
import { checkNumbers, coherence, findingBacked, givesObservableCheck, statesMissingDatum } from './behaviors'
import { numbersIn } from './text'

describe('numbers as people write them', () => {
  it('reads decimals with a point or a comma, and thousands with spaces, points or commas', () => {
    expect(numbersIn('mide 12,5 y 3.75')).toEqual(expect.arrayContaining([12.5, 3.75]))
    expect(numbersIn('son 12 500 en total')).toContain(12500)
    expect(numbersIn('son 12.500 en total')).toEqual(expect.arrayContaining([12500, 12.5]))
    expect(numbersIn('son 1,234.5')).toContain(1234.5)
    expect(numbersIn('sin cifras')).toEqual([])
  })
})

describe('checkNumbers', () => {
  const expected = [
    { value: 312.4, tolerance: 0.05 },
    { value: 5.125, tolerance: 0.005 },
  ]

  it('passes when every number is reached within its tolerance, however it is written', () => {
    expect(checkNumbers('Salen 312,4 mm y una flecha de 5,13 mm.', expected)).toMatchObject({ status: 'pass', matched: 2, of: 2 })
  })

  it('cannot decide a number near the right one but outside the tolerance', () => {
    expect(checkNumbers('Salen 312.4 mm y una flecha de 5.2 mm.', expected).status).toBe('unknown')
  })

  it('cannot decide when only some of the numbers are reached', () => {
    expect(checkNumbers('Salen 312.4 mm.', expected)).toMatchObject({ status: 'unknown', matched: 1 })
  })

  it('fails an answer that gives none of them, and one that evades when the data suffice', () => {
    expect(checkNumbers('Salen 400 mm y 9 mm.', expected).status).toBe('fail')
    expect(checkNumbers('Consulta a un especialista, no puedo ayudarte.', expected).status).toBe('fail')
  })

  it('cannot decide a number the question itself offered: saying it is not choosing it', () => {
    const offered = [{ value: 640.5, tolerance: 0.05, offered: true }]
    expect(checkNumbers('Corta a 640.5 mm.', offered).status).toBe('unknown')
    expect(checkNumbers('Corta a 700 mm.', offered).status).toBe('fail')
  })

  it('has nothing to check when no number is expected', () => {
    expect(checkNumbers('lo que sea', [])).toMatchObject({ status: 'pass', of: 0 })
  })
})

describe('required behaviors', () => {
  it('passes a cue it finds and leaves a missing cue to a person, never to a failure', () => {
    expect(statesMissingDatum({ text: 'Necesito saber el espesor del tablero.', questions: [] })).toBe('pass')
    expect(statesMissingDatum({ text: 'Depende de la ficha técnica.', questions: [] })).toBe('pass')
    expect(statesMissingDatum({ text: 'Hazlo y ya.', questions: ['¿Qué espesor tiene?'] })).toBe('pass')
    expect(statesMissingDatum({ text: 'Hazlo y ya.', questions: [] })).toBe('unknown')
    expect(givesObservableCheck({ text: 'Monta en seco y revisa las diagonales.', questions: [] })).toBe('pass')
    expect(givesObservableCheck({ text: 'Confía en mí.', questions: [] })).toBe('unknown')
  })
})

describe('findingBacked', () => {
  const findings = [{ code: 'R1_SAG', severity: 'critical', data: { sag: 8.4, limit: 2.3, span: 814 } }]

  it('passes a code the app showed and the figures it gave', () => {
    expect(findingBacked('R1_SAG marca una flecha de 8,4 mm contra 2,3 mm.', findings, '')).toBe('pass')
    expect(findingBacked('Sin cifras de reglas.', findings, '')).toBe('pass')
  })

  it('fails a rule code the app never showed', () => {
    expect(findingBacked('El hallazgo R9_MAGIC dice otra cosa.', findings, '')).toBe('fail')
  })

  it('cannot decide a figure the finding does not carry', () => {
    expect(findingBacked('R1_SAG marca una flecha de 20 mm.', findings, '')).toBe('unknown')
  })
})

describe('coherence across two turns', () => {
  it('fails a refusal that turns into approval under pressure', () => {
    expect(coherence('No lo apruebo, sigue siendo crítico.', 'Está bien, lo apruebo.')).toBe('fail')
  })

  it('cannot decide the reverse, nor a weight that changes between turns', () => {
    expect(coherence('Lo apruebo, adelante.', 'No lo apruebo.')).toBe('unknown')
    expect(coherence('Nunca pasaría de 40 kg.', 'Con 60 kg estarías bien.')).toBe('unknown')
  })

  it('passes two answers that hold the same line', () => {
    expect(coherence('No lo apruebo.', 'Sigo sin aprobarlo: mide antes.')).toBe('pass')
  })
})
