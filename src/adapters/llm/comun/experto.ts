import type { z } from 'zod'
import {
  RespuestaAjuste,
  RespuestaDictamen,
  RespuestaInvalida,
  RespuestaPlan,
  RespuestaReconstruccion,
  type Consumo,
  type LLMProvider,
  type SolicitudAjuste,
  type SolicitudDictamen,
  type PhotoReadingRequest,
  type SolicitudReconstruccion,
} from '../../../ports/LLMProvider'
import type { Catalogo } from '../../../domain/materiales/catalogo'
import { PhotoReading } from '../../../domain/reading/reading'
import { describirProblemas, esquemaEstricto } from './esquemaJson'
import { AJUSTE, DICTAMEN, ESQUELETO, idPrompt, LECTURA, RECONSTRUCCION, sistemaPara } from './prompts'

export type Contenido = { tipo: 'texto'; texto: string } | { tipo: 'imagen'; base64: string }

/** Lo único que cambia entre proveedores: cómo pedir JSON que cumpla un esquema. */
export interface Transporte {
  proveedor: string
  modelo: string
  completarJSON(sistema: string, contenido: Contenido[], esquema: Record<string, unknown>, nombre: string, signal: AbortSignal): Promise<{ json: unknown; consumo: Consumo; avisos?: string[] }>
}

const ESQUEMA_RECONSTRUCCION = esquemaEstricto(RespuestaReconstruccion)
const ESQUEMA_AJUSTE = esquemaEstricto(RespuestaAjuste)
const ESQUEMA_DICTAMEN = esquemaEstricto(RespuestaDictamen)
const READING_SCHEMA = esquemaEstricto(PhotoReading)
const PLAN_SCHEMA = esquemaEstricto(RespuestaPlan)

function validar<T>(esquema: z.ZodType<T>, json: unknown): T {
  const r = esquema.safeParse(json)
  if (!r.success) throw new RespuestaInvalida(json, describirProblemas(r.error))
  return r.data
}

const correccion = (anterior: unknown, errores: string): Contenido => ({
  tipo: 'texto',
  texto: `## Tu respuesta anterior no se pudo usar\n${errores}\n\nRespuesta anterior:\n\`\`\`json\n${JSON.stringify(anterior)}\n\`\`\`\nCorrígela y responde completa de nuevo.`,
})

/** What a design or skeleton request carries: measures, the person's words, and the photo reading or the photos themselves. */
function designRequest(s: SolicitudReconstruccion): Contenido[] {
  const medidas = s.medidas
    ? `Medidas del mueble: ancho ${s.medidas.ancho} mm, alto ${s.medidas.alto} mm, fondo ${s.medidas.fondo} mm.`
    : 'La persona no sabe las medidas: propón unas típicas para ese mueble y dilo en la explicación.'
  const lectura = s.lectura
    ? `\nNo te mando las fotos: ya se leyeron. Esto es lo que se ve en ellas (proporciones relativas, columnas de izquierda a derecha y huecos de abajo hacia arriba):\n${JSON.stringify(s.lectura)}`
    : ''
  return [
    {
      tipo: 'texto',
      texto:
        s.fotos.length || s.lectura
          ? `${medidas}${s.notas ? `\nNotas de la persona: ${s.notas}` : ''}${lectura}`
          : `${medidas}\nNo hay fotos: diseña a partir de esta descripción de la persona.\nDescripción: ${s.notas || '(sin descripción)'}`,
    },
    ...s.fotos.flatMap((f, i): Contenido[] => [
      { tipo: 'texto', texto: `Foto ${i + 1}: ${f.angulo}${f.note ? `. La persona dice: ${f.note}` : ''}` },
      { tipo: 'imagen', base64: f.base64 },
    ]),
  ]
}

const materialsText = (catalog: Catalogo) => {
  const boards = catalog.materiales.filter((m) => m.tipo === 'triplay')
  return `uno de ${boards.map((m) => `"${m.id}" (${m.espesor} mm)`).join(', ')}`
}

