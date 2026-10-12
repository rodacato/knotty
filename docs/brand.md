# Knotty brand and presentation

The approved assembly mark uses two opposing pieces drawn in two strokes. It keeps the wood identity while making the symbol easy to remember. The default theme is a dark workshop, with warm paper drawing areas for catalog furniture. Their grid is decorative, not a measurement scale. Fraunces, Inter and JetBrains Mono are the existing local variable fonts.

## Preview and verify

```bash
npm ci
npm run dev
```

The app remains at `/`; the presentation is `/presentacion/` and the guide is `/marca/`. Under GitHub Pages, all three live below the repository path. The [presentation](../src/ui/presentation/Presentation.tsx) uses an existing aparador scene and materials capture, the materials capture is focused on the cut list for legibility, plus actual catalog geometry through the app's thumbnail renderer. These are example furniture, not customers or testimonials.

```bash
npm run lint && npm run typecheck && npm test && npm run build
node scripts/brand/verify.mjs
npm run preview
```

Check desktop and narrow screens, keyboard focus, reduced motion, direct loads, refreshes, example links and downloads. To check the published version after deployment:

```bash
node scripts/brand/verify.mjs --live
```

For a server-free visual snapshot of the same page code, run `node scripts/brand/preview.mjs /tmp/knotty-brand-preview` and open the generated HTML. Fonts and images are embedded; downloads sit alongside it. App links point to the public app. This snapshot does not verify hosting or offline behavior.

## Maintain

- Edit [knot.svg](../src/ui/system/knot.svg) for the canonical drawing. [Brand.tsx](../src/ui/system/Brand.tsx) and [the vector exporter](../scripts/brand/export.mjs) share it. Preserve the two pieces, line weight, clear space and maskable safe area; inspect at small icon sizes.
- Edit [tokens.css](../src/ui/system/tokens.css) for colors, fonts, spacing, shape and motion. The guide reads the actual CSS properties. `drawing-surface` is shared by app and presentation cards. The explicit light override remains available for future paper contexts; the interface does not follow the device theme.
- Regenerate exports with [the brand script](../scripts/brand/README.md) after a mark, token, font or social-card change. Commit the public assets with their sources. The export uses existing font outlines and native SVG; it needs no browser. [ASSETS.md](../scripts/brand/ASSETS.md) becomes the kit's README.
- Keep public product copy in es-MX. State outcomes before expert setup: catalog bases work without an LLM, Claude and OpenAI need a key, and SheLLM's key is optional. Prices are estimates; a generated design needs review before buying or cutting.

## Hosting and PWA invariants

The existing [Pages workflow](../.github/workflows/deploy.yml) builds all three HTML entries. Relative asset paths preserve the repository base URL. The root entry and manifest identity, start URL and scope remain the application. Presentation pages neither register another worker nor advertise a separate install destination.

The [service worker](../public/sw.js) caches navigation by document path. App queries and `index.html` share the app document; presentation and guide keep separate entries. Failed responses cannot replace a cached page. An unvisited page returns an offline message. [Regression tests](../src/pwa.test.ts) cover this isolation. In a browser, visit the app online, visit both new pages, then verify the app still opens offline.
