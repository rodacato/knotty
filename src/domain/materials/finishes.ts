import { z } from 'zod'

// What a finish is: its products, coats and coverage, each from docs/carpinteria/acabados.md (`source`).
// Where the reference gives no value it stays null and `missing` says so; drying times are the reference's words for the person.

/** The products a finish is made of; the catalog sells each one in containers (`FinishSku.product`). */
export const FINISH_PRODUCT_IDS = [
  'polyurethane-1k', 'marine-varnish', 'water-based-color-varnish', 'nitro-sealer', 'nitro-lacquer', 'wood-primer', 'enamel', 'danish-oil',
] as const
export const FinishProductId = z.enum(FINISH_PRODUCT_IDS)
export type FinishProductId = z.infer<typeof FinishProductId>

/** The finishes the person can choose; absent on a design means 'none'. */
export const FINISH_IDS = ['none', 'polyurethane', 'marine-varnish', 'water-based-color-varnish', 'lacquer', 'paint', 'danish-oil'] as const
export const FinishId = z.enum(FINISH_IDS)
export type FinishId = z.infer<typeof FinishId>

/** How sure the reference is: ✅ two or more sources, ⚠️ one source or workshop practice. */
export type Confidence = 'verified' | 'single-source'

export interface FinishProduct {
  /** For the person. */
  name: string
  /** The data sheet the values come from. */
  example: string
  /** Theoretical m² per litre; `per: 'system'` when the sheet gives it for all the coats together. Null: the reference has no m²/L. */
  coverage: { min: number; max: number; per: 'coat' | 'system' } | null
  /** The reference's words, for the person; null when it gives none. */
  drying: { touch: string | null; recoat: string | null; use: string | null }
  confidence: Confidence
  source: string
}

export const FINISH_PRODUCTS: Record<FinishProductId, FinishProduct> = {
  'polyurethane-1k': {
    name: 'Barniz de poliuretano',
    example: 'Polyform Barniz 3000',
    coverage: { min: 8, max: 8, per: 'coat' },
    drying: { touch: '30 min', recoat: '8 h', use: '7 días (tráfico ligero a los 3)' },
    confidence: 'verified',
    source: 'docs/carpinteria/acabados.md §5, §14.1 and §15 [9]',
  },
  'marine-varnish': {
    name: 'Barniz marino',
    example: 'Polyform Home Barniz Marino',
    // 9–10 m²/L glossy and 7–8 matte or semi-matte: the sheen is not chosen, so the range spans both.
    coverage: { min: 7, max: 10, per: 'coat' },
    drying: { touch: '1–2 h', recoat: '4 h', use: '7 días' },
    confidence: 'verified',
    source: 'docs/carpinteria/acabados.md §5, §14.1 and §15 [11]',
  },
  'water-based-color-varnish': {
    name: 'Barniz de color base agua',
    example: 'Polyform Barniz Color BA',
    coverage: { min: 10, max: 15, per: 'coat' },
    // §15 gives no time between coats; it is hard at 45–60 min.
    drying: { touch: '15–30 min', recoat: null, use: '24 h' },
    confidence: 'verified',
    source: 'docs/carpinteria/acabados.md §5, §14.1 and §15 [12]',
  },
  'nitro-sealer': {
    name: 'Sellador de nitrocelulosa',
    example: 'Sayer Lack Sellalack NS-0270',
    // The reference only has NS-44300's 120–150 g/m²; without its density that is not m²/L.
    coverage: null,
    drying: { touch: '10–12 min', recoat: '15–20 min', use: '40 min para acabar' },
    confidence: 'single-source',
    source: 'docs/carpinteria/acabados.md §3 and §15 [13][14]',
  },
  'nitro-lacquer': {
    name: 'Laca de nitrocelulosa',
    example: 'Sayer Lack',
    // The reference only says it dries in minutes and goes on with a spray gun: no data sheet.
    coverage: null,
    drying: { touch: null, recoat: null, use: null },
    confidence: 'verified',
    source: 'docs/carpinteria/acabados.md §4 [2][8]',
  },
  'wood-primer': {
    name: 'Primario para madera',
    example: 'Berel Fondo Blanco para Madera',
    coverage: { min: 6, max: 7, per: 'system' },
    drying: { touch: 'hasta 1 h', recoat: null, use: null },
    confidence: 'single-source',
    source: 'docs/carpinteria/acabados.md §9, §14.1 and §15 [16]',
  },
  enamel: {
    name: 'Esmalte base agua',
    example: 'Comex Acqua 100 Total',
    coverage: { min: 6, max: 8, per: 'coat' },
    drying: { touch: null, recoat: null, use: null },
    confidence: 'single-source',
    source: 'docs/carpinteria/acabados.md §9 and §14.1 [29]',
  },
  'danish-oil': {
    name: 'Aceite danés',
    example: 'Aceite danés',
    coverage: { min: 12.5, max: 12.5, per: 'coat' },
    drying: { touch: null, recoat: '4–24 h', use: null },
    confidence: 'single-source',
    source: 'docs/carpinteria/acabados.md §6, §14.1 and §15 [6]',
  },
}

/** One step of a finish: a product and its coats (null when the reference does not say how many). */
export interface FinishLayer {
  role: 'sealer' | 'primer' | 'finish'
  product: FinishProductId
  coats: number | null
}

