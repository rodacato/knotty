# Knotty brand

The brand source lives here. Start with this page, then read the [guidelines](guidelines.md) and the [marketing copy](marketing.md). Everything under `public/` is a generated runtime copy: edit the sources named below and regenerate rather than editing a copy.

## Identity

Knotty helps a person choose a plywood furniture base, adjust it to their space, understand its pieces in 3D and take a reviewed materials/cut list to the workshop. The identity ties that to wood, paper and a simple assembly: a **dark workshop** interface with **warm paper** for the 3D stage, catalog thumbnails, illustrated choices, joint and edge diagrams, and sheet layouts.

- **Logo:** the approved assembly mark is two opposing pieces drawn in two strokes; the wordmark is **Knotty** in Fraunces. Clear space, variants and minimum sizes: [guidelines › Mark and wordmark](guidelines.md#mark-and-wordmark).
- **Color:** roles, not a hex table. The workshop is dark, the drawing stage is light, and wood keeps its material color, independent of the device theme. The paper grid is decorative, not a measurement scale. [Guidelines › Surfaces and color roles](guidelines.md#surfaces-and-color-roles).
- **Type:** Fraunces for headings and the wordmark, Inter for reading and controls, JetBrains Mono for measures and codes, all existing local variable fonts. [Guidelines › Typography and layout](guidelines.md#typography-and-layout).
- **Voice:** Mexican Spanish, direct and concrete, workshop vocabulary, explicit units. Invitation: «Madera de verdad. Medidas claras. Un paso a la vez.» [Guidelines › Voice](guidelines.md#voice).
- **Marketing:** audience and promise, the three-part explanation, product proof, actions and destinations, metadata, and the claims Knotty must not make. [marketing.md](marketing.md).

## Sources

| What | Source | Notes |
|---|---|---|
| Mark geometry | [`src/ui/system/knot.svg`](../../src/ui/system/knot.svg) | Shared by [`Brand.tsx`](../../src/ui/system/Brand.tsx) and [`export.mjs`](../../scripts/brand/export.mjs). Preserve the two pieces, line weight, clear space and maskable safe area; inspect at small icon sizes. |
| Colors, fonts, spacing, shape, motion | [`src/ui/system/tokens.css`](../../src/ui/system/tokens.css) | The guide page reads the actual CSS properties. `drawing-sheet` supplies the fixed paper palette; `drawing-surface` adds the decorative grid. Scene lighting and labels stay light; the explicit light override remains for future paper contexts; the interface does not follow the device theme. |
| Fonts | `@fontsource-variable/{fraunces,inter,jetbrains-mono}` | Exported as Latin WOFF2 subsets with their licenses. |
| Social card | [`scripts/brand/share.py`](../../scripts/brand/share.py) | Built from the mark, tokens, font outlines and a product capture. |
| Product examples | [`design/assets/studio/scene/desktop-aparador.jpg`](../assets/studio/scene/desktop-aparador.jpg), [`design/assets/studio/current/desktop-materials-list.jpg`](../assets/studio/current/desktop-materials-list.jpg) | Example furniture, not customers or testimonials. |
| Guide and landing pages | `src/ui/presentation/BrandGuide.tsx`, `Presentation.tsx`, `pages.css` | Served at `/marca/` and `/`. |
| Brand rules and copy | [`guidelines.md`](guidelines.md), [`marketing.md`](marketing.md) | Shipped into the kit as-is. When public wording changes in the code, update `marketing.md` with it. |
| Kit instructions | [`kit/README.md`](kit/README.md) | Becomes the kit's `README.md`. |

The kit's Markdown files travel flat inside the ZIP, so their relative links point at kit file names (`knotty.tokens.css`, `share.png`…), not at repository paths.

## Asset map

Runtime copies stay where the build serves them. All are generated; commit them with their sources.

| Runtime copy | From | Made by |
|---|---|---|
| `public/favicon.svg`, `favicon.ico`, `icon-192.png`, `icon-512.png`, `icon-maskable-*.png`, `apple-touch-icon.png` | `scripts/brand/knot*.svg` (exported from `knot.svg` and tokens) | `generate.sh` |
| `public/share.png` | `share.py` | `generate.sh` |
| `public/brand/knotty-{mark,mono,inverse,emblem,maskable}.svg`, `knotty.tokens.css`, fonts and `.LICENSE` files | `knot.svg`, `tokens.css`, Fontsource | `export.mjs` (run by `generate.sh`) |
| `public/brand/` kit (icons, share card, examples, `README.md`, `guidelines.md`, `marketing.md`) and `public/brand/knotty-brand-kit.zip` | the files above and this folder | `npm run brand:kit` ([`kit.mjs`](../../scripts/brand/kit.mjs)); each entry's source is declared in [`kit-files.mjs`](../../scripts/brand/kit-files.mjs) |

`public/brand/` is served at `/knotty/brand/`: the guide's **Descargar todo** links to the ZIP and the service worker keeps the last good kit offline.

## Regenerate

- After a change to the mark, tokens, fonts or social card, run the full export: [`scripts/brand/README.md`](../../scripts/brand/README.md) (Node, `rsvg-convert`, Python with the export dependencies). It ends by assembling the kit.
- After a change to the Markdown here or the example captures only:

  ```bash
  npm run brand:kit
  node scripts/brand/verify-kit.mjs
  ```

`verify-kit.mjs` checks that every kit file equals its source, the kit's Markdown links stay portable, and the ZIP holds exactly those bytes. CI runs it through `scripts/brand/verify.mjs`. Preview, Pages verification and the PWA/hosting invariants are in [`docs/brand.md`](../../docs/brand.md).

A portable copy outside the served kit is never committed: if one is needed, extract the ZIP or generate it into `design/brand/dist/` (gitignored).

## Rules

- Keep public product copy in es-MX. State outcomes before expert setup: catalog bases work without an LLM, Claude and OpenAI need a key, and SheLLM's key is optional. Prices are estimates; a generated design needs review before buying or cutting.
- Do not maintain a second palette, a parallel component library or a competing copy of the mark.
