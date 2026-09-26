import { describe, expect, it } from 'vitest'
import { acceptFinding, isAccepted, reopenReason, type AcceptedFinding } from './accepted'
import type { Finding } from './finding'

const finding = (severity: Finding['severity'], code: Finding['code'] = 'R5_RACKING'): Finding => ({ code, severity, pieces: ['side-l'], message: 'x', data: {}, alternatives: [] })
const at = '2026-09-25T10:00:00Z'

describe('accepted findings', () => {
  it('hold while the finding is not worse than when accepted', () => {
    const accepted = [acceptFinding(finding('recommendation'), 'Escuadrado', at)]
    expect([finding('detail'), finding('recommendation')].map((h) => isAccepted(h, accepted))).toEqual([true, true])
    expect(isAccepted(finding('critical'), accepted)).toBe(false)
    expect(reopenReason(finding('critical'), accepted)).toBe('Lo habías aceptado como recomendación; ahora es crítico.')
    expect(reopenReason(finding('recommendation'), [acceptFinding(finding('detail'), 'Escuadrado', at)])).toBe('Lo habías aceptado como detalle; ahora es recomendación.')
  })

  it('a finding nobody accepted is neither accepted nor reopened', () => {
    expect([isAccepted(finding('detail'), []), reopenReason(finding('detail'), [])]).toEqual([false, null])
  })

  it('an acceptance saved without its severity holds unless the finding is critical', () => {
    const legacy: AcceptedFinding[] = [{ ...acceptFinding(finding('detail'), 'Escuadrado', at), severity: null }]
    expect([isAccepted(finding('detail'), legacy), isAccepted(finding('recommendation'), legacy), isAccepted(finding('critical'), legacy)]).toEqual([true, true, false])
    expect(reopenReason(finding('critical'), legacy)).toMatch(/versión anterior de Knotty.*ahora es crítico/)
  })

  it('an acceptance under an older version of its rule does not hold', () => {
    const sag = finding('recommendation', 'R1_SAG')
    const current = acceptFinding(sag, 'Entrepaños que se pandean', at)
    expect(current.version).toBe(2)
    expect(isAccepted(sag, [current])).toBe(true)
    expect(isAccepted(sag, [{ ...current, version: 1 }])).toBe(false)
    expect(reopenReason(sag, [{ ...current, version: 1 }])).toBe('Knotty cambió cómo revisa esto desde que lo aceptaste.')
  })
})