export interface Finish {
  /** For the person. */
  name: string
  layers: FinishLayer[]
  /** Grits for the faces before finishing and between coats (null when the reference gives none for this finish). */
  sanding: { faces: number[]; betweenCoats: number[] | null } | null
  /** Only indoors, as the data sheet says; null when the reference does not say. */
  indoorsOnly: boolean | null
  /** What a beginner must know, in Spanish. */
  advice: string
  /** What the reference lacks for this finish, for whoever fills it in. */
  missing: string[]
  source: string
}

/** Faces go 120 → 180 → 220 before sealing (acabados.md §2.1, valores-de-referencia.md §13). */
const FACES = [120, 180, 220]

export const FINISHES: Record<FinishId, Finish> = {
  none: {
    name: 'Sin acabado',
    layers: [],
    sanding: null,
    indoorsOnly: null,
    advice: 'El triplay queda como sale de la tienda. Si luego lo barnizas, lija las caras 120 → 180 → 220.',
    missing: [],
    source: 'docs/carpinteria/acabados.md §2.1',
  },
  polyurethane: {
    name: 'Barniz de poliuretano',
    // Sealer: the same varnish diluted at 50 %, 1 or 2 coats (counted as 1 full coat); then 3 coats minimum.
    layers: [
      { role: 'sealer', product: 'polyurethane-1k', coats: 1 },
      { role: 'finish', product: 'polyurethane-1k', coats: 3 },
    ],
    sanding: { faces: FACES, betweenCoats: [320] },
    indoorsOnly: true,
    advice: 'Sella con el mismo barniz diluido al 50 %, nunca con sellador de nitro. Solo para interiores: al sol amarillea. Deja 8 h entre manos; se usa normal a los 7 días.',
    missing: [],
    source: 'docs/carpinteria/acabados.md §3, §5, §14.1 and §15 [9]',
  },
  'marine-varnish': {
    name: 'Barniz marino',
    // Sealer: the same varnish diluted at 100 %. It takes 2–3 coats: Knotty counts the 3 of the worked example in §14.1.
    layers: [
      { role: 'sealer', product: 'marine-varnish', coats: 1 },
      { role: 'finish', product: 'marine-varnish', coats: 3 },
    ],
    sanding: { faces: FACES, betweenCoats: [240, 320] },
    indoorsOnly: false,
    advice: 'Aguanta interior y exterior bajo techo; en exterior dura poco y se revisa cada año. Sella con el mismo barniz diluido; 4 h entre manos.',
    missing: [],
    source: 'docs/carpinteria/acabados.md §3, §5, §13, §14.1 and §15 [11]',
  },
  'water-based-color-varnish': {
    name: 'Barniz de color base agua',
    // 2 coats minimum, 3 if the wood is very porous; its sheet asks for no sealer.
    layers: [{ role: 'finish', product: 'water-based-color-varnish', coats: 2 }],
    sanding: { faces: FACES, betweenCoats: [240] },
    indoorsOnly: true,
    advice: 'Tiñe y protege en un paso. Levanta la fibra: moja con un trapo, deja secar y lija ligero con 220 antes. Da 3 manos si el pino es muy poroso. No es para exterior.',
    missing: ['time between coats'],
    source: 'docs/carpinteria/acabados.md §2.2, §5, §14.1 and §15 [12]',
  },
  lacquer: {
    name: 'Sellador y laca',
    layers: [
      { role: 'sealer', product: 'nitro-sealer', coats: 1 },
      { role: 'finish', product: 'nitro-lacquer', coats: null },
    ],
    sanding: { faces: FACES, betweenCoats: [240, 320] },
    indoorsOnly: null,
    advice: 'Seca en minutos y se repara fácil, pero se aplica con pistola y el solvente es inflamable: ventila y usa mascarilla. El sellador de nitro no va debajo de poliuretano.',
    missing: ['coverage of the sealer and the lacquer in m²/L', 'number of lacquer coats', 'drying times of the lacquer'],
    source: 'docs/carpinteria/acabados.md §3, §4 and §18 [8][13][14]',
  },
  paint: {
    name: 'Pintura (primario y esmalte)',
    layers: [
      { role: 'primer', product: 'wood-primer', coats: 2 },
      { role: 'finish', product: 'enamel', coats: 2 },
    ],
    sanding: { faces: FACES, betweenCoats: null },
    indoorsOnly: null,
    advice: 'En el pino pon primario bloqueador sobre los nudos o la resina se transparenta. El esmalte base agua levanta la fibra: lija después del primario. La pintura esconde la veta.',
    missing: ['grit between coats of paint', 'drying times of the enamel'],
    source: 'docs/carpinteria/acabados.md §9, §14.1 and §15 [1][16][29]',
  },
  'danish-oil': {
    name: 'Aceite danés',
    layers: [{ role: 'finish', product: 'danish-oil', coats: 3 }],
    sanding: { faces: FACES, betweenCoats: null },
    indoorsOnly: null,
    advice: 'Tres manos retirando el exceso con trapo; oscurece la madera. Los trapos con aceite pueden prenderse solos: tiéndelos extendidos o remójalos antes de tirarlos.',
    missing: ['grit between coats'],
    source: 'docs/carpinteria/acabados.md §6, §14.1 and §18 [6]',
  },
}

/** The finish of a design: none when the person has not chosen one. */
export const finishOf = (design: { finish?: FinishId }): FinishId => design.finish ?? 'none'
