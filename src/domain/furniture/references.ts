import { z } from 'zod'
import { DesignKind } from '../design/kind'
import { FinishId } from '../materials/finishes'
import { FurniturePlan } from './modules/plan'

// The ficha of a piece of furniture of reference, as a file: <code>.v<version>.json, the version in the name as the prompts' is (kc-apa-01.v2.json replaces kc-apa-01.v1.json). The files live in adapters/references/.

export const HOME_CATEGORIES = ['bedroom', 'storage', 'tables'] as const

/** KC: checked against a product of the reference catalog. GN: a generic starting point with no product behind it. */
const CODE = /^(KC|GN)-[A-Z]+-\d{2}$/

export const ReferenceFile = z
  .object({
    format: z.literal(1),
    code: z.string().regex(CODE),
    id: z.string().min(1),
    /** Where it goes on the home screen. A reference without it is still a reference (probe, bench) and does not start a design. */
    home: z.object({ order: z.number().int().positive(), category: z.enum(HOME_CATEGORIES) }).optional(),
    name: z.string().min(1),
    kind: DesignKind.optional(),
    finish: FinishId.optional(),
    /** The catalog product a generic piece resembles; nobody has checked it against the product. */
    inspiredBy: z.string().regex(/^KC-[A-Z]+-\d{2}$/).optional(),
    /** What it is, for the person. */
    notes: z.string().min(1),
    plan: FurniturePlan,
  })
  .strict()

export type Reference = z.infer<typeof ReferenceFile> & { version: number }

const FILE_NAME = /(?:^|\/)([a-z]+-[a-z]+-\d{2})\.v(\d+)\.json$/

/** The references of a set of files: the ones on the home screen first, in its order, then the rest by code. Fails on the first file that is not one, so a bad ficha never reaches the screen. */
export function loadReferences(files: Record<string, unknown>): Reference[] {
  const references = Object.entries(files).map(([path, raw]) => {
    const name = FILE_NAME.exec(path)
    if (!name) throw new Error(`${path}: the name is <code>.v<version>.json, like kc-apa-01.v1.json`)
    const parsed = ReferenceFile.safeParse(raw)
    if (!parsed.success) throw new Error(`${path}: ${parsed.error.issues.map((i) => `${i.path.join('.') || '(file)'} ${i.message}`).join('; ')}`)
    if (parsed.data.code.toLowerCase() !== name[1]) throw new Error(`${path}: its code is ${parsed.data.code}`)
    return { ...parsed.data, version: Number(name[2]) }
  })
  const keys = { code: (r: Reference) => r.code, id: (r: Reference) => r.id, order: (r: Reference) => r.home?.order }
  for (const [key, of] of Object.entries(keys)) {
    const seen = new Set<unknown>()
    for (const r of references) {
      const value = of(r)
      if (value === undefined) continue
      if (seen.has(value)) throw new Error(`two references share the ${key} ${value}`)
      seen.add(value)
    }
  }
  return references.sort((a, b) => (a.home?.order ?? Infinity) - (b.home?.order ?? Infinity) || a.code.localeCompare(b.code))
}
