import { exampleBookcase } from '../furniture/fixtures/bookcase'
import type { DesignState } from './state'

export const savedState = (versions = 1): DesignState => ({
  format: 9,
  measures: exampleBookcase.dimensions,
  versions: Array.from({ length: versions }, (_, i) => ({ n: i + 1, design: exampleBookcase, summary: `v${i + 1}`, reason: '', operations: [], date: '', origin: null, decisions: [], plan: null, extras: [], restores: null })),
  current: versions,
  requirements: [],
  decisions: [],
  chat: [],
  thumbnails: [{ view: 'front', dataUrl: 'data:image/jpeg;base64,' + 'A'.repeat(5000) }],
  proposal: null,
  review: null,
  trace: [],
  accepted: [],
  tray: [],
  locks: {},
  ficha: null,
})
