"""Packs PNGs into an .ico (the format takes embedded PNGs since Windows Vista)."""
import struct
import sys

target, *pngs = sys.argv[1:]
images = [open(p, 'rb').read() for p in pngs]
header = struct.pack('<HHH', 0, 1, len(images))
offset = 6 + 16 * len(images)
entries = b''
for image in images:
    side = struct.unpack('>I', image[16:20])[0]
    entries += struct.pack('<BBBBHHII', side % 256, side % 256, 0, 0, 1, 32, len(image), offset)
    offset += len(image)
open(target, 'wb').write(header + entries + b''.join(images))
