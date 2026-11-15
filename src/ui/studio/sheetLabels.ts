// Average glyph width as a fraction of the font size, with room to spare: Oswald for the name (about 0.42), IBM Plex Mono for the size.
const DISPLAY_EM = 0.5
const MONO_EM = 0.6
const STROKE_ROOM = 24
const MIN_HEIGHT = 110
// Below these a label is fine print at the diagram's usual scale, so it is left out rather than shrunk further.
const MIN_NAME = 48
const MIN_SIZE = 40

/** Which labels a piece on a sheet diagram can show without spilling out of its rectangle, in sheet units (mm): as large as the piece allows, never below a legible size. */
export function sheetLabels(w: number, h: number, name: string, size: string) {
  const room = w - 2 * STROKE_ROOM
  const fit = (text: string, cap: number, share: number, em: number, least: number) => {
    const fontSize = Math.floor(Math.min(cap, h * share, room / (text.length * em)))
    return h > MIN_HEIGHT && fontSize >= least ? fontSize : null
  }
  return {
    name: fit(name, 150, 0.34, DISPLAY_EM, MIN_NAME),
    size: fit(size, 90, 0.24, MONO_EM, MIN_SIZE),
  }
}
