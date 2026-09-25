import type { LLMProvider } from '../../ports/LLMProvider'
import { crearExperto, type Contenido, type Transporte } from './comun/experto'
import { ErrorProveedor } from './comun/errores'

// OpenAI y cualquier API compatible (SheLLM). Si el host no acepta esquema estricto o imágenes, se degrada solo y lo recuerda.

export interface ConexionCompatible {
  proveedor: 'openai' | 'shellm'
  host: string
  apiKey: string
  modelo: string
  etiqueta: string
}

interface Completado {
  choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[]
  usage?: { prompt_tokens?: number; completion_tokens?: number }
}

const capacidades = new Map<string, { esquema: boolean; imagenes: boolean }>()
export const normalizarHost = (host: string) => host.trim().replace(/\/+$/, '').replace(/\/v1$/, '')

class Rechazo extends Error {
  constructor(
    readonly status: number,
    readonly cuerpo: string,
  ) {
    super(`Error ${status} del proveedor: ${cuerpo.slice(0, 300)}`)
  }
}

const LIMITE_MS = 5 * 60_000

/** Si no se pudo ni conectar, con SheLLM casi siempre es el host apagado o el origen fuera de su lista de CORS. */
function sinConexion(c: Pick<ConexionCompatible, 'host'> & { proveedor?: ConexionCompatible['proveedor'] }) {
  if (c.proveedor !== 'shellm') return 'No se pudo conectar desde el navegador: revisa tu conexión a internet.'
  const origen = typeof location === 'undefined' ? 'el origen de Knotty' : location.origin
  return `No se pudo conectar con SheLLM en ${normalizarHost(c.host)}. Revisa que esté corriendo y que SHELLM_CORS_ORIGINS incluya ${origen}. Si pasa después de mucho rato, el túnel o proxy pudo cortar la conexión por tiempo.`
}

async function pedir(c: Pick<ConexionCompatible, 'host' | 'apiKey'> & { proveedor?: ConexionCompatible['proveedor'] }, ruta: string, init: RequestInit = {}) {
  let respuesta: Response
  const limite = AbortSignal.timeout(LIMITE_MS)
  try {
    respuesta = await fetch(`${normalizarHost(c.host)}/v1${ruta}`, {
      ...init,
      signal: init.signal ? AbortSignal.any([init.signal, limite]) : limite,
      headers: { 'content-type': 'application/json', ...(c.apiKey ? { authorization: `Bearer ${c.apiKey}` } : {}) },
    })
  } catch (e) {
    if (limite.aborted && !init.signal?.aborted) throw new Error(`El experto tardó más de ${LIMITE_MS / 60_000} minutos en responder. Intenta de nuevo o con un modelo más rápido.`)
    if (e instanceof TypeError) throw new Error(sinConexion(c))
    throw new ErrorProveedor(e)
  }
  if (respuesta.status === 401 || respuesta.status === 403) throw new Error(c.apiKey ? 'La API key no es válida.' : 'El host pide una API key.')
  if (respuesta.status === 429) throw new Error('Límite de peticiones alcanzado; espera un momento.')
  if (respuesta.status === 404) throw new Error('El modelo o la ruta no existen en ese host.')
  if (!respuesta.ok) throw new Rechazo(respuesta.status, await respuesta.text())
  return respuesta.json()
}

/** Quita cercas de código u otro texto alrededor del objeto JSON. */
function extraerJSON(texto: string) {
  const inicio = texto.indexOf('{')
  const fin = texto.lastIndexOf('}')
  if (inicio < 0 || fin <= inicio) throw new Error('El modelo no devolvió JSON.')
  try {
    return JSON.parse(texto.slice(inicio, fin + 1))
  } catch {
    throw new Error('El modelo devolvió un JSON inválido.')
  }
}

export function crearCompatible(c: ConexionCompatible): LLMProvider {
  const clave = normalizarHost(c.host)
  const puede = () => capacidades.get(clave) ?? { esquema: true, imagenes: true }

  const transporte: Transporte = {
    proveedor: c.proveedor,
    modelo: c.modelo,
    async completarJSON(sistema, contenido, esquema, nombre, signal) {
      for (;;) {
        const { esquema: conEsquema, imagenes } = puede()
        const fotos = contenido.filter((x) => x.tipo === 'imagen').length
        const partes: Contenido[] = imagenes
          ? contenido
          : [
              ...contenido.filter((x) => x.tipo === 'texto'),
              ...(fotos ? [{ tipo: 'texto' as const, texto: `(La persona tomó ${fotos} fotos, pero este proveedor no puede verlas. Trabaja con las medidas, las notas y los ángulos; marca confianza baja y pregunta lo que no puedas saber.)` }] : []),
            ]
        const instruccion = conEsquema ? sistema : `${sistema}\n\n# Formato de salida\nResponde únicamente con un objeto JSON que cumpla este JSON Schema, sin texto alrededor:\n${JSON.stringify(esquema)}`
        try {
          const r = (await pedir(c, '/chat/completions', {
            method: 'POST',
            signal,
            body: JSON.stringify({
              model: c.modelo,
              messages: [
                { role: 'system', content: instruccion },
                { role: 'user', content: partes.map((p) => (p.tipo === 'texto' ? { type: 'text', text: p.texto } : { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${p.base64}`, detail: 'high' } })) },
              ],
              response_format: conEsquema ? { type: 'json_schema', json_schema: { name: nombre, strict: true, schema: esquema } } : { type: 'json_object' },
            }),
          })) as Completado
          const eleccion = r.choices?.[0]
          if (eleccion?.message?.refusal) throw new Error(`El modelo se negó: ${eleccion.message.refusal}`)
          if (eleccion?.finish_reason === 'length') throw new Error('La respuesta se cortó por el límite de tokens.')
          const avisos = !imagenes && fotos ? [`${c.etiqueta.split(' · ')[0]} no aceptó las fotos, así que el experto trabajó sin verlas: con tus medidas, notas y respuestas.`] : undefined
          return { json: extraerJSON(eleccion?.message?.content ?? ''), consumo: { tokensEntrada: r.usage?.prompt_tokens, tokensSalida: r.usage?.completion_tokens }, avisos }
        } catch (e) {
          if (!(e instanceof Rechazo)) throw e
          // Un 413 es el cuerpo completo demasiado grande: con fotos, casi siempre son ellas.
          const porImagenes = (e.status === 400 && /image/i.test(e.cuerpo)) || e.status === 413
          if (e.status === 400 && conEsquema && /response_format|json_schema/i.test(e.cuerpo)) capacidades.set(clave, { ...puede(), esquema: false })
          else if (imagenes && fotos && porImagenes) capacidades.set(clave, { ...puede(), imagenes: false })
          else throw e
        }
      }
    },
  }
  return crearExperto(transporte, c.etiqueta)
}

export async function modelosCompatibles(c: Pick<ConexionCompatible, 'host' | 'apiKey'>, soloOpenAI: boolean): Promise<string[]> {
  const r = (await pedir(c, '/models')) as { data?: { id: string }[] }
  const ids = (r.data ?? []).map((m) => m.id)
  return soloOpenAI ? ids.filter((id) => /^(gpt|o\d|chatgpt)/.test(id) && !/audio|realtime|transcribe|tts|image|search/.test(id)).sort() : ids
}
