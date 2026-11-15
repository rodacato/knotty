import { useEffect, useMemo, useState } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'

// A label drawn on a canvas: the same size on screen at any distance, with no DOM inside the scene.

type Point = [number, number, number]

/** `tag`: a solid ink block in the display face, the name of the part being edited. `cota`: a dimension printed in ink on a paper patch, no pill (UI-93). */
export function Label({ text, position, dark, height = 0.021, strong = false, tag = false, cota = false }: { text: string; position: Point; dark: boolean; height?: number; strong?: boolean; tag?: boolean; cota?: boolean }) {
  const [fontsReady, setFontsReady] = useState(false)
  useEffect(() => void document.fonts.ready.then(() => setFontsReady(true)), [])
  const { map, ratio } = useMemo(() => {
    const scale = 3
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    const font = tag || cota ? `600 ${(tag ? 17 : 15) * scale}px "Oswald Variable", "Arial Narrow", sans-serif` : `${strong ? 600 : 500} ${13 * scale}px "IBM Plex Mono", ui-monospace, monospace`
    ctx.font = font
    const width = ctx.measureText(text).width + 22 * scale
    const tall = 24 * scale
    canvas.width = width
    canvas.height = tall
    ctx.font = font
    ctx.fillStyle = tag ? '#161412' : cota ? 'rgba(246, 239, 220, 0.92)' : dark ? 'rgba(39, 35, 31, 0.94)' : 'rgba(245, 240, 232, 0.94)'
    ctx.strokeStyle = dark ? 'rgba(239, 231, 218, 0.18)' : 'rgba(43, 40, 37, 0.14)'
    ctx.lineWidth = scale
    ctx.beginPath()
    if (tag || cota) ctx.rect(0, 0, width, tall)
    else ctx.roundRect(scale, scale, width - 2 * scale, tall - 2 * scale, tall / 2)
    ctx.fill()
    if (!tag && !cota) ctx.stroke()
    ctx.fillStyle = tag ? '#f6efdc' : cota ? '#161412' : dark ? '#d8cdbd' : '#5e574f'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, width / 2, tall / 2 + scale)
    const map = new CanvasTexture(canvas)
    map.colorSpace = SRGBColorSpace
    return { map, ratio: width / tall, fontsReady }
  }, [text, fontsReady, dark, strong, tag, cota])
  useEffect(() => () => map.dispose(), [map])
  return (
    <sprite position={position} scale={[height * ratio, height, 1]} renderOrder={10}>
      <spriteMaterial map={map} sizeAttenuation={false} depthTest={false} transparent />
    </sprite>
  )
}
