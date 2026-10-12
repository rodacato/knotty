# Knotty assets

The assembly mark is two opposing pieces, drawn in two strokes. Keep its proportions, line weight and orientation. Leave clear space at least as wide as one piece. Use the walnut or monochrome mark on light surfaces, the inverse on dark surfaces, and the pine emblem for app icons.

SVGs are editable vectors. `knotty-maskable.svg` keeps the entire mark inside the central safe circle. `knotty-icon.png` is the regular app icon; do not substitute it for a maskable icon.

`knotty.tokens.css` is Knotty's canonical **source stylesheet**, not a standalone compiled stylesheet. It imports Tailwind and the three Fontsource packages declared in Knotty's package.json. Compile it through the same Vite/Tailwind pipeline. The local WOFF2 files in this kit can also be used with `@font-face`; keep their corresponding license files with redistributed fonts.

Fraunces is for headings and the wordmark, Inter for reading and controls, and JetBrains Mono for measures, prices and codes. Product copy is Mexican Spanish, with workshop vocabulary and explicit units.

The default interface is dark. Warm drawing sheets give the furniture a light stage; the surrounding text and actions remain dark. The grid is decorative and does not represent measurements.

Source and maintenance: [Knotty brand documentation](https://github.com/rodacato/knotty/blob/main/docs/brand.md). This kit is exported from the repository; edit the source and regenerate rather than editing exports.
