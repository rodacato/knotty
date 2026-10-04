import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DESIGN_KINDS, type DesignKind } from '../../design/kind'
import { ROOT, sourceProblem } from '../../sources.test-util'
import { adviceFor, CLAIM_ORIGIN, CLAIM_STATUS, CLAIMS, ClaimSchema, OPERATIONS, type Claim } from './claims'

const SRC = join(ROOT, 'src')
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path) : [path]
  })

const claimFile = join(import.meta.dirname, 'claims.ts')
const shipped = [...files(join(SRC, 'adapters/llm/prompts')), join(SRC, 'adapters/llm/common/promptValues.ts')].map((f) => [relative(SRC, f), readFileSync(f, 'utf8').toLowerCase()] as const)

const texts = (c: Claim) => [c.rule, c.condition, c.missing, c.check, c.correction].filter((t): t is string => !!t)
const withStatus = (status: Claim['status']) => CLAIMS.filter((c) => c.status === status)
const byId = (id: string) => CLAIMS.find((c) => c.claimId === id)
const KINDS: (DesignKind | null)[] = [null, ...DESIGN_KINDS]
const ANCHORING = 'anchor-tall-furniture-to-a-stud-or-solid-wall'

describe('claims registry', () => {
  it('has unique ids, every status and origin, and the coverage of the audit', () => {
    const ids = CLAIMS.map((c) => c.claimId)
    expect(new Set(ids).size).toBe(ids.length)
    expect(CLAIM_STATUS.filter((s) => withStatus(s).length === 0)).toEqual([])
    expect(CLAIM_ORIGIN.filter((o) => !CLAIMS.some((c) => c.origin === o))).toEqual([])
    expect(CLAIMS.length).toBeGreaterThanOrEqual(36)
  })

  it('every status carries what it needs', () => {
    const missing = [
      ...withStatus('valid').filter((c) => !c.rule),
      ...withStatus('conditional').filter((c) => !(c.rule && c.condition && (c.missing || c.check))),
      ...withStatus('corrected').filter((c) => !(c.rule && c.correction && c.reference.length > 0 && c.docRow)),
      ...withStatus('excluded').filter((c) => !(c.why && c.leakPatterns.length > 0) || c.rule),
    ]
    expect(missing.map((c) => c.claimId)).toEqual([])
  })

  it('the schema rejects entries missing what their status needs', () => {
    const base = { claimId: 'x', scope: 'workflow', origin: 'course', kinds: 'all', operations: 'all' }
    const accepted = [
      { ...base, status: 'corrected', rule: 'A rule.' },
      { ...base, status: 'conditional', rule: 'A rule.' },
      { ...base, status: 'excluded', why: 'no', leakPatterns: ['abc'], rule: 'A rule.' },
      { ...base, claimId: 'Not A Slug', status: 'valid', rule: 'A rule.' },
    ].filter((entry) => ClaimSchema.safeParse(entry).success)
    expect(accepted).toEqual([])
  })

  it('every docRow is a real row of the reference', () => {
    const problems = CLAIMS.flatMap((c) => {
      const problem = c.docRow ? sourceProblem(c.docRow) : null
      return problem ? [`${c.claimId}: ${problem}`] : []
    })
    expect(problems).toEqual([])
  })

  it('an excluded claim points to a live entry when it names a replacement', () => {
    const broken = CLAIMS.filter((c) => c.replacedBy && (!byId(c.replacedBy) || byId(c.replacedBy)?.status === 'excluded'))
    expect(broken.map((c) => c.claimId)).toEqual([])
  })

  it('has no photo reading operation, and only known kinds', () => {
    expect([...OPERATIONS].map(String)).not.toContain('reading')
    const unknown = CLAIMS.flatMap((c) => (c.kinds === 'all' ? [] : c.kinds.filter((k) => !DESIGN_KINDS.includes(k))))
    expect(unknown).toEqual([])
    const tagged = CLAIMS.filter((c) => c.operations !== 'all' && c.operations.map(String).includes('reading'))
    expect(tagged).toEqual([])
  })
})

describe('rule text', () => {
  // A craft number lives in a cited row or in a check of Knotty, never in the words the expert is handed.
  const NUMBER = /\d|%|\b(mm|cm|m2|kg|n·m|mpa|minutes?|hours?|days?|grit|grits|microns?|grano|granos)\b/i

  it('carries no digits and no craft units', () => {
    const found = CLAIMS.flatMap((c) => texts(c).filter((t) => NUMBER.test(t)).map((t) => `${c.claimId}: ${t}`))
    expect(found).toEqual([])
  })

  it('stays short: one or two sentences', () => {
    const long = CLAIMS.filter((c) => (c.rule ?? '').split(/(?<=[.:;])\s+/).length > 2)
    expect(long.map((c) => c.claimId)).toEqual([])
  })

  it('never refers to lessons, courses, videos or a teacher', () => {
    const found = CLAIMS.filter((c) => texts(c).some((t) => /\b(lessons?|courses?|videos?|teachers?|instructors?)\b/i.test(t)))
    expect(found.map((c) => c.claimId)).toEqual([])
  })

  it('does not use the words the domain keeps out', () => {
    const found = CLAIMS.filter((c) => texts(c).some((t) => /\b(window|document|localStorage|fetch)\b/i.test(t)))
    expect(found.map((c) => c.claimId)).toEqual([])
  })

  it('a leak pattern is a short fragment, never a passage', () => {
    const long = CLAIMS.flatMap((c) => c.leakPatterns.filter((p) => p.trim().split(/\s+/).length > 8).map((p) => `${c.claimId}: ${p}`))
    expect(long).toEqual([])
  })
})

