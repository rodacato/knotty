export interface ReducedImage {
  /** JPEG in base64, ~1500 px on the long side, for the model. */
  base64: string
  /** A small data URL to show and save. */
  thumbnail: string
}

export interface ImageProcessor {
  reduce(file: Blob): Promise<ReducedImage>
}
