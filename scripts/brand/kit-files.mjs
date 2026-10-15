// Each file of the served brand kit (public/brand/) and the source it is copied from.
// Sources already under public/brand/ are written there by export.mjs.
const vectors = ['mark', 'mono', 'inverse', 'emblem', 'maskable']
const fonts = ['fraunces', 'inter', 'jetbrains-mono']
const icons = ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-192.png', 'icon-maskable-512.png']

export const kitDir = 'public/brand'
export const kitArchive = `${kitDir}/knotty-brand-kit.zip`

export const kitFiles = {
  'README.md': 'design/brand/kit/README.md',
  'guidelines.md': 'design/brand/guidelines.md',
  'marketing.md': 'design/brand/marketing.md',
  ...Object.fromEntries(vectors.map((name) => [`knotty-${name}.svg`, `${kitDir}/knotty-${name}.svg`])),
  ...Object.fromEntries(fonts.map((name) => [`${name}.LICENSE`, `${kitDir}/${name}.LICENSE`])),
  ...Object.fromEntries(['fraunces-latin-full-normal.woff2', 'inter-latin-wght-normal.woff2', 'jetbrains-mono-latin-wght-normal.woff2'].map((name) => [name, `${kitDir}/${name}`])),
  ...Object.fromEntries(icons.map((name) => [name, `public/${name}`])),
  'knotty-icon.png': 'public/icon-512.png',
  'knotty.tokens.css': 'src/ui/system/tokens.css',
  'share.png': 'public/share.png',
  'aparador.jpg': 'design/assets/studio/scene/desktop-aparador.jpg',
  'materials-cut-list.jpg': 'design/assets/studio/current/desktop-materials-list.jpg',
}
