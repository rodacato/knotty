import { describe, expect, it } from 'vitest'
import { BENCH_CASES } from './cases'
import { entropyOf, fileNameOf, jobId, newRunId, slug, trialId } from './ids'

const SAFE = /^[a-z0-9._-]+$/

describe('run ids', () => {
  it('many runs inside the same millisecond never collide when their entropy differs', () => {
    const now = new Date('2026-10-02T15:45:01.123Z')
    const ids = Array.from({ length: 500 }, (_, i) => newRunId(now, entropyOf(Uint8Array.of(i >> 8, i & 255, 7, 9))))
    expect(new Set(ids).size).toBe(500)
  })

  it('runs in the same minute but different milliseconds differ even with equal entropy', () => {
    const ids = [0, 1, 999, 1000, 59_999].map((ms) => newRunId(new Date(Date.UTC(2026, 9, 2, 15, 45, 0, 0) + ms), 'abcdef12'))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('is stable text with the clock in it', () => {
    expect(newRunId(new Date('2026-10-02T15:45:01.007Z'), 'abcdef12')).toBe('20261002-154501007-abcdef12')
  })

  it('refuses weak or unsafe entropy', () => {
    expect(() => newRunId(new Date(), 'abc')).toThrow(/entropy/)
    expect(() => newRunId(new Date(), '../../etc')).toThrow(/entropy/)
    expect(() => newRunId(new Date(), 'ABCDEF12')).toThrow(/entropy/)
  })

  it('entropyOf renders every byte as two hex digits', () => {
    expect(entropyOf(Uint8Array.of(0, 10, 255))).toBe('000aff')
  })
})

describe('job ids', () => {
  const run = '20261002-154501007-abcdef12'

  it('repeated trials of the same case get different ids', () => {
    const ids = [0, 1, 2, 3].map((t) => jobId(run, 'bookcase', t))
    expect(new Set(ids).size).toBe(4)
  })

  it('the same case in two runs gets different ids', () => {
    expect(jobId(run, 'bed', 0)).not.toBe(jobId('20261002-154501008-abcdef12', 'bed', 0))
  })

  it('a trial and a job are the same id', () => {
    expect(trialId(run, 'bed', 2)).toBe(jobId(run, 'bed', 2))
  })

  it('rejects a trial that is not a non-negative integer', () => {
    expect(() => jobId(run, 'bed', -1)).toThrow(/trial/)
    expect(() => jobId(run, 'bed', 1.5)).toThrow(/trial/)
  })

  it('every id is safe as a file name', () => {
    for (const caseId of [...BENCH_CASES.map((c) => c.id), 'a/b', '../x', 'a b', 'ñ', 'A:B', '']) {
      expect(fileNameOf(jobId(run, caseId, 0))).toMatch(SAFE)
    }
  })
})

describe('slug', () => {
  const specs = ['shellm:claude', 'shellm-claude', 'shellm_claude', 'anthropic:claude-sonnet-4-5', 'openai:gpt-5', 'Shellm:Claude', 'a.b', 'a-b', 'a:b', 'a_b', 'a b', 'A', 'a']

  it('is injective on the case ids that exist and on adversarial pairs', () => {
    const all = [...BENCH_CASES.map((c) => c.id), ...specs, '_3a_', ':', '_', '', '__', 'a_3a_b', 'a:b:']
    const slugs = all.map(slug)
    expect(new Set(slugs).size).toBe(new Set(all).size)
  })

  it('does not collapse the pairs the old slug did', () => {
    expect(slug('a:b')).not.toBe(slug('a-b'))
    expect(slug('a b')).not.toBe(slug('a-b'))
    expect(slug('é')).not.toBe(slug('e'))
  })

  it('does not collide on case-insensitive file systems', () => {
    expect(slug('Bed')).not.toBe(slug('bed'))
    expect(slug('Bed')).toBe(slug('Bed').toLowerCase())
  })

  it('is injective over a brute-force alphabet', () => {
    const alphabet = ['a', 'B', '-', '_', ':', '.', '3', 'é']
    const strings = new Set<string>()
    const grow = (prefix: string, left: number) => {
      strings.add(prefix)
      if (left) alphabet.forEach((c) => grow(prefix + c, left - 1))
    }
    grow('', 4)
    expect(new Set([...strings].map(slug)).size).toBe(strings.size)
  })

  it('never contains a path separator or a dot', () => {
    expect(slug('../../x/y.json')).toMatch(/^[a-z0-9_-]+$/)
  })
})
