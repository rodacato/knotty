# Knotty brand and presentation

The approved assembly mark uses two opposing pieces drawn in two strokes. It keeps the wood identity while making the symbol easy to remember. The default theme is a dark workshop, with warm paper for the 3D stage, catalog thumbnails, illustrated choices, joint and edge diagrams, and sheet layouts. Their grid is decorative, not a measurement scale. Fraunces, Inter and JetBrains Mono are the existing local variable fonts.

## Preview and verify

```bash
npm ci
npm run dev
```

The presentation is the root landing; the catalog and studio live at `/catalog/`, and the guide at `/marca/`. `/presentacion/` only redirects to the root, retaining previous section links. Under GitHub Pages, these routes live below the repository path. The [presentation](../src/ui/presentation/Presentation.tsx) uses an existing aparador scene, a materials capture focused on the cut list, and actual catalog geometry. These are example furniture, not customers or testimonials.

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

The existing [Pages workflow](../.github/workflows/deploy.yml) builds all HTML entries. Relative asset paths preserve the repository base URL. The [manifest](../public/manifest.webmanifest) keeps its identity and scope at the root, and launches the saved studio inside the catalog. Root and catalog register the same worker. Existing stored designs and preferences keep their storage keys; opening the catalog provides a way to resume the saved design.

The [service worker](../public/sw.js) caches navigation by document path, normalizing directory `index.html` requests. Landing and catalog cannot overwrite each other. Current documents take precedence over the old root-app cache; older hashed assets remain usable during an upgrade. Brand downloads refresh online and keep the last good export offline. Failed responses cannot replace a cached page or kit. [Regression tests](../src/pwa.test.ts) cover document isolation, upgrades and kit refresh. Visit the catalog online before testing its offline startup: opening the landing alone does not load the studio's lazy assets.

New app paths and fragments use English, while product copy stays in es-MX. Existing published presentation/guide paths and ficha/filter query names stay compatible. Main views include `#catalog`, `#catalog/adjust/<code>`, `#studio`, `#studio/materials`, `#studio/edit/outside`, `#design` and `#takeaway`.

The [fragment reader](../src/ui/navigation/routes.ts) names the active view, while [navigation](../src/ui/navigation/navigation.ts) restores it through the existing UI commands. Back and Forward change views, not design versions. A missing design falls back to the catalog; an unknown adjustment cannot create one. Leaving unapplied plan edits invokes the editor's existing decision, and a new capture asks before losing its text or photos. A running expert request stays on its current view. Fragments do not serialize the design or restore unsaved form values after a reload.

Old root links with ficha options or catalog filters redirect to the catalog with their query and fragment intact. Old installed icons that still launch the root redirect to the saved studio. Keep this compatibility in [routes.test.ts](../src/ui/navigation/routes.test.ts) when changing entry points.
