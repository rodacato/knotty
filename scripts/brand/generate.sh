#!/usr/bin/env bash
# Builds the icons, the favicon and the share image from the SVGs in this folder.
# Needs rsvg-convert and Python with requirements.txt installed.
set -euo pipefail
cd "$(dirname "$0")"
PUBLIC=../../public
BRAND_PYTHON="${BRAND_PYTHON:-python3}"

node export.mjs

cp knot-favicon.svg "$PUBLIC/favicon.svg"
rsvg-convert -w 192 -h 192 knot.svg -o "$PUBLIC/icon-192.png"
rsvg-convert -w 512 -h 512 knot.svg -o "$PUBLIC/icon-512.png"
rsvg-convert -w 192 -h 192 knot-maskable.svg -o "$PUBLIC/icon-maskable-192.png"
rsvg-convert -w 512 -h 512 knot-maskable.svg -o "$PUBLIC/icon-maskable-512.png"
rsvg-convert -w 180 -h 180 knot-maskable.svg -o "$PUBLIC/apple-touch-icon.png"

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
for n in 16 32 48; do rsvg-convert -w $n -h $n knot-favicon.svg -o "$TMP/$n.png"; done
"$BRAND_PYTHON" ico.py "$PUBLIC/favicon.ico" "$TMP/16.png" "$TMP/32.png" "$TMP/48.png"

"$BRAND_PYTHON" share.py "$TMP/share.svg"
rsvg-convert "$TMP/share.svg" -o "$PUBLIC/share.png"
cp "$PUBLIC/icon-512.png" "$PUBLIC/brand/knotty-icon.png"
cp ASSETS.md "$PUBLIC/brand/README.md"
"$BRAND_PYTHON" - "$PUBLIC/brand" <<'PY'
import pathlib, sys, zipfile
folder = pathlib.Path(sys.argv[1])
with zipfile.ZipFile(folder / 'knotty-brand-kit.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(folder.iterdir()):
        if path.suffix != '.zip':
            entry = zipfile.ZipInfo('knotty-brand-kit/' + path.name)
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.external_attr = 0o644 << 16
            archive.writestr(entry, path.read_bytes())
PY
echo "Done: icons, favicon.ico and share.png in public/"
