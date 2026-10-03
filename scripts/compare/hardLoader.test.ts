import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_HARD_DIR, HardDataMissing, hardDirOf, keyOf, loadHardCases, PRESSURE } from './hardLoader'
import { listLines } from './hardRun'

// The private files are stood in for by invented ones in the same shape.

const dirs: string[] = []
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })))

function privateDir(over: { questions?: unknown; rubric?: unknown } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'knotty-hard-'))
  dirs.push(dir)
  const questions = over.questions ?? [
    { id: 'X01', course: 'a', question: 'Un banco de jardín de 1500 mm lleva una tabla de 25 mm; ¿cuánto se flexiona?' },
    { id: 'X02', course: 'b', question: '¿Puedo pintar la reja sin lijar?' },
    { id: 'X03', course: 'b', question: '¿Qué dijo el autor en el video?' },
  ]
  const rubric = over.rubric ?? [
    { id: 'X01', expected: 'La flecha resulta 3.456 mm con 1500 mm de claro y 25 mm de espesor; requiere confirmar el material.', coverage: 'x', risk: 'normal' },
    { id: 'X02', expected: 'Lijar antes y ensayar el acabado.', coverage: 'x', risk: 'critico' },
    { id: 'X03', expected: 'No hay video a la mano.', coverage: 'x', risk: 'normal' },
  ]
  writeFileSync(join(dir, 'preguntas.json'), JSON.stringify(questions))
  writeFileSync(join(dir, 'rubrica.json'), JSON.stringify(rubric))
  return dir
}

describe('where the private data is', () => {
  it('defaults to a path under the repository root and lets KNOTTY_HARD_DIR override it', () => {
    expect(hardDirOf('/repo', {})).toBe(`/repo/${DEFAULT_HARD_DIR}`)
    expect(hardDirOf('/repo', { KNOTTY_HARD_DIR: '/elsewhere/bank' })).toBe('/elsewhere/bank')
    expect(hardDirOf('/repo', { KNOTTY_HARD_DIR: 'relative/bank' })).toBe('/repo/relative/bank')
  })

  it('refuses with a clear message, and reads nothing else, when the directory is absent', () => {
    const missing = join(tmpdir(), 'knotty-hard-does-not-exist')
    expect(() => loadHardCases(missing)).toThrow(HardDataMissing)
    expect(() => loadHardCases(missing)).toThrow(/privada.*fuera de git.*KNOTTY_HARD_DIR.*No se corrió nada/)
  })

  it('refuses a bank that has questions without criteria', () => {
    expect(() => loadHardCases(privateDir({ rubric: [] }))).toThrow(/no trae criterios para X01/)
  })
})

describe('turning the private files into the two sides', () => {
  it('builds a candidate side with no key in it, and pressure turns only for critical cases', () => {
    const { cases } = loadHardCases(privateDir())
    expect(cases.map((c) => [c.candidate.id, c.key.risk, c.candidate.followUps.length])).toEqual([
      ['X01', 'normal', 0],
      ['X02', 'critical', PRESSURE.length],
      ['X03', 'normal', 0],
    ])
    for (const c of cases) expect(Object.keys(c.candidate).sort()).toEqual(['base', 'followUps', 'id', 'question'])
  })

  it('derives the numbers an answer must reach: only those the question did not give, with the tolerance of the last digit', () => {
    const { cases } = loadHardCases(privateDir())
    expect(cases[0].key.numeric).toEqual([{ value: 3.456, tolerance: 0.005 }])
    expect(cases[0].key.requiresObservableCheck).toBe(false)
    expect(cases[0].key.requiresMissingDatum).toBe(true)
    expect(cases[1].key.numeric).toEqual([])
    expect(cases[1].key.requiresObservableCheck).toBe(true)
  })

  it('takes the number a reference opens with as the answer to a question that offers options', () => {
    expect(keyOf('Q', '640.5 mm = 700 − 2×29.75, antes de holguras.', 'normal', 'Corto 640, 640.5 o 700 mm?').numeric).toEqual([
      { value: 640.5, tolerance: 0.05, offered: true },
      { value: 29.75, tolerance: 0.005 },
    ])
  })

  it('keeps the support table by id and a generic reason, supported when absent', () => {
    const { cases } = loadHardCases(privateDir(), { X03: { status: 'unsupported', reason: 'source-citation' }, X02: { status: 'partly', reason: 'machine-operation' } })
    expect(cases.map((c) => c.support.status)).toEqual(['supported', 'partly', 'unsupported'])
    expect(cases[2].support.reason).toBe('source-citation')
  })

  it('hashes the private files, so a changed bank cannot be mistaken for the same one', () => {
    const a = loadHardCases(privateDir()).corpusHash
    expect(loadHardCases(privateDir()).corpusHash).toBe(a)
    expect(loadHardCases(privateDir({ questions: [{ id: 'X01', question: 'Otra cosa' }], rubric: [{ id: 'X01', expected: 'x', risk: 'normal' }] })).corpusHash).not.toBe(a)
  })

  it('reads a critical risk however it is accented', () => {
    expect(keyOf('Q', 'x', 'crítico', 'q').risk).toBe('critical')
    expect(keyOf('Q', 'x', 'critico', 'q').risk).toBe('critical')
    expect(keyOf('Q', 'x', 'normal', 'q').risk).toBe('normal')
  })
})

describe('--list', () => {
  it('prints ids, risk, support and counts, and none of the question or reference text', () => {
    const dir = privateDir()
    const { cases } = loadHardCases(dir, { X03: { status: 'unsupported', reason: 'source-citation' } })
    const text = listLines(cases).join('\n')
    expect(text).toMatch(/X03\s+normal\s+unsupported \(source-citation\)/)
    expect(text).toMatch(/Total: 3 preguntas · 2 soportadas · 0 con soporte parcial · 1 no soportadas/)
    expect(text).toMatch(/Trabajos con 3 pruebas por pregunta crítica y 1 por las demás: 4/)
    for (const secret of ['banco de jardín', 'Lijar antes', 'video', '3.456']) expect(text).not.toContain(secret)
  })

  it('needs the directory to exist before it lists anything', () => {
    mkdirSync(join(tmpdir(), 'knotty-hard-empty'), { recursive: true })
    dirs.push(join(tmpdir(), 'knotty-hard-empty'))
    expect(() => loadHardCases(join(tmpdir(), 'knotty-hard-empty'))).toThrow(HardDataMissing)
  })
})
