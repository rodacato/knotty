#!/usr/bin/env bash
# Builds the icons, the favicon and the share image from the SVGs in this folder.
# Needs rsvg-convert (brew install librsvg) and Google Chrome.
set -euo pipefail
cd "$(dirname "$0")"
PUBLIC=../../public
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"

cp knot-favicon.svg "$PUBLIC/favicon.svg"
rsvg-convert -w 192 -h 192 knot.svg -o "$PUBLIC/icon-192.png"
rsvg-convert -w 512 -h 512 knot.svg -o "$PUBLIC/icon-512.png"
rsvg-convert -w 192 -h 192 knot-maskable.svg -o "$PUBLIC/icon-maskable-192.png"
rsvg-convert -w 512 -h 512 knot-maskable.svg -o "$PUBLIC/icon-maskable-512.png"
rsvg-convert -w 180 -h 180 knot-maskable.svg -o "$PUBLIC/apple-touch-icon.png"

TMP=$(mktemp -d)
for n in 16 32 48; do rsvg-convert -w $n -h $n knot-favicon.svg -o "$TMP/$n.png"; done
python3 ico.py "$PUBLIC/favicon.ico" "$TMP/16.png" "$TMP/32.png" "$TMP/48.png"

"$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size=1200,630 --virtual-time-budget=3000 \
  --screenshot="$PUBLIC/share.png" "file://$PWD/share.html" 2>/dev/null
rm -rf "$TMP"
echo "Listo: íconos, favicon.ico y share.png en public/"