describe('adviceFor', () => {
  const everything = KINDS.flatMap((kind) => OPERATIONS.map((operation) => ({ kind, operation, advice: adviceFor(kind, operation) })))

  it('never returns an excluded claim, and returns the rule of the others as written', () => {
    const wrong = everything.flatMap(({ advice }) => advice.filter((a) => {
      const claim = byId(a.claimId)
      return !claim || claim.status === 'excluded' || a.rule !== claim.rule
    }))
    expect(wrong).toEqual([])
  })

  it('returns an entry only for the kinds and operations it is tagged for', () => {
    const wrong = everything.flatMap(({ kind, operation, advice }) => advice.filter((a) => {
      const claim = byId(a.claimId)!
      const kindOk = claim.kinds === 'all' || (kind !== null && claim.kinds.includes(kind))
      const operationOk = claim.operations === 'all' || claim.operations.includes(operation)
      return !kindOk || !operationOk
    }))
    expect(wrong).toEqual([])
  })

  it('without a known kind only the entries for every kind come out', () => {
    const wrong = everything.filter((e) => e.kind === null).flatMap((e) => e.advice.filter((a) => byId(a.claimId)?.kinds !== 'all'))
    expect(wrong).toEqual([])
  })

  it('a conditional entry travels with its condition, and the others without one', () => {
    const advice = everything.flatMap((e) => e.advice)
    const conditional = advice.filter((a) => byId(a.claimId)?.status === 'conditional')
    expect(conditional.length).toBeGreaterThan(0)
    expect(conditional.filter((a) => !a.condition)).toEqual([])
    expect(advice.filter((a) => byId(a.claimId)?.status !== 'conditional' && (a.condition || a.missing))).toEqual([])
  })

  it('gives the anchoring rule to a bookcase and not to a bench', () => {
    expect(adviceFor('bookcase', 'review').map((a) => a.claimId)).toContain(ANCHORING)
    expect(adviceFor('bench', 'review').map((a) => a.claimId)).not.toContain(ANCHORING)
  })

  it('anchoring names a stud or a solid wall and never a toggle', () => {
    const rule = byId(ANCHORING)?.rule ?? ''
    expect(rule).toMatch(/stud or a solid wall/)
    expect(rule).not.toMatch(/toggle|molly/i)
  })

  it('takes the registry as a parameter', () => {
    const only = CLAIMS.filter((c) => c.claimId === 'dry-fit-before-glue')
    expect(adviceFor(null, 'assembly', only)).toHaveLength(1)
    expect(adviceFor(null, 'plan', only)).toEqual([])
  })
})

describe('what the expert reads', () => {
  it('scans the prompt files', () => {
    expect(shipped.length).toBeGreaterThan(10)
  })

  it('has no claim id in any prompt or in the prompt values', () => {
    const ids = CLAIMS.map((c) => c.claimId)
    expect(shipped.flatMap(([f, t]) => ids.filter((id) => t.includes(id)).map((id) => `${id} in ${f}`))).toEqual([])
  })

  it('has no wording of an excluded or corrected claim', () => {
    const patterns = CLAIMS.filter((c) => c.status === 'excluded' || c.status === 'corrected').flatMap((c) => c.leakPatterns.map((p) => [c.claimId, p.toLowerCase()] as const))
    expect(patterns.length).toBeGreaterThan(0)
    expect(shipped.flatMap(([f, t]) => patterns.filter(([, p]) => t.includes(p)).map(([id]) => `${id} in ${f}`))).toEqual([])
  })
})

describe('the registry stays out of reach', () => {
  it('only claims.ts and its test name the raw list: everything else uses adviceFor', () => {
    const users = files(SRC)
      .filter((f) => /\.tsx?$/.test(f) && f !== claimFile && !f.endsWith('claims.test.ts'))
      .filter((f) => /\bCLAIMS\b/.test(readFileSync(f, 'utf8')))
    expect(users.map((f) => relative(SRC, f))).toEqual([])
  })

  it('names no lesson coordinate in the tracked file', () => {
    const text = readFileSync(claimFile, 'utf8')
    expect(text).not.toMatch(/\bL\d{2}\b/)
    expect(text).not.toMatch(/\b\d{1,2}:\d{2}\b/)
    expect(text).not.toMatch(/\b(lesson|lecci[oó]n)\s*\d+/i)
  })

  // The names of the courses and authors are private, so they are not written here: they are read from a file outside git, one fragment per line, when it is on this machine.
  const namesFile = resolve(ROOT, process.env.KNOTTY_PRIVATE_NAMES ?? 'private/leak-names.txt')
  const privateNames = existsSync(namesFile) ? readFileSync(namesFile, 'utf8').split('\n').map((line) => line.trim().toLowerCase()).filter(Boolean) : []
  it.skipIf(!privateNames.length)('names no private course or author in the tracked file', () => {
    const lower = readFileSync(claimFile, 'utf8').toLowerCase()
    expect(privateNames.filter((fragment) => lower.includes(fragment)).length, 'a private name is in the claims file').toBe(0)
  })
})
