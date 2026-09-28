// Average glyph width as a fraction of the font size: Inter for the name, JetBrains Mono for the size.
const SANS_EM = 0.56
const MONO_EM = 0.6
const STROKE_ROOM = 24
const MIN_HEIGHT = 110

/** Which labels a piece on a sheet diagram can show without spilling out of its rectangle, in sheet units (mm). */
export function sheetLabels(w: number, h: number, name: string, size: string) {
  const nameSize = Math.min(64, h * 0.32)
  const sizeSize = Math.min(52, h * 0.26)
  const fits = (text: string, fontSize: number, em: number) => h > MIN_HEIGHT && text.length * fontSize * em <= w - 2 * STROKE_ROOM
  return {
    name: fits(name, nameSize, SANS_EM) ? nameSize : null,
    size: fits(size, sizeSize, MONO_EM) ? sizeSize : null,
  }
}
