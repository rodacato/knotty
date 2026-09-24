import type Anthropic from '@anthropic-ai/sdk'
import type { LLMProvider } from '../../ports/LLMProvider'
import { crearExperto, type Contenido, type Transporte } from './comun/experto'
import { ErrorProveedor } from './comun/errores'

// Los modelos que rechazan a veces por clasificadores de seguridad: la API reintenta sola en otro modelo.
const CON_RESPALDO = ['claude-opus-5', 'claude-fable-5-1']

/** El SDK pesa: se carga la primera vez que se usa Claude. */
async function cliente(apiKey: string) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1, timeout: 300_000 })
}

const bloque = (c: Contenido): Anthropic.Beta.BetaContentBlockParam =>
  c.tipo === 'texto' ? { type: 'text', text: c.texto } : { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: c.base64 } }

export function crearAnthropic(apiKey: string, modelo: string): LLMProvider {
  const transporte: Transporte = {
    proveedor: 'anthropic',
    modelo,
    async completarJSON(sistema, contenido, esquema, _nombre, signal) {
      try {
        const stream = (await cliente(apiKey)).beta.messages.stream(
          {
            model: modelo,
            max_tokens: 32000,
            system: [{ type: 'text', text: sistema, cache_control: { type: 'ephemeral' } }],
            messages: [{ role: 'user', content: contenido.map(bloque) }],
            output_config: { format: { type: 'json_schema', schema: esquema } },
            ...(CON_RESPALDO.includes(modelo) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
          },
          { signal },
        )
        const final = await stream.finalMessage()
        if (final.stop_reason === 'refusal') throw new Error('El modelo se negó a responder esta petición.')
        if (final.stop_reason === 'max_tokens') throw new Error('La respuesta se cortó por el límite de tokens.')
        const texto = final.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
        return { json: JSON.parse(texto), consumo: { tokensEntrada: final.usage.input_tokens, tokensSalida: final.usage.output_tokens } }
      } catch (e) {
        if (e instanceof SyntaxError) throw new Error('El modelo devolvió un JSON inválido.')
        throw new ErrorProveedor(e)
      }
    },
  }
  return crearExperto(transporte, `Claude · ${modelo}`)
}

export async function modelosAnthropic(apiKey: string): Promise<string[]> {
  try {
    const ids: string[] = []
    for await (const m of (await cliente(apiKey)).models.list({ limit: 100 })) ids.push(m.id)
    return ids
  } catch (e) {
    throw new ErrorProveedor(e)
  }
}
