import type { Dimensions } from '../../domain/design/schema'
import { angleLabel } from '../../domain/reading/reading'
import type { Repair } from '../../domain/repair/repair'
import type { Photo } from '../../ports/LLMProvider'

// What Knotty says in the chat, in its own voice, around what the expert answers.

export const EXPERT_FAILED = 'Algo falló al consultar al experto.'
export const CANCELLED = 'Cancelado.'

/** What the person asked for at the start, as the first chat message. */
export function initialRequest(input: { measures: Dimensions | null; photos: Photo[]; notes: string }) {
  const measures = input.measures ? `Mide ${input.measures.height} × ${input.measures.width} × ${input.measures.depth} mm (alto, ancho, fondo).` : 'No sé las medidas.'
  const photos = input.photos.length ? `Te mando ${input.photos.length === 1 ? 'una foto' : `${input.photos.length} fotos`} (${input.photos.map((f) => angleLabel(f.angle)).join(', ')}).` : ''
  const photoNotes = input.photos.filter((f) => f.note?.trim()).map((f) => `Sobre la foto ${angleLabel(f.angle)}: ${f.note!.trim()}`)
  return [input.notes.trim(), photos, ...photoNotes, measures].filter(Boolean).join('\n\n')
}

export const estimatedMeasures = ({ width, height, depth }: Dimensions) =>
  `Como no tenías las medidas, las estimé: ${height} × ${width} × ${depth} mm (alto, ancho, fondo). Dime las reales cuando las tengas y lo ajusto.`

export const repairedOnMyOwn = (repairs: Repair[]) => `Ajusté por mi cuenta ${repairs.length === 1 ? 'un detalle' : `${repairs.length} detalles`}: ${repairs.map((x) => x.message).join(' ')}`

export const leftUnresolved = (problems: string) =>
  `No logré que todo cerrara: quedaron ${problems}. Te las marqué en el 3D y en los avisos; pídeme que las corrija y lo arreglo sin empezar de cero.`

export const reconstructFailed = (withPhotos: boolean, problems: string, attempts: number) =>
  `${withPhotos ? 'No logré armar un modelo con estas fotos' : 'No logré armar un modelo con esa descripción'}${problems ? `: en ${attempts} intentos quedaron ${problems}` : ''}. ${withPhotos ? 'Prueba con otra toma de frente y una de 3/4 con buena luz.' : 'Prueba contando qué es, sus partes principales (repisas, puertas, cajones) y para qué lo vas a usar.'}`

export const alsoRepaired = (repairs: Repair[]) => `Además ajusté por mi cuenta: ${repairs.map((x) => x.message).join(' ')}`

export const stillPending = (problems: string) => `Todavía quedan ${problems}; pídeme que las corrija.`

export function adjustFailed(lastError: string) {
  const reason = lastError.trim().replace(/\.?$/, '.')
  return `No logré hacer ese cambio sin romper el diseño, así que no apliqué nada. ${reason.charAt(0).toUpperCase()}${reason.slice(1)} ¿Lo intentamos de otra forma?`
}

/** Why a valid change still waits for the person. */
export const holdText = {
  removesStructure: (names: string[]) => `Quiere quitar ${names.join(', ')}, que sostienen el mueble y no pediste quitar.`,
  askedQuestions: 'Hizo preguntas: el cambio espera tus respuestas.',
}
