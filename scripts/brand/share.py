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
    return re.search(r'--' + name + r':\s*(#[\da-f]+)', TOKENS).group(1)


def font(family, file, axes):
    source = ROOT / 'node_modules/@fontsource-variable' / family / 'files' / file
    return instantiateVariableFont(TTFont(source), axes, inplace=True)


display = font('fraunces', 'fraunces-latin-full-normal.woff2', {'wght': 600, 'opsz': 72})
sans = font('inter', 'inter-latin-wght-normal.woff2', {'wght': 400})
mono = font('jetbrains-mono', 'jetbrains-mono-latin-wght-normal.woff2', {'wght': 400})


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


paper, ink, pine = color('color-brand-paper'), color('bone'), color('color-pine')
mark = (ROOT / 'src/ui/system/knot.svg').read_text()
drawing = re.search(r'<g[\s\S]*</g>', mark).group(0)
stroke = re.search(r'stroke-width="([^"]+)"', mark).group(1)
image = base64.b64encode((ROOT / 'design/assets/studio/scene/desktop-aparador.jpg').read_bytes()).decode()
body = [f'<rect width="1200" height="630" fill="{ink}"/>',
        '<defs><clipPath id="scene"><rect x="650" y="40" width="510" height="550" rx="24"/></clipPath></defs>',
        f'<image href="data:image/jpeg;base64,{image}" x="650" y="40" width="510" height="550" preserveAspectRatio="xMidYMid slice" clip-path="url(#scene)"/>',
        f'<g transform="translate(44 58) scale(.85)" fill="none" stroke="{paper}" stroke-width="{stroke}" stroke-linecap="round">{drawing}</g>',
        text('Knotty', display, 64, 112, 108, paper),
        text('Ese rincón ya tiene', display, 49, 48, 265, paper),
        text('su próximo mueble.', display, 49, 48, 328, pine),
        text('Elige una base. Ajústala a tus medidas.', sans, 21, 48, 397, paper),
        text('Mira cómo se arma y llévate la lista', sans, 21, 48, 431, paper),
        text('al taller.', sans, 21, 48, 465, paper),
        f'<rect x="48" y="498" width="322" height="54" rx="12" fill="{pine}"/>',
        text('Muebles de triplay a tu medida', sans, 17, 67, 532, ink),
        text('HECHOS POR TI · rodacato.github.io/knotty', mono, 12, 48, 592, paper)]
Path(sys.argv[1]).write_text('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">' + ''.join(body) + '</svg>')
