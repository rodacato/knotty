import type { z } from 'zod'
import {
  RespuestaAjuste,
  RespuestaDictamen,
  RespuestaInvalida,
  RespuestaReconstruccion,
  type Consumo,
  type LLMProvider,
  type SolicitudAjuste,
  type SolicitudDictamen,
  type SolicitudReconstruccion,
} from '../../../ports/LLMProvider'
import { describirProblemas, esquemaEstricto } from './esquemaJson'
import { AJUSTE, DICTAMEN, idPrompt, RECONSTRUCCION, sistemaPara } from './prompts'

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

function validar<T>(esquema: z.ZodType<T>, json: unknown): T {
  const r = esquema.safeParse(json)
  if (!r.success) throw new RespuestaInvalida(json, describirProblemas(r.error))
  return r.data
}

const correccion = (anterior: unknown, errores: string): Contenido => ({
  tipo: 'texto',
  texto: `## Tu respuesta anterior no se pudo usar\n${errores}\n\nRespuesta anterior:\n\`\`\`json\n${JSON.stringify(anterior)}\n\`\`\`\nCorrígela y responde completa de nuevo.`,
})

export function crearExperto(t: Transporte, etiqueta: string): LLMProvider {
  return {
    id: t.proveedor,
    etiqueta,
    async reconstruir(s: SolicitudReconstruccion, signal) {
      const medidas = s.medidas
        ? `Medidas del mueble: ancho ${s.medidas.ancho} mm, alto ${s.medidas.alto} mm, fondo ${s.medidas.fondo} mm.`
        : 'La persona no sabe las medidas: propón unas típicas para ese mueble en `dimensiones` y dilo en la explicación.'
      const contenido: Contenido[] = [
        {
          tipo: 'texto',
          texto: s.fotos.length
            ? `${medidas}${s.notas ? `\nNotas de la persona: ${s.notas}` : ''}`
            : `${medidas}\nNo hay fotos: diseña a partir de esta descripción de la persona.\nDescripción: ${s.notas || '(sin descripción)'}`,
        },
        ...s.fotos.flatMap((f, i): Contenido[] => [
          { tipo: 'texto', texto: `Foto ${i + 1}: ${f.angulo}` },
          { tipo: 'imagen', base64: f.base64 },
        ]),
      ]
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
    async dictaminar(s: SolicitudDictamen, signal) {
      const contenido: Contenido[] = [{ tipo: 'texto', texto: `${s.contexto}\n\n${s.revision}` }]
      const { json, consumo, avisos } = await t.completarJSON(sistemaPara(DICTAMEN, s.catalogo), contenido, ESQUEMA_DICTAMEN, 'dictamen', signal)
      return { valor: validar(RespuestaDictamen, json), origen: { promptId: idPrompt(DICTAMEN), proveedor: t.proveedor, modelo: t.modelo }, consumo, avisos }
    },
  }
}
