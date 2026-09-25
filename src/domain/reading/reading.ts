import { z } from 'zod'

// What the expert sees in one photo, as structure Knotty can merge and later turn into geometry. Descriptions stay in Spanish: the person reads them.

const Confidence = z.enum(['high', 'medium', 'low'])

export const Cell = z.object({
  height: z.number().positive().describe('Alto del hueco como fracción del alto de su columna'),
  content: z.enum(['open', 'drawer', 'door', 'closed']).describe('open: abierto; drawer: cajón; door: puerta; closed: tapado sin abrir'),
  shelves: z.number().int().nonnegative().nullable().describe('Repisas dentro de un hueco abierto o detrás de una puerta'),
  doors: z.number().int().positive().nullable().describe('Cuántas hojas de puerta cubren el hueco'),
})
export type Cell = z.infer<typeof Cell>

export const Column = z.object({
  width: z.number().positive().describe('Ancho de la columna como fracción del ancho total'),
  cells: z.array(Cell).describe('Huecos de abajo hacia arriba'),
})
export type Column = z.infer<typeof Column>

export const PhotoReading = z.object({
  kind: z.string().describe('Qué mueble es, en una o dos palabras: "librero", "buró", "cama individual"'),
  confidence: Confidence,
  description: z.string().describe('Lo que se ve del mueble principal, en 1 o 2 frases'),
  proportions: z
    .object({ height: z.number().positive(), width: z.number().positive(), depth: z.number().positive().nullable() })
    .nullable()
    .describe('Alto, ancho y fondo relativos, con ancho = 1; null si la vista no deja estimarlo'),
  base: z.enum(['kick', 'legs', 'floor', 'wheels']).nullable().describe('kick: zoclo; legs: patas; floor: directo al piso; wheels: ruedas'),
  topOverhangs: z.boolean().nullable().describe('Si la cubierta sobresale de los lados'),
  columns: z.array(Column).nullable().describe('Divisiones verticales de izquierda a derecha, vistas de frente; null si la vista no las muestra'),
  details: z.array(z.string()).describe('Acabados, cantos, uniones visibles, jaladeras'),
  doubts: z.array(z.string()).describe('Lo que la foto no deja saber y conviene preguntar'),
})
export type PhotoReading = z.infer<typeof PhotoReading>

/** Which views see each field best: the front sees the layout, the side sees the depth. */
const BEST_FOR_COLUMNS = ['frente', 'interior', '3/4', 'lateral', 'uniones']
const BEST_FOR_DEPTH = ['lateral', '3/4', 'frente', 'interior', 'uniones']
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
