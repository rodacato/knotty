import type { Design } from './schema'
import type { Box } from './resolve'

export interface Differences {
  added: string[]
  removed: string[]
  changed: string[]
}

const PROPERTIES = ['name', 'role', 'material', 'grain', 'load', 'support', 'group'] as const
const boxChanged = (a: Box, b: Box) => (Object.keys(a) as (keyof Box)[]).some((k) => Math.abs(a[k] - b[k]) > 0.05)

/** Which pieces changed between two versions, those that only moved along included. */
export function differences(before: Design, boxesBefore: Map<string, Box>, after: Design, boxesAfter: Map<string, Box>): Differences {
  const previous = new Map(before.pieces.map((p) => [p.id, p]))
  const next = new Map(after.pieces.map((p) => [p.id, p]))
  return {
    added: [...next.keys()].filter((id) => !previous.has(id)),
    removed: [...previous.keys()].filter((id) => !next.has(id)),
    changed: [...next.keys()].filter((id) => {
      const a = previous.get(id)
      const b = next.get(id)!
      if (!a) return false
      const ba = boxesBefore.get(id)
      const bb = boxesAfter.get(id)
      return PROPERTIES.some((k) => a[k] !== b[k]) || (!!ba && !!bb && boxChanged(ba, bb))
    }),
  }
}

export const hasDifferences = (d: Differences) => d.added.length + d.removed.length + d.changed.length > 0
