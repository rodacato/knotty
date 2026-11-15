// The scene's floor is a drawing sheet (UI-93): the paper the page is printed on, ruled in a light ink.

/** The drawing paper, `--color-drawing-paper`; the scene clears to it so the floor's lines blend inside WebGL, not over the page. */
export const PAPER = '#f6efdc'

/** Ink laid thin over the paper: the cell lines lighter, every fifth (half a metre) a little heavier. */
export const FLOOR_LINES = { cell: '#ddd6c5', section: '#c8c1b1' } as const