export function crearExperto(t: Transporte, etiqueta: string): LLMProvider {
  return {
    id: t.proveedor,
    etiqueta,
    async reconstruir(s: SolicitudReconstruccion, signal) {
      const contenido = designRequest(s)
      if (s.correccion) contenido.push(correccion(s.correccion.respuestaAnterior, s.correccion.errores.map((e) => `- ${e.codigo}: ${e.mensaje}`).join('\n')))
      const { json, consumo, avisos } = await t.completarJSON(sistemaPara(RECONSTRUCCION, s.catalogo), contenido, ESQUEMA_RECONSTRUCCION, 'reconstruccion', signal)
      return { valor: validar(RespuestaReconstruccion, json), origen: { promptId: idPrompt(RECONSTRUCCION), proveedor: t.proveedor, modelo: t.modelo }, consumo, avisos }
    },
    async proponerAjuste(s: SolicitudAjuste, signal) {
      const contenido: Contenido[] = [
        { tipo: 'texto', texto: `${s.contexto}\n\n## Pedido de la persona\n${s.peticion}` },
        ...s.fotos.flatMap((f): Contenido[] => [
          { tipo: 'texto', texto: `Foto que manda la persona: ${f.angulo}` },
          { tipo: 'imagen', base64: f.base64 },
        ]),
      ]
      if (s.correccion) contenido.push(correccion(s.correccion.respuestaAnterior, s.correccion.errores))
      const { json, consumo, avisos } = await t.completarJSON(sistemaPara(AJUSTE, s.catalogo), contenido, ESQUEMA_AJUSTE, 'ajuste', signal)
      return { valor: validar(RespuestaAjuste, json), origen: { promptId: idPrompt(AJUSTE), proveedor: t.proveedor, modelo: t.modelo }, consumo, avisos }
    },
    async planDesign(s: SolicitudReconstruccion, signal) {
      const contenido = designRequest(s)
      if (s.correccion) contenido.push(correccion(s.correccion.respuestaAnterior, s.correccion.errores.map((e) => `- ${e.codigo}: ${e.mensaje}`).join('\n')))
      const { json, consumo, avisos } = await t.completarJSON(ESQUELETO.texto.replace('{{materiales}}', materialsText(s.catalogo)), contenido, PLAN_SCHEMA, 'esqueleto', signal)
      return { valor: validar(RespuestaPlan, json), origen: { promptId: ESQUELETO.id, proveedor: t.proveedor, modelo: t.modelo }, consumo, avisos }
    },
    async readPhoto(r: PhotoReadingRequest, signal) {
      const contenido: Contenido[] = [
        { tipo: 'texto', texto: `Foto: ${r.photo.angulo}.${r.photo.note ? ` La persona dice de esta foto: ${r.photo.note}` : ''}${r.context ? `\nLo que la persona busca: ${r.context}` : ''}` },
        { tipo: 'imagen', base64: r.photo.base64 },
      ]
      const { json, consumo, avisos } = await t.completarJSON(LECTURA.texto, contenido, READING_SCHEMA, 'lectura', signal)
      return { valor: validar(PhotoReading, json), origen: { promptId: LECTURA.id, proveedor: t.proveedor, modelo: t.modelo }, consumo, avisos }
    },
    async dictaminar(s: SolicitudDictamen, signal) {
      const contenido: Contenido[] = [{ tipo: 'texto', texto: `${s.contexto}\n\n${s.revision}` }]
      const { json, consumo, avisos } = await t.completarJSON(sistemaPara(DICTAMEN, s.catalogo), contenido, ESQUEMA_DICTAMEN, 'dictamen', signal)
      return { valor: validar(RespuestaDictamen, json), origen: { promptId: idPrompt(DICTAMEN), proveedor: t.proveedor, modelo: t.modelo }, consumo, avisos }
    },
  }
}
