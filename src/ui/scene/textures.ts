import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three'
import type { BoardTone } from '../../domain/materials/grades'

// Textures generated in the browser: pine grain for the faces and plywood plies for the edges. Nothing to download.

export type TextureKind = 'grain-u' | 'grain-v' | 'plies-u' | 'plies-v' | 'sketch'

const SIZE = 512
/** The colors of each tone the grades name, and the seed that draws its grain. */
const TONES: Record<BoardTone, { seed: number; base: string; grain: string; lightLayer: string; darkLayer: string }> = {
  pine: { seed: 7, base: '#dcb680', grain: '#b98752', lightLayer: '#ecd6b0', darkLayer: '#c3955d' },
  'pale-pine': { seed: 13, base: '#e3c9a0', grain: '#c49a68', lightLayer: '#f0dcbc', darkLayer: '#caa272' },
}

function random(seed: number) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}

function grain(ctx: CanvasRenderingContext2D, tone: BoardTone) {
  const t = TONES[tone]
  const r = random(t.seed)
  ctx.fillStyle = t.base
  ctx.fillRect(0, 0, SIZE, SIZE)
  for (let i = 0; i < 70; i++) {
    const y0 = r() * SIZE
    const amplitude = 2 + r() * 10
    const frequency = 0.004 + r() * 0.01
    const phase = r() * Math.PI * 2
    ctx.strokeStyle = t.grain
    ctx.globalAlpha = 0.08 + r() * 0.22
    ctx.lineWidth = 0.6 + r() * 2.4
    ctx.beginPath()
    for (let x = 0; x <= SIZE; x += 8) {
      const y = y0 + Math.sin(x * frequency + phase) * amplitude + Math.sin(x * frequency * 3.1) * amplitude * 0.25
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  ctx.globalAlpha = 0.05
  for (let i = 0; i < 1800; i++) {
    ctx.fillStyle = r() > 0.5 ? '#ffffff' : t.grain
    ctx.fillRect(r() * SIZE, r() * SIZE, 1 + r() * 3, 1)
  }
  ctx.globalAlpha = 1
}

function layers(ctx: CanvasRenderingContext2D, tone: BoardTone, plies: number) {
  const t = TONES[tone]
  const height = SIZE / plies
  for (let i = 0; i < plies; i++) {
    ctx.fillStyle = i % 2 ? t.darkLayer : t.lightLayer
    ctx.fillRect(0, i * height, SIZE, height)
    ctx.fillStyle = 'rgba(80, 55, 30, 0.35)'
    ctx.fillRect(0, i * height, SIZE, 2)
  }
}

/** Paper with pencil hatching: the piece the expert could not confirm. */
function sketch(ctx: CanvasRenderingContext2D) {
  const r = random(29)
  ctx.fillStyle = '#f4ede1'
  ctx.fillRect(0, 0, SIZE, SIZE)
  ctx.strokeStyle = '#5e574f'
  ctx.lineCap = 'round'
  for (let i = -SIZE; i < SIZE * 2; i += 22) {
    ctx.globalAlpha = 0.25 + r() * 0.2
    ctx.lineWidth = 1.2 + r() * 1.2
    ctx.beginPath()
    ctx.moveTo(i + r() * 4, SIZE + r() * 4)
    ctx.lineTo(i + SIZE + r() * 6, r() * 4)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

const cache = new Map<string, Texture>()

export function texture(kind: TextureKind, tone: BoardTone, plies: number): Texture {
  const key = `${kind}|${tone}|${plies}`
  const taken = cache.get(key)
  if (taken) return taken
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE
  const ctx = canvas.getContext('2d')!
  const transposed = kind === 'grain-v' || kind === 'plies-u'
  if (transposed) {
    ctx.translate(SIZE, 0)
    ctx.rotate(Math.PI / 2)
  }
  if (kind === 'sketch') sketch(ctx)
  else if (kind === 'grain-u' || kind === 'grain-v') grain(ctx, tone)
  else layers(ctx, tone, plies)
  const t = new CanvasTexture(canvas)
  t.colorSpace = SRGBColorSpace
  t.wrapS = t.wrapT = RepeatWrapping
  t.anisotropy = 4
  cache.set(key, t)
  return t
}
