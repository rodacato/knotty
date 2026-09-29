import { basesOf } from '../../domain/furniture/examples'
import { loadReferences } from '../../domain/furniture/references'
import type { ReferenceStore } from '../../ports/ReferenceStore'

// The ficha files next to this one, <code>.v<version>.json, are the references the app ships: renaming one to its next version is the whole change of version.

/** A store over a set of files by path; a bad file fails here, not on the screen. */
export function createReferenceStore(files: Record<string, unknown>): ReferenceStore {
  const references = loadReferences(files)
  return {
    all: () => references,
    latest: (code) => references.find((r) => r.code === code) ?? null,
    home: () => basesOf(references),
  }
}

/** The references bundled with the app. */
export const createBundledReferences = () => createReferenceStore(import.meta.glob<unknown>('./*.json', { import: 'default', eager: true }))
