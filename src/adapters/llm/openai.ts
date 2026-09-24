import type { LLMProvider } from '../../ports/LLMProvider'
import { crearExperto, type Contenido, type Transporte } from './comun/experto'
import { ErrorProveedor } from './comun/errores'

const HOST = 'https://api.openai.com/v1'

interface Completado {
  choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[]
  usage?: { prompt_tokens?: number; completion_tokens?: number }
  error?: { message?: string }
}

const parte = (c: Contenido) => (c.tipo === 'texto' ? { type: 'text', text: c.texto } : { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${c.base64}`, detail: 'high' } })

async function pedir(apiKey: string, ruta: string, init: RequestInit = {}) {
  let respuesta: Response
  try {
    respuesta = await fetch(`${HOST}${ruta}`, { ...init, headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` } })
  } catch (e) {
    throw new ErrorProveedor(e)
  }
  if (respuesta.status === 401) throw new Error('La API key no es válida.')
  if (respuesta.status === 429) throw new Error('Límite de peticiones alcanzado; espera un momento.')
  if (respuesta.status === 404) throw new Error('El modelo no existe o no está disponible para tu cuenta.')
  if (!respuesta.ok) throw new Error(`Error ${respuesta.status} del proveedor: ${(await respuesta.text()).slice(0, 300)}`)
  return respuesta.json()
}

export function crearOpenAI(apiKey: string, modelo: string): LLMProvider {
  const transporte: Transporte = {
    proveedor: 'openai',
    modelo,
    async completarJSON(sistema, contenido, esquema, nombre, signal) {
      const r = (await pedir(apiKey, '/chat/completions', {
        method: 'POST',
        signal,
        body: JSON.stringify({
          model: modelo,
          messages: [
            { role: 'system', content: sistema },
            { role: 'user', content: contenido.map(parte) },
          ],
          response_format: { type: 'json_schema', json_schema: { name: nombre, strict: true, schema: esquema } },
        }),
      })) as Completado
      const eleccion = r.choices?.[0]
      if (eleccion?.message?.refusal) throw new Error(`El modelo se negó: ${eleccion.message.refusal}`)
      if (eleccion?.finish_reason === 'length') throw new Error('La respuesta se cortó por el límite de tokens.')
      try {
        return { json: JSON.parse(eleccion?.message?.content ?? ''), consumo: { tokensEntrada: r.usage?.prompt_tokens, tokensSalida: r.usage?.completion_tokens } }
      } catch {
        throw new Error('El modelo devolvió un JSON inválido.')
      }
    },
  }
  return crearExperto(transporte, `OpenAI · ${modelo}`)
}

export async function modelosOpenAI(apiKey: string): Promise<string[]> {
  const r = (await pedir(apiKey, '/models')) as { data?: { id: string }[] }
  return (r.data ?? [])
    .map((m) => m.id)
    .filter((id) => /^(gpt|o\d|chatgpt)/.test(id) && !/audio|realtime|transcribe|tts|image|search/.test(id))
    .sort()
}
