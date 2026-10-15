# Brand exports

The [canonical mark](../../src/ui/system/knot.svg) and [UI tokens](../../src/ui/system/tokens.css) generate the app icons and downloadable kit. Brand sources and the asset map: [design/brand/](../../design/brand/README.md). Preview and hosting invariants: [docs/brand.md](../../docs/brand.md).

## Regenerate

Use Node, `rsvg-convert` (on macOS, `brew install librsvg`) and Python 3.11 or later. Install the export dependency in an isolated environment:

```bash
python3 -m venv /tmp/knotty-brand-env
/tmp/knotty-brand-env/bin/python -m pip install -r scripts/brand/requirements.txt
BRAND_PYTHON=/tmp/knotty-brand-env/bin/python ./scripts/brand/generate.sh
```

[generate.sh](generate.sh) exports the SVG variants and existing Fontsource files with their licenses, rasterizes regular and maskable icons, packs the favicon, and assembles the served kit in `public/brand/` with its reproducible downloadable ZIP. The kit's README, brand guidelines and marketing copy come from [design/brand/](../../design/brand/README.md). Run after changing the mark, tokens or fonts, and commit generated assets with their sources.

`npm run brand:kit` ([kit.mjs](kit.mjs)) only gathers current public exports, product examples and the kit documents into `public/brand/` and rebuilds the ZIP. It needs Node and Python's standard library; it does not rerasterize artwork. [kit-files.mjs](kit-files.mjs) declares each kit file's source. `node scripts/brand/verify-kit.mjs` checks source equality, portable document links and every archived byte. `npm run brand:preview` exports server-free snapshots of the actual landing and guide to a private temporary directory.

[share.py](share.py) makes the social card from the same mark, tokens, Fraunces/Inter/JetBrains Mono outlines and an existing product capture. The temporary SVG is rasterized with librsvg. FontTools is used only for export; no frontend dependency or font service is added.

Inspect the exported icon at small sizes and the social card by eye. Run the project checks and `node scripts/brand/verify.mjs` before publication.
