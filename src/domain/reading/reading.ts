import { z } from 'zod'

// What the expert sees in one photo, as structure Knotty can merge and later turn into geometry. Descriptions stay in Spanish: the person reads them.

const Confidence = z.enum(['high', 'medium', 'low'])

export const Cell = z.object({
  height: z.number().positive().describe('Height of the opening as a fraction of the height of its column'),
  content: z.enum(['open', 'drawer', 'door', 'closed']).describe('open: open; drawer: drawer; door: door; closed: covered, not opening'),
  shelves: z.number().int().nonnegative().nullable().describe('Shelves inside an open opening or behind a door'),
  doors: z.number().int().positive().nullable().describe('How many door leaves cover the opening'),
})
export type Cell = z.infer<typeof Cell>

export const Column = z.object({
  width: z.number().positive().describe('Column width as a fraction of the total width'),
  cells: z.array(Cell).describe('Openings from bottom to top'),
})
export type Column = z.infer<typeof Column>

export const PhotoReading = z.object({
  kind: z.string().describe('What furniture it is, in one or two words, in Spanish: "librero", "buró", "cama individual"'),
  confidence: Confidence,
  description: z.string().describe('What can be seen of the main piece of furniture, in 1 or 2 sentences, in Spanish'),
  proportions: z
    .object({ height: z.number().positive(), width: z.number().positive(), depth: z.number().positive().nullable() })
    .nullable()
    .describe('Relative height, width and depth, with width = 1; null if the view does not allow estimating them'),
  base: z.enum(['kick', 'legs', 'floor', 'wheels']).nullable().describe('kick: kick plate; legs: legs; floor: directly on the floor; wheels: wheels'),
  topOverhangs: z.boolean().nullable().describe('Whether the top sticks out past the sides'),
  columns: z.array(Column).nullable().describe('Vertical divisions from left to right, seen from the front; null if the view does not show them'),
  details: z.array(z.string()).describe('Finishes, edges, visible joints, handles; in Spanish'),
  doubts: z.array(z.string()).describe('What the photo does not tell and is worth asking, in Spanish'),
})
export type PhotoReading = z.infer<typeof PhotoReading>

/** The angles a photo can be taken from, as the person calls them. */
const ANGLE_LABEL: Record<string, string> = { front: 'frente', 'three-quarter': '3/4', side: 'lateral', inside: 'interior', joints: 'uniones' }
export const angleLabel = (angle: string) => ANGLE_LABEL[angle] ?? angle

/** Which views see each field best: the front sees the layout, the side sees the depth. */
const BEST_FOR_COLUMNS = ['front', 'inside', 'three-quarter', 'side', 'joints']
const BEST_FOR_DEPTH = ['side', 'three-quarter', 'front', 'inside', 'joints']
const RANK_CONFIDENCE = { high: 0, medium: 1, low: 2 }

const preferred = (readings: { angle: string; reading: PhotoReading }[], order: string[]) =>
  [...readings].sort((a, b) => RANK_CONFIDENCE[a.reading.confidence] - RANK_CONFIDENCE[b.reading.confidence] || order.indexOf(a.angle) - order.indexOf(b.angle))

const unique = (items: string[]) => [...new Set(items.map((i) => i.trim()).filter(Boolean))]

/** One reading from several photos, field by field from the view that sees it best. Deterministic. */
export function mergeReadings(readings: { angle: string; reading: PhotoReading }[]): PhotoReading | null {
  if (!readings.length) return null
  const byLayout = preferred(readings, BEST_FOR_COLUMNS)
  const byDepth = preferred(readings, BEST_FOR_DEPTH)
  const main = byLayout[0].reading
  const proportions = byLayout.find((r) => r.reading.proportions)?.reading.proportions ?? null
  const depth = byDepth.find((r) => r.reading.proportions?.depth)?.reading.proportions?.depth ?? null
  return {
    kind: main.kind,
    confidence: main.confidence,
    description: main.description,
    proportions: proportions ? { ...proportions, depth: depth ?? proportions.depth } : null,
    base: byLayout.find((r) => r.reading.base)?.reading.base ?? null,
    topOverhangs: byLayout.find((r) => r.reading.topOverhangs !== null)?.reading.topOverhangs ?? null,
    columns: byLayout.find((r) => r.reading.columns?.length)?.reading.columns ?? null,
    details: unique(readings.flatMap((r) => r.reading.details)),
    doubts: unique(readings.flatMap((r) => r.reading.doubts)),
  }
}

/** A short, stable fingerprint of a photo and its note, so a reading is not repeated. */
export function photoKey(base64: string, note: string) {
  let hash = 0x811c9dc5
  const mix = (code: number) => (hash = Math.imul(hash ^ code, 0x01000193) >>> 0)
  for (let i = 0; i < note.length; i++) mix(note.charCodeAt(i))
  // Photos are long: every 7th character is enough to tell two of them apart.
  for (let i = 0; i < base64.length; i += 7) mix(base64.charCodeAt(i))
  return `${hash.toString(16)}-${base64.length}`
}
