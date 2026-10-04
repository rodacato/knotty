import { z } from 'zod'
import { DesignKind } from '../design/kind'
import { FinishId } from '../materials/finishes'
import { FurniturePlan } from './modules/plan'
import { Expect } from './probe'

// The ficha of a piece of furniture of reference, as a file: <code>.v<version>.json, the version in the name as the prompts' is (kc-apa-01.v2.json replaces kc-apa-01.v1.json). The files live in adapters/references/.

export const HOME_CATEGORIES = ['bedroom', 'storage', 'tables', 'seating'] as const

/** The home grid has twelve cells and one is the door to designing your own, so at most this many bases are featured. */
export const FEATURED_MAX = 11

/** What the piece has, from a closed list, whether or not the plan can draw it. `gaps` uses the same words for what the plan cannot draw, so counting the gaps across pieces is counting words. A new one is added here on purpose. */
const FEATURES = [
  'inset-doors', 'inset-drawers', 'overlay-doors', 'legs', 'kick', 'wall-anchor', 'wall-hung', 'open-niche', 'no-back',
  'sliding-doors', 'asymmetric-arrangement', 'routed-fronts', 'notch-pulls', 'angled-cut', 'curved-cut', 'multi-body', 'adjustable-height', 'casters', 'glass',
  'splayed-legs', 'raised-sides', 'slatted-fronts', 'slatted-base', 'finger-joints',
] as const

/** exact: the plan says all that matters of the piece; adapted: it builds something close, and `adaptations` says what changed; unsupported: it cannot be built. */
const SUPPORT = ['exact', 'adapted', 'unsupported'] as const

/** KC: checked against a product of the reference catalog. GN: a generic starting point with no product behind it. */
const CODE = /^(KC|GN)-[A-Z]+-\d{2}$/

export const ReferenceFile = z
  .object({
    format: z.literal(1),
    code: z.string().regex(CODE),
    id: z.string().min(1),
    /** Where it goes on the home screen: in its category, and in the featured ones when `featured`. A reference without it is still a reference (probe, bench) and does not start a design. */
    home: z.object({ order: z.number().int().positive(), category: z.enum(HOME_CATEGORIES), featured: z.boolean().optional() }).optional(),
    name: z.string().min(1),
    kind: DesignKind.optional(),
    finish: FinishId.optional(),
    /** The catalog product a generic piece resembles; nobody has checked it against the product. */
    inspiredBy: z.string().regex(/^KC-[A-Z]+-\d{2}$/).optional(),
    /** What it is, for the person. */
    notes: z.string().min(1),
    plan: FurniturePlan,
    /** How hard it is to build, 1 to 4 (docs/carpinteria/muebles-y-medidas.md §1). */
    difficulty: z.number().int().min(1).max(4).optional(),
    support: z.enum(SUPPORT).optional(),
    features: z.array(z.enum(FEATURES)).optional(),
    adaptations: z.array(z.string().min(1)).optional(),
    /** What the piece has and the plan cannot draw: always a subset of `features`. */
    gaps: z.array(z.enum(FEATURES)).optional(),
    /** What the engine makes of the plan; `probe` checks it and rewrites it. */
    expect: Expect,
  })
  .strict()
  .refine((r) => !r.code.startsWith('KC-') || (r.support && r.difficulty && r.features && r.adaptations && r.gaps), { message: 'a KC reference says its support, difficulty, features, adaptations and gaps' })
  .refine((r) => (r.gaps ?? []).every((g) => r.features?.includes(g)), { message: 'a gap is a feature the plan cannot draw: every gap is also in features', path: ['gaps'] })

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
