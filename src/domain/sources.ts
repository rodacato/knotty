// Where a craft number comes from, cited the way the typology constraints and the grades cite theirs:
// a row of docs/carpinteria as `path#anchor «row»`, or `no reference: why` when the number is Knotty's own.
// sources.test.ts checks that each file, heading and row exists, and that every threshold has one.

/** A number's source: a row of the reference, or why there is none. */
export type Source = string

const DOCS = 'docs/carpinteria'
export const VALUES = 'valores-de-referencia.md'
export const STRUCTURE = 'estructura.md'
export const JOINTS_DOC = 'uniones-y-herrajes.md'

/** A row of the reference: the file, the anchor GitHub gives its heading, and text that is in the row. */
export const cite = (file: string, anchor: string, row: string): Source => `${DOCS}/${file}#${anchor} «${row}»`
/** A number the reference does not give, with why it is what it is. */
export const noReference = (why: string): Source => `no reference: ${why}`
