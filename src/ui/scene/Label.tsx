import { useEffect, useMemo, useState } from 'react'
import { INK, INK_2, PAPER } from './inks'
import { CanvasTexture, SRGBColorSpace } from 'three'

// A label drawn on a canvas: the same size on screen at any distance, with no DOM inside the scene.

type Point = [number, number, number]

/** `tag`: a solid ink block in the display face, the name of the part being edited. `cota`: a dimension printed in ink on a paper patch, no pill, in mono like every measure (UI-93). */
export function Label({ text, position, height = 0.021, strong = false, tag = false, cota = false }: { text: string; position: Point; height?: number; strong?: boolean; tag?: boolean; cota?: boolean }) {
  const [fontsReady, setFontsReady] = useState(false)
  useEffect(() => void document.fonts.ready.then(() => setFontsReady(true)), [])
  const { map, ratio } = useMemo(() => {
    const scale = 3
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    const font = tag
      ? `600 ${17 * scale}px "Oswald Variable", "Arial Narrow", sans-serif`
      : `${strong || cota ? 600 : 500} ${(cota ? 12 : 13) * scale}px "IBM Plex Mono", ui-monospace, monospace`
    ctx.font = font
    const width = ctx.measureText(text).width + 22 * scale
    const tall = 24 * scale
    canvas.width = width
    canvas.height = tall
    ctx.font = font
    ctx.fillStyle = tag ? INK : 'rgba(246, 239, 220, 0.92)'
    ctx.strokeStyle = INK
    ctx.lineWidth = 1.5 * scale
    ctx.beginPath()
    if (tag || cota) ctx.rect(0, 0, width, tall)
    else ctx.rect(scale, scale, width - 2 * scale, tall - 2 * scale)
    ctx.fill()
    if (!tag && !cota) ctx.stroke()
    ctx.fillStyle = tag ? PAPER : cota ? INK : INK_2
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, width / 2, tall / 2 + scale)
    const map = new CanvasTexture(canvas)
    map.colorSpace = SRGBColorSpace
    return { map, ratio: width / tall, fontsReady }
  }, [text, fontsReady, strong, tag, cota])
  useEffect(() => () => map.dispose(), [map])
  return (
    <sprite position={position} scale={[height * ratio, height, 1]} renderOrder={10}>
      {/* Not tone-mapped: the label is printed paper and ink, not a lit surface, and tone mapping greys the paper. */}
      <spriteMaterial map={map} sizeAttenuation={false} depthTest={false} transparent toneMapped={false} />
    </sprite>
  )
}
