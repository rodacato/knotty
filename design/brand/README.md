# Knotty brand

The brand source lives here. Start with this page, then read the [guidelines](guidelines.md) and the [marketing copy](marketing.md). Everything under `public/` is a generated runtime copy: edit the sources named below and regenerate rather than editing a copy.

## Identity

Knotty helps a person choose a plywood furniture base, adjust it to their space, understand its pieces in 3D and take a reviewed materials/cut list to the workshop. The identity ties that to the paperwork of a Mexican lumber yard: a **cut ticket printed in two inks**, black press ink and one vermilion spot ink, on pale straw paper. Structure is drawn with rules like a printed form, and wood keeps its material color. The product layer that every screen follows is the [visual north star](../north-star/README.md).

- **Logo:** two pine planks joined by a box joint, the left one with its knot, printed in ink with a vermilion plate out of register; the wordmark is **Knotty** in Oswald. Clear space, variants and minimum sizes: [guidelines › Mark and wordmark](guidelines.md#mark-and-wordmark).
- **Color:** roles, not a hex table. One paper theme, independent of the device theme. Ink for text, rules and the selection; vermilion only for the screen's primary action. [Guidelines › Surfaces and color roles](guidelines.md#surfaces-and-color-roles).
- **Type:** Oswald for titles, steps, buttons and the wordmark; Libre Franklin for reading, help and warnings; IBM Plex Mono for measures, prices and codes. All are local Fontsource fonts. [Guidelines › Typography and layout](guidelines.md#typography-and-layout).
- **Voice:** Mexican Spanish, direct and concrete, workshop vocabulary, explicit units. Invitation: «Madera de verdad. Medidas claras. Un paso a la vez.» [Guidelines › Voice](guidelines.md#voice).
- **Marketing:** audience and promise, the three-part explanation, product proof, actions and destinations, metadata, and the claims Knotty must not make. [marketing.md](marketing.md).

## Sources

| What | Source | Notes |
|---|---|---|
| Mark geometry | [`src/ui/system/knot.svg`](../../src/ui/system/knot.svg) | Shared by [`Brand.tsx`](../../src/ui/system/Brand.tsx) and [`export.mjs`](../../scripts/brand/export.mjs). An `ink` path and a `plate` path, traced from the picked generated image, and the emblem crop in `data-emblem`. Preserve the hand-cut edges, the clear space and the maskable safe area; inspect at small icon sizes. |
| Colors, fonts, spacing, shape, motion | [`src/ui/system/tokens.css`](../../src/ui/system/tokens.css) | The guide page reads the actual CSS properties. `drawing-sheet` keeps a drawing's own inks inside any panel; `drawing-surface` adds a faint decorative grid. There is one theme; the interface does not follow the device theme. |
| Fonts | `@fontsource-variable/{oswald,libre-franklin}`, `@fontsource/ibm-plex-mono` | Exported as Latin WOFF2 subsets with their licenses; the list lives in [`kit-files.mjs`](../../scripts/brand/kit-files.mjs). |
| Visual north star | [`design/north-star/`](../north-star/README.md) | The reference images every screen is built against, and the [type specimen](../north-star/type.html). |
| Social card | [`scripts/brand/share.py`](../../scripts/brand/share.py) | Built from the mark, tokens, font outlines and a product capture. |
| Product examples | [`design/assets/studio/scene/landing-aparador.jpg`](../assets/studio/scene/landing-aparador.jpg) (the landing's scene), [`design/assets/studio/current/desktop-materials-list.jpg`](../assets/studio/current/desktop-materials-list.jpg) («Preparar materiales», the cut list open) | Example furniture, not customers or testimonials. Retake the cut list when its page changes, then `npm run brand:kit`. |
| Guide and landing pages | `src/ui/presentation/BrandGuide.tsx`, `Presentation.tsx`, `pages.css` | Served at `/marca/` and `/`. |
| Brand rules and copy | [`guidelines.md`](guidelines.md), [`marketing.md`](marketing.md) | Shipped into the kit as-is. When public wording changes in the code, update `marketing.md` with it. |
| Kit instructions | [`kit/README.md`](kit/README.md) | Becomes the kit's `README.md`. |

The kit's Markdown files travel flat inside the ZIP, so their relative links point at kit file names (`knotty.tokens.css`, `share.png`…), not at repository paths.

## Asset map

Runtime copies stay where the build serves them. All are generated; commit them with their sources.

| Runtime copy | From | Made by |
|---|---|---|
| `public/favicon.svg`, `favicon.ico`, `icon-192.png`, `icon-512.png`, `icon-maskable-*.png`, `apple-touch-icon.png` | `scripts/brand/knot*.svg` (exported from `knot.svg` and tokens) | `generate.sh` |
| `public/share.png` (1200 × 630, Open Graph) | `share.py`, from `design/assets/studio/scene/share-aparador.jpg` | `generate.sh` |
| `design/brand/github-social.png` (1280 × 640) | `share.py github` | `generate.sh`; upload it by hand in the repository's Settings → Social preview, since GitHub cannot read it from the repo |
| `public/brand/knotty-{mark,mono,inverse,emblem,maskable}.svg`, `knotty.tokens.css`, fonts and `.LICENSE` files | `knot.svg`, `tokens.css`, Fontsource | `export.mjs` (run by `generate.sh`) |
| `public/brand/` kit (icons, share card, examples, `README.md`, `guidelines.md`, `marketing.md`) and `public/brand/knotty-brand-kit.zip` | the files above and this folder | `npm run brand:kit` ([`kit.mjs`](../../scripts/brand/kit.mjs)); each entry's source is declared in [`kit-files.mjs`](../../scripts/brand/kit-files.mjs) |

| `design/brand/demo/{main,spotlight,structure,room}.gif` (the README's clips) | [`e2e/demo/demos.ts`](../../e2e/demo/demos.ts), one test per GIF, driving the built app with the Simulado expert | `npm run brand:demo`: Playwright records each test, then [`demo.mjs`](../../scripts/brand/demo.mjs) trims and converts it with ffmpeg |

The clips stay out of `public/` so the build and the offline cache do not carry them.

`public/brand/` is served at `/knotty/brand/`: the guide's **Descargar todo** links to the ZIP and the service worker keeps the last good kit offline.

## Regenerate

- After a change to the mark, tokens, fonts or social card, run the full export: [`scripts/brand/README.md`](../../scripts/brand/README.md) (Node, `rsvg-convert`, Python with the export dependencies). It ends by assembling the kit.
- After a change to the Markdown here or the example captures only:

  ```bash
  npm run brand:kit
  node scripts/brand/verify-kit.mjs
  ```

- After a change the README's clips show (a screen, a text, the catalog's first pieces), remake them and look at them before committing:

  ```bash
  npx playwright install chromium   # once
  npm run brand:demo                # needs ffmpeg (on macOS, brew install ffmpeg); about a minute
  ```

  Each clip is a Playwright test, so a flow that broke fails instead of recording. Recording uses the machine's GPU (`--use-angle=metal`); without one, the 3D draws on the CPU and the clips carry blank pauses. The script prints each GIF's size and warns when the main one passes 5 MB.

`verify-kit.mjs` checks that every kit file equals its source, the kit's Markdown links stay portable, and the ZIP holds exactly those bytes. CI runs it through `scripts/brand/verify.mjs`. Preview, Pages verification and the PWA/hosting invariants are in [`docs/brand.md`](../../docs/brand.md).

A portable copy outside the served kit is never committed: if one is needed, extract the ZIP or generate it into `design/brand/dist/` (gitignored).

## Rules

- Keep public product copy in es-MX. State outcomes before expert setup: catalog bases work without an LLM, Claude and OpenAI need a key, and SheLLM's key is optional. Prices are estimates; a generated design needs review before buying or cutting.
- Do not maintain a second palette, a parallel component library or a competing copy of the mark.
