# Brand

The brand's source SVGs and the script that builds from them what the app serves in `public/`.

## Use

```bash
./scripts/brand/generate.sh
```

It needs `rsvg-convert` (`brew install librsvg`), `python3` and Google Chrome. Chrome is looked for at its macOS path; set `CHROME` to the binary anywhere else. Run it after changing an SVG or `share.html`, and commit what it leaves in `public/`.

## What it writes

| In `public/` | From |
|---|---|
| `favicon.svg`, `favicon.ico` | `knot-favicon.svg` |
| `icon-192.png`, `icon-512.png` | `knot.svg` |
| `icon-maskable-192.png`, `icon-maskable-512.png`, `apple-touch-icon.png` | `knot-maskable.svg` |
| `share.png` | `share.html`, a screenshot taken with headless Chrome |

## Files

| File | What it is |
|---|---|
| `generate.sh` | The only entry point |
| `ico.py` | Packs the favicon's PNGs into one `.ico`; `generate.sh` calls it |
| `knot.svg` | The mark |
| `knot-favicon.svg` | The mark drawn for small sizes |
| `knot-maskable.svg` | The mark with the margin a maskable icon needs |
| `share.html` | The page the share image is a screenshot of |
| `stroke.svg` | The wood-grain strokes alone; nothing reads it |

Nothing here is tested or run in CI: the result is checked by eye.
