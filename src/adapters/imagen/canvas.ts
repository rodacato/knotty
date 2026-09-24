import type { ImagenReducida, ProcesadorImagen } from '../../ports/ProcesadorImagen'

const LADO_LARGO = 1500
const LADO_MINIATURA = 160

async function dibujar(imagen: ImageBitmap, ladoLargo: number, calidad: number) {
  const escala = Math.min(1, ladoLargo / Math.max(imagen.width, imagen.height))
  const lienzo = document.createElement('canvas')
  lienzo.width = Math.round(imagen.width * escala)
  lienzo.height = Math.round(imagen.height * escala)
  lienzo.getContext('2d')!.drawImage(imagen, 0, 0, lienzo.width, lienzo.height)
  return lienzo.toDataURL('image/jpeg', calidad)
}

export function crearProcesadorCanvas(): ProcesadorImagen {
  return {
    async reducir(archivo): Promise<ImagenReducida> {
      const imagen = await createImageBitmap(archivo, { imageOrientation: 'from-image' })
      try {
        const grande = await dibujar(imagen, LADO_LARGO, 0.85)
        return { base64: grande.slice(grande.indexOf(',') + 1), miniatura: await dibujar(imagen, LADO_MINIATURA, 0.6) }
      } finally {
        imagen.close()
      }
    },
  }
}
