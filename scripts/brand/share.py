"""Export a native SVG social card with outlines from Knotty's existing fonts."""
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


paper, ink, action, on_action = color('bone'), color('graphite'), color('action'), color('color-on-action')
mark = (ROOT / 'src/ui/system/knot.svg').read_text()
plate, plank = (re.search(r'class="' + name + r'"[^>]*\sd="([^"]+)"', mark).group(1) for name in ('plate', 'ink'))
image = base64.b64encode((ROOT / 'design/assets/studio/scene/desktop-aparador.jpg').read_bytes()).decode()
# Two inks on straw paper, like the cut ticket: a black band, black type, one vermilion block.
body = [f'<rect width="1200" height="630" fill="{paper}"/>',
        f'<rect width="1200" height="96" fill="{ink}"/>',
        f'<g transform="translate(36 18) scale(.2034)" fill-rule="evenodd"><path fill="{action}" d="{plate}"/><path fill="{paper}" d="{plank}"/></g>',
        text('Knotty', display, 58, 192, 70, paper),
        '<defs><clipPath id="scene"><rect x="650" y="130" width="510" height="460"/></clipPath></defs>',
        f'<image href="data:image/jpeg;base64,{image}" x="650" y="130" width="510" height="460" preserveAspectRatio="xMidYMid slice" clip-path="url(#scene)"/>',
        f'<rect x="650" y="130" width="510" height="460" fill="none" stroke="{ink}" stroke-width="3"/>',
        f'<rect x="48" y="146" width="560" height="3" fill="{ink}"/>',
        text('Ese rincón ya tiene', display, 58, 48, 232, ink),
        text('su próximo mueble.', display, 58, 48, 300, ink),
        text('Elige una base. Ajústala a tus medidas.', sans, 21, 48, 366, ink),
        text('Mira cómo se arma y llévate la lista', sans, 21, 48, 398, ink),
        text('al taller.', sans, 21, 48, 430, ink),
        f'<rect x="48" y="468" width="360" height="58" fill="{action}" stroke="{ink}" stroke-width="3"/>',
        text('Muebles de triplay a tu medida', display, 26, 68, 506, on_action),
        text('HECHOS POR TI · rodacato.github.io/knotty', mono, 13, 48, 580, ink)]
Path(sys.argv[1]).write_text('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">' + ''.join(body) + '</svg>')
