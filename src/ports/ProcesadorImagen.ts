export interface ImagenReducida {
  /** JPEG en base64, ~1500 px de lado largo, para el LLM. */
  base64: string
  /** Data URL pequeña para mostrar y guardar. */
  miniatura: string
}

export interface ProcesadorImagen {
  reducir(archivo: Blob): Promise<ImagenReducida>
}
