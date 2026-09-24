#!/usr/bin/env bash
# Genera los íconos, el favicon y la imagen para compartir a partir de los SVG de esta carpeta.
# Requiere rsvg-convert (brew install librsvg) y Google Chrome.
set -euo pipefail
cd "$(dirname "$0")"
PUBLICO=../../public
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"

cp nudo-favicon.svg "$PUBLICO/favicon.svg"
rsvg-convert -w 192 -h 192 nudo.svg -o "$PUBLICO/icono-192.png"
rsvg-convert -w 512 -h 512 nudo.svg -o "$PUBLICO/icono-512.png"
rsvg-convert -w 192 -h 192 nudo-enmascarable.svg -o "$PUBLICO/icono-enmascarable-192.png"
rsvg-convert -w 512 -h 512 nudo-enmascarable.svg -o "$PUBLICO/icono-enmascarable-512.png"
rsvg-convert -w 180 -h 180 nudo-enmascarable.svg -o "$PUBLICO/apple-touch-icon.png"

TMP=$(mktemp -d)
for n in 16 32 48; do rsvg-convert -w $n -h $n nudo-favicon.svg -o "$TMP/$n.png"; done
python3 ico.py "$PUBLICO/favicon.ico" "$TMP/16.png" "$TMP/32.png" "$TMP/48.png"

"$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size=1200,630 --virtual-time-budget=3000 \
  --screenshot="$PUBLICO/compartir.png" "file://$PWD/compartir.html" 2>/dev/null
rm -rf "$TMP"
echo "Listo: íconos, favicon.ico y compartir.png en public/"
