import { z } from 'zod'
import { migrateState } from './migrate'
import { currentDesign, DesignState } from './state'

// A design session as a file the person keeps or passes on. `knotty` versions this envelope; `state.format` keeps versioning the session.

export const DESIGN_FILE_EXTENSION = '.knotty'
const ENVELOPE_VERSION = 1
const STATE_FORMAT = DesignState.shape.format.value

export const DesignFile = z.object({
  knotty: z.literal(ENVELOPE_VERSION),
  kind: z.literal('design'),
  /** The Knotty version that wrote it; informative only. */
  app: z.string(),
  exportedAt: z.string(),
  name: z.string(),
  state: DesignState,
})
export type DesignFile = z.infer<typeof DesignFile>

export type DesignFileRejection = 'not-knotty' | 'newer' | 'invalid' | 'too-large'
export type DesignFileResult = { ok: true; state: DesignState } | { ok: false; reason: DesignFileRejection }

const rejected = (reason: DesignFileRejection): DesignFileResult => ({ ok: false, reason })
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

export function toDesignFile(state: DesignState, app: string, exportedAt: string): DesignFile {
  return { knotty: ENVELOPE_VERSION, kind: 'design', app, exportedAt, name: currentDesign(state).name, state }
}

const isImage = (dataUrl: string | null) => dataUrl === null || dataUrl.startsWith('data:image/')

/** Reads what a file held, which nobody vouches for, back into a session in the current format. */
export function readDesignFile(raw: unknown): DesignFileResult {
  if (!isObject(raw) || raw.kind !== 'design' || typeof raw.knotty !== 'number') return rejected('not-knotty')
  if (raw.knotty > ENVELOPE_VERSION) return rejected('newer')
  // `migrateState` hands back a format it does not know untouched, so a newer one has to be told apart before the schema calls it invalid.
  if (isObject(raw.state) && typeof raw.state.format === 'number' && raw.state.format > STATE_FORMAT) return rejected('newer')
  const parsed = DesignState.safeParse(migrateState(raw.state))
  if (!parsed.success) return rejected('invalid')
  const state = parsed.data
  if (![...state.thumbnails.map((t) => t.dataUrl), ...state.chat.map((m) => m.thumbnail)].every(isImage)) return rejected('invalid')
  return { ok: true, state }
}

const MAX_NAME_LENGTH = 60

export function designFileName(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, MAX_NAME_LENGTH)
    .replace(/^-+|-+$/g, '')
  return `${slug || 'mueble'}${DESIGN_FILE_EXTENSION}`
}
