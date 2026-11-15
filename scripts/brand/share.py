"""Export a native SVG social card with outlines from Knotty's existing fonts.

Usage: share.py <out.svg> [og|github]. `og` (the default) is the 1200 × 630 Open Graph card; `github` is the
1280 × 640 repository social preview. Both draw the same 1280 × 640 plate; the Open Graph one extends the paper
above and below so nothing is stretched.
"""
import base64
import re
import sys
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parents[2]
TOKENS = (ROOT / 'src/ui/system/tokens.css').read_text()
SIZES = {'og': (1200, 630), 'github': (1280, 640)}
W, H = 1280, 640


def color(name):
    return re.search(r'--' + name + r':\s*(#[\da-fA-F]+)', TOKENS).group(1)


def font(package, file, axes=None):
    face = TTFont(ROOT / 'node_modules' / package / 'files' / file)
    return instantiateVariableFont(face, axes, inplace=True) if axes else face


display = font('@fontsource-variable/oswald', 'oswald-latin-wght-normal.woff2', {'wght': 600})
sans = font('@fontsource-variable/libre-franklin', 'libre-franklin-latin-wght-normal.woff2', {'wght': 400})
mono = font('@fontsource/ibm-plex-mono', 'ibm-plex-mono-latin-500-normal.woff2')


def text(value, face, size, x, y, fill):
    glyphs = face.getGlyphSet()
    mapping = face.getBestCmap()
    scale = size / face['head'].unitsPerEm
    pen = SVGPathPen(glyphs)
    offset = x
    for char in value:
        glyph = glyphs[mapping[ord(char)]]
        glyph.draw(TransformPen(pen, (scale, 0, 0, -scale, offset, y)))
        offset += glyph.width * scale
    return f'<path d="{pen.getCommands()}" fill="{fill}"/>'


def rule(x, y, w, h, fill):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{fill}"/>'


paper, ink, action = color('bone'), color('graphite'), color('action')
mark = (ROOT / 'src/ui/system/knot.svg').read_text()
plate, plank = (re.search(r'class="' + name + r'"[^>]*\sd="([^"]+)"', mark).group(1) for name in ('plate', 'ink'))
# The sideboard as the Studio draws it, with its own dimension lines in ink (UI-93).
image = base64.b64encode((ROOT / 'design/assets/studio/scene/share-aparador.jpg').read_bytes()).decode()
scene = (686, 112, 554, 426)  # x, y, width, height: the capture's 1020 × 784 at the same proportion

# A plate from a lumber-yard brochure in two inks (north star, site): the headline on the left, the furniture as
# plate 01 on the right with its ruled caption. Vermilion appears once, under the plate number; there is no button.
body = [
    rule(0, -40, W, H + 80, paper),
    rule(0, -40, W, 136, ink),
    f'<g transform="translate(40 18) scale(.2034)" fill-rule="evenodd"><path fill="{action}" d="{plate}"/><path fill="{paper}" d="{plank}"/></g>',
    text('Knotty', display, 58, 196, 72, paper),
    text('Muebles de triplay · Hechos por ti', mono, 20, 56, 150, ink),
    rule(56, 168, 580, 4, ink),
    text('Ese rincón ya tiene', display, 66, 56, 254, ink),
    text('su próximo mueble.', display, 66, 56, 328, ink),
    text('Elige una base, ajústala a tus medidas', sans, 25, 56, 398, ink),
    text('y llévate la lista al taller.', sans, 25, 56, 434, ink),
    rule(56, 548, 580, 2, ink),
    text('rodacato.github.io/knotty', mono, 24, 56, 598, ink),
    rule(660, 112, 4, 500, ink),
    '<defs><clipPath id="scene"><rect x="{}" y="{}" width="{}" height="{}"/></clipPath></defs>'.format(*scene),
    '<image href="data:image/jpeg;base64,{}" x="{}" y="{}" width="{}" height="{}" preserveAspectRatio="xMidYMid slice" clip-path="url(#scene)"/>'.format(image, *scene),
    rule(686, 552, 554, 4, ink),
    text('Lám. 01', mono, 20, 692, 592, ink),
    rule(692, 600, 82, 4, action),
    rule(792, 564, 2, 40, ink),
    text('Aparador con patas', display, 32, 808, 596, ink),
    rule(1086, 564, 2, 40, ink),
    text('KC-APA-01', mono, 20, 1102, 592, ink),
    rule(686, 612, 554, 2, ink),
]

w, h = SIZES[sys.argv[2] if len(sys.argv) > 2 else 'og']
# The Open Graph card is a touch taller than 2:1: the same plate, with more paper above and below.
view_h = W * h / w
view = f'0 {(H - view_h) / 2:.2f} {W} {view_h:.2f}'
Path(sys.argv[1]).write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="{view}">' + ''.join(body) + '</svg>')
