// Each file of the served brand kit (public/brand/) and the source it is copied from.
// Sources already under public/brand/ are written there by export.mjs.
const vectors = ['mark', 'mono', 'inverse', 'emblem', 'maskable']
// The three families of the two-ink system and the Latin files the kit carries; export.mjs copies them from node_modules.
export const fonts = [
  { family: 'oswald', files: ['oswald-latin-wght-normal.woff2'] },
  { family: 'libre-franklin', files: ['libre-franklin-latin-wght-normal.woff2'] },
  { family: 'ibm-plex-mono', files: ['ibm-plex-mono-latin-400-normal.woff2', 'ibm-plex-mono-latin-500-normal.woff2', 'ibm-plex-mono-latin-600-normal.woff2'] },
]
export const fontPackage = (family) => (family === 'ibm-plex-mono' ? '@fontsource/ibm-plex-mono' : `@fontsource-variable/${family}`)
const icons = ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-192.png', 'icon-maskable-512.png']

export const kitDir = 'public/brand'
export const kitArchive = `${kitDir}/knotty-brand-kit.zip`

export const kitFiles = {
  'README.md': 'design/brand/kit/README.md',
  'guidelines.md': 'design/brand/guidelines.md',
  'marketing.md': 'design/brand/marketing.md',
  ...Object.fromEntries(vectors.map((name) => [`knotty-${name}.svg`, `${kitDir}/knotty-${name}.svg`])),
  ...Object.fromEntries(fonts.map(({ family }) => [`${family}.LICENSE`, `${kitDir}/${family}.LICENSE`])),
  ...Object.fromEntries(fonts.flatMap(({ files }) => files).map((name) => [name, `${kitDir}/${name}`])),
  ...Object.fromEntries(icons.map((name) => [name, `public/${name}`])),
  'knotty-icon.png': 'public/icon-512.png',
  'knotty.tokens.css': 'src/ui/system/tokens.css',
  'share.png': 'public/share.png',
  'aparador.jpg': 'design/assets/studio/scene/landing-aparador.jpg',
  'materials-cut-list.jpg': 'design/assets/studio/current/desktop-materials-list.jpg',
}
