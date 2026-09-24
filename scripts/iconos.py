"""Genera los íconos PNG de la PWA a partir de las formas del favicon (public/favicon.svg), sin dependencias."""
import struct
import zlib
from pathlib import Path

FONDO = (0x2B, 0x28, 0x25)
# (x, y, ancho, alto, color) en la cuadrícula de 32 del favicon.
FORMAS = [
    (7, 6, 4, 20, (0xD9, 0xB2, 0x7C)),
    (21, 6, 4, 20, (0xD9, 0xB2, 0x7C)),
    (11, 6, 10, 3, (0xE2, 0xC9, 0xA2)),
    (11, 15, 10, 3, (0xD9, 0x8A, 0x2B)),
    (11, 23, 10, 3, (0xE2, 0xC9, 0xA2)),
]


def pixel(u: float, v: float):
    for x, y, w, h, color in FORMAS:
        if x <= u < x + w and y <= v < y + h:
            return color
    return FONDO


def png(lado: int, margen: float) -> bytes:
    """Fondo completo (sirve como ícono enmascarable) y el dibujo centrado dentro de la zona segura."""
    util = lado * (1 - 2 * margen)
    filas = bytearray()
    for py in range(lado):
        filas.append(0)
        for px in range(lado):
            u = (px + 0.5 - lado * margen) / util * 32
            v = (py + 0.5 - lado * margen) / util * 32
            filas.extend(pixel(u, v) if 0 <= u < 32 and 0 <= v < 32 else FONDO)

    def bloque(tipo: bytes, datos: bytes) -> bytes:
        return struct.pack('>I', len(datos)) + tipo + datos + struct.pack('>I', zlib.crc32(tipo + datos) & 0xFFFFFFFF)

    cabecera = struct.pack('>IIBBBBB', lado, lado, 8, 2, 0, 0, 0)
    return b'\x89PNG\r\n\x1a\n' + bloque(b'IHDR', cabecera) + bloque(b'IDAT', zlib.compress(bytes(filas), 9)) + bloque(b'IEND', b'')


if __name__ == '__main__':
    destino = Path(__file__).resolve().parent.parent / 'public'
    for lado in (192, 512):
        (destino / f'icono-{lado}.png').write_bytes(png(lado, 0.14))
    (destino / 'apple-touch-icon.png').write_bytes(png(180, 0.14))
