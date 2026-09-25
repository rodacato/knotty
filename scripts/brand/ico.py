"""Empaca PNGs en un .ico (el formato admite PNG embebido desde Windows Vista)."""
import struct
import sys

destino, *pngs = sys.argv[1:]
datos = [open(p, 'rb').read() for p in pngs]
cabecera = struct.pack('<HHH', 0, 1, len(datos))
desplazamiento = 6 + 16 * len(datos)
entradas = b''
for d in datos:
    lado = struct.unpack('>I', d[16:20])[0]
    entradas += struct.pack('<BBBBHHII', lado % 256, lado % 256, 0, 0, 1, 32, len(d), desplazamiento)
    desplazamiento += len(d)
open(destino, 'wb').write(cabecera + entradas + b''.join(datos))
