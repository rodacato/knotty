import type { z } from 'zod'
import { RespuestaAjuste, RespuestaInvalida, RespuestaReconstruccion, type Consumo, type LLMProvider, type SolicitudAjuste, type SolicitudReconstruccion } from '../../../ports/LLMProvider'
import { describirProblemas, esquemaEstricto } from './esquemaJson'
import { AJUSTE, idPrompt, RECONSTRUCCION, sistemaPara } from './prompts'

export type Contenido = { tipo: 'texto'; texto: string } | { tipo: 'imagen'; base64: string }

/** Lo único que cambia entre proveedores: cómo pedir JSON que cumpla un esquema. */
export interface Transporte {
  proveedor: string
  modelo: string
  completarJSON(sistema: string, contenido: Contenido[], esquema: Record<string, unknown>, nombre: string, signal: AbortSignal): Promise<{ json: unknown; consumo: Consumo }>
}

const ESQUEMA_RECONSTRUCCION = esquemaEstricto(RespuestaReconstruccion)
const ESQUEMA_AJUSTE = esquemaEstricto(RespuestaAjuste)

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
      const { ancho, alto, fondo } = s.medidas
      const contenido: Contenido[] = [
        { tipo: 'texto', texto: `Medidas del mueble: ancho ${ancho} mm, alto ${alto} mm, fondo ${fondo} mm.${s.notas ? `\nNotas de la persona: ${s.notas}` : ''}` },
        ...s.fotos.flatMap((f, i): Contenido[] => [
          { tipo: 'texto', texto: `Foto ${i + 1}: ${f.angulo}` },
          { tipo: 'imagen', base64: f.base64 },
        ]),
      ]
      if (s.correccion) contenido.push(correccion(s.correccion.respuestaAnterior, s.correccion.errores.map((e) => `- ${e.codigo}: ${e.mensaje}`).join('\n')))
      const { json, consumo } = await t.completarJSON(sistemaPara(RECONSTRUCCION, s.catalogo), contenido, ESQUEMA_RECONSTRUCCION, 'reconstruccion', signal)
      return { valor: validar(RespuestaReconstruccion, json), origen: { promptId: idPrompt(RECONSTRUCCION), proveedor: t.proveedor, modelo: t.modelo }, consumo }
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
      const { json, consumo } = await t.completarJSON(sistemaPara(AJUSTE, s.catalogo), contenido, ESQUEMA_AJUSTE, 'ajuste', signal)
      return { valor: validar(RespuestaAjuste, json), origen: { promptId: idPrompt(AJUSTE), proveedor: t.proveedor, modelo: t.modelo }, consumo }
    },
  }
}
