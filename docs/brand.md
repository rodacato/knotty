# Knotty brand and presentation

The approved assembly mark uses two opposing pieces drawn in two strokes. It keeps the wood identity while making the symbol easy to remember. The default theme is a dark workshop, with warm paper for the 3D stage, catalog thumbnails, illustrated choices, joint and edge diagrams, and sheet layouts. Their grid is decorative, not a measurement scale. Fraunces, Inter and JetBrains Mono are the existing local variable fonts.

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
# Download the github-pages artifact from the successful deploy run for this commit.
gh run download <run-id> --name github-pages --dir <artifact-dir>
mkdir <build-dir>
tar -xf <artifact-dir>/artifact.tar -C <build-dir>
node scripts/brand/verify.mjs --live --dist <build-dir>
```

Use the CI artifact for byte comparison: macOS and Linux builds can produce different hashed chunk filenames. The verifier checks its exports against the checked-out canonical sources before comparing the published pages.

For a server-free visual snapshot of the same page code, run `node scripts/brand/preview.mjs` and open the generated HTML at the printed path. Each run creates a private temporary directory. An optional output directory must not already exist. Fonts and images are embedded; downloads sit alongside them. App links point to the public app. This snapshot does not verify hosting or offline behavior.

## Maintain

- Edit [knot.svg](../src/ui/system/knot.svg) for the canonical drawing. [Brand.tsx](../src/ui/system/Brand.tsx) and [the vector exporter](../scripts/brand/export.mjs) share it. Preserve the two pieces, line weight, clear space and maskable safe area; inspect at small icon sizes.
- Edit [tokens.css](../src/ui/system/tokens.css) for colors, fonts, spacing, shape and motion. The guide reads the actual CSS properties. `drawing-sheet` supplies the fixed paper palette; `drawing-surface` adds the decorative grid for app and presentation thumbnails. Scene lighting and labels stay light independently of the interface. The explicit light override remains available for future paper contexts; the interface does not follow the device theme.
- Regenerate exports with [the brand script](../scripts/brand/README.md) after a mark, token, font or social-card change. Commit the public assets with their sources. The export uses existing font outlines and native SVG; it needs no browser. [ASSETS.md](../scripts/brand/ASSETS.md) becomes the kit's README.
- Keep public product copy in es-MX. State outcomes before expert setup: catalog bases work without an LLM, Claude and OpenAI need a key, and SheLLM's key is optional. Prices are estimates; a generated design needs review before buying or cutting.

## Hosting and PWA invariants

The existing [Pages workflow](../.github/workflows/deploy.yml) builds all three HTML entries. Relative asset paths preserve the repository base URL. The root entry and manifest identity, start URL and scope remain the application. Presentation pages neither register another worker nor advertise a separate install destination.

The [service worker](../public/sw.js) caches navigation by document path. App queries and `index.html` share the app document; presentation and guide keep separate entries. Brand downloads refresh from the network online and use the last successful export offline. Failed responses cannot replace a cached page or kit. An unvisited page returns an offline message. [Regression tests](../src/pwa.test.ts) cover document isolation and kit refresh. In a browser, visit the app online, visit both new pages, then verify the app still opens offline.
