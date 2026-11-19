// The system's inks inside WebGL and canvas textures (UI-93), which cannot read CSS variables: kept equal to tokens.css by inks.test.ts.

/** The drawing paper, `--color-drawing-paper`; the scene clears to it so the floor's lines blend inside WebGL, not over the page. */
export const PAPER = '#f6efdc'

/** The press ink, `--graphite`: dimension lines, tags, the chosen piece's edges. */
export const INK = '#161412'

/** The second ink, `--graphite-2`, for quieter text. */
export const INK_2 = '#4a443c'

/** `--rust`: only what cannot be done, such as a piece with a problem or one that is removed. */
export const RUST = '#9c3523'

/** The light over the furniture: warm, so wood and paper stay in the sheet's straw. Shared by the Studio and the room. */
export const LIGHT = { sky: '#fff6e8', ground: '#b89a78', sun: '#fff1dc', key: '#fff4e2', side: '#ffe2c0', back: '#dfe7ff' } as const
