import type { ImagenReducida, ProcesadorImagen } from '../../ports/ProcesadorImagen'

/** Claude reduce todo lo que pase de 1568 px por lado: mandar más solo gasta. */
export const LADO_LARGO = 1568
const LADO_MINIATURA = 160
/** SheLLM rechaza imágenes de más de 5 MiB decodificados; se deja margen. */
export const MAXIMO_BYTES = 4.5 * 1024 * 1024
const CALIDADES = [0.85, 0.75, 0.65, 0.55]

/** Medidas para que el lado largo no pase del límite, sin agrandar nunca la foto. */
export function dimensionesReducidas(ancho: number, alto: number, ladoLargo: number) {
  const escala = Math.min(1, ladoLargo / Math.max(ancho, alto))
  return { ancho: Math.max(1, Math.round(ancho * escala)), alto: Math.max(1, Math.round(alto * escala)) }
}

/** Bytes reales de un base64, sin el relleno. */
export const bytesDeBase64 = (b64: string) => Math.floor((b64.length * 3) / 4) - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0)

function dibujar(imagen: ImageBitmap, ladoLargo: number, calidad: number) {
  const { ancho, alto } = dimensionesReducidas(imagen.width, imagen.height, ladoLargo)
  const lienzo = document.createElement('canvas')
  lienzo.width = ancho
  lienzo.height = alto
  lienzo.getContext('2d')!.drawImage(imagen, 0, 0, ancho, alto)
  return lienzo.toDataURL('image/jpeg', calidad)
}

export function crearProcesadorCanvas(): ProcesadorImagen {
  return {
    async reducir(archivo): Promise<ImagenReducida> {
      const imagen = await createImageBitmap(archivo, { imageOrientation: 'from-image' })
      try {
        let base64 = ''
        for (const calidad of CALIDADES) {
          const url = dibujar(imagen, LADO_LARGO, calidad)
          base64 = url.slice(url.indexOf(',') + 1)
          if (bytesDeBase64(base64) <= MAXIMO_BYTES) break
        }
        return { base64, miniatura: dibujar(imagen, LADO_MINIATURA, 0.6) }
      } finally {
        imagen.close()
      }
    },
  }
}
