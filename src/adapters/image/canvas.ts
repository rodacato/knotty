import type { ReducedImage, ImageProcessor } from '../../ports/ImageProcessor'

/** Claude scales down anything past 1568 px a side: sending more only costs. */
export const LONG_SIDE = 1568
const THUMBNAIL_SIDE = 160
/** SheLLM rejects images over 5 MiB decoded; a margin is left. */
export const MAX_IMAGE_BYTES = 4.5 * 1024 * 1024
const QUALITIES = [0.85, 0.75, 0.65, 0.55]

/** Measures so the long side stays within the limit, never enlarging the photo. */
export function reducedDimensions(width: number, height: number, longSide: number) {
  const scale = Math.min(1, longSide / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

/** The real bytes of a base64 string, without the padding. */
export const bytesFromBase64 = (b64: string) => Math.floor((b64.length * 3) / 4) - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0)

function draw(image: ImageBitmap, longSide: number, quality: number) {
  const { width, height } = reducedDimensions(image.width, image.height, longSide)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')!.drawImage(image, 0, 0, width, height)
  return canvas.toDataURL('image/jpeg', quality)
}

export function createCanvasProcessor(): ImageProcessor {
  return {
    async reduce(file): Promise<ReducedImage> {
      const image = await createImageBitmap(file, { imageOrientation: 'from-image' })
      try {
        let base64 = ''
        for (const quality of QUALITIES) {
          const url = draw(image, LONG_SIDE, quality)
          base64 = url.slice(url.indexOf(',') + 1)
          if (bytesFromBase64(base64) <= MAX_IMAGE_BYTES) break
        }
        return { base64, thumbnail: draw(image, THUMBNAIL_SIDE, 0.6) }
      } finally {
        image.close()
      }
    },
  }
}
