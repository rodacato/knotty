import type { Dimensions } from '../../domain/design/schema'
import { MEASURE_RANGE } from '../../domain/furniture/typical'

/** Without photos, the expert works with what you tell it: asks for a description with some substance. */
export const MIN_DESCRIPTION = 15

export type SpaceKey = keyof Dimensions

/** What the person typed for each side of the available space, in cm. */
export type SpaceText = Record<SpaceKey, string>

export const EMPTY_SPACE: SpaceText = { width: '', depth: '', height: '' }

const MM_PER_CM = 10

/** A cm value from free text ("90", "92,5"); null when empty or not a number. */
export function parseCm(text: string): number | null {
  const clean = text.trim().replace(',', '.')
  if (!clean) return null
  const value = Number(clean)
  return Number.isFinite(value) ? value : null
}

export const spaceRangeCm = (key: SpaceKey): readonly [number, number] => [MEASURE_RANGE[key][0] / MM_PER_CM, MEASURE_RANGE[key][1] / MM_PER_CM]

/** The error a side of the space has, or null when it is empty or fine. */
export function spaceError(key: SpaceKey, text: string): string | null {
  if (!text.trim()) return null
  const cm = parseCm(text)
  const [min, max] = spaceRangeCm(key)
  if (cm === null || cm < min || cm > max) return `Entre ${min} y ${max} cm`
  return null
}

export const spaceIsValid = (text: SpaceText): boolean => (Object.keys(text) as SpaceKey[]).every((key) => spaceError(key, text[key]) === null)

/** The sides the person filled, in mm; null when none. Assumes the text is valid. */
export function spaceToMm(text: SpaceText): Partial<Dimensions> | null {
  const space: Partial<Dimensions> = {}
  for (const key of Object.keys(text) as SpaceKey[]) {
    const cm = parseCm(text[key])
    if (cm !== null) space[key] = Math.round(cm * MM_PER_CM)
  }
  return Object.keys(space).length ? space : null
}

export function spaceFromMm(space: Partial<Dimensions> | null | undefined): SpaceText {
  const text = { ...EMPTY_SPACE }
  for (const key of Object.keys(text) as SpaceKey[]) {
    const mm = space?.[key]
    if (mm) text[key] = String(Math.round(mm) / MM_PER_CM)
  }
  return text
}

/** What is missing before the main button works, or null when it is ready. */
export function designBlocker({ description, photos, reading, space }: { description: string; photos: number; reading: boolean; space: SpaceText }): string | null {
  if (!spaceIsValid(space)) return 'Revisa el espacio disponible'
  if (reading) return 'Preparando tus fotos…'
  if (photos === 0 && description.trim().length < MIN_DESCRIPTION) return 'Describe tu mueble o agrega una foto'
  return null
}
