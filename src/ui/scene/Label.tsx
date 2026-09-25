import { useEffect, useMemo, useState } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'

// A label drawn on a canvas: the same size on screen at any distance, with no DOM inside the scene.

type Point = [number, number, number]

export function Label({ text, position, dark, height = 0.021, strong = false }: { text: string; position: Point; dark: boolean; height?: number; strong?: boolean }) {
  const [fontsReady, setFontsReady] = useState(false)
  useEffect(() => void document.fonts.ready.then(() => setFontsReady(true)), [])
  const { map, ratio } = useMemo(() => {
    const scale = 3
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    const font = `${strong ? 600 : 500} ${13 * scale}px "JetBrains Mono Variable", ui-monospace, monospace`
    ctx.font = font
    const width = ctx.measureText(text).width + 22 * scale
    const tall = 24 * scale
    canvas.width = width
    canvas.height = tall
    ctx.font = font
    ctx.fillStyle = dark ? 'rgba(39, 35, 31, 0.94)' : 'rgba(245, 240, 232, 0.94)'
    ctx.strokeStyle = dark ? 'rgba(239, 231, 218, 0.18)' : 'rgba(43, 40, 37, 0.14)'
    ctx.lineWidth = scale
    ctx.beginPath()
    ctx.roundRect(scale, scale, width - 2 * scale, tall - 2 * scale, tall / 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = dark ? '#d8cdbd' : '#5e574f'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, width / 2, tall / 2 + scale)
    const map = new CanvasTexture(canvas)
    map.colorSpace = SRGBColorSpace
    return { map, ratio: width / tall, fontsReady }
  }, [text, fontsReady, dark, strong])
  useEffect(() => () => map.dispose(), [map])
  return (
    <sprite position={position} scale={[height * ratio, height, 1]} renderOrder={10}>
      <spriteMaterial map={map} sizeAttenuation={false} depthTest={false} transparent />
    </sprite>
  )
}
