import { afterEach, describe, expect, it, vi } from 'vitest'
import { catalogo } from '../../domain/fixtures/catalogo.test-util'
import { librero } from '../../domain/fixtures/librero'
import { crearCompatible } from './compatibleOpenAI'

const respuesta = { explicacion: 'Veo un librero', diseno: librero, preguntas: [], fotosSolicitadas: [], requisitos: [] }
const ok = (json: unknown) => new Response(JSON.stringify({ choices: [{ message: { content: '```json\n' + JSON.stringify(json) + '\n```' } }] }), { status: 200 })
const rechazo = (texto: string) => new Response(texto, { status: 400 })

afterEach(() => vi.unstubAllGlobals())

describe('crearCompatible', () => {
  it('si el host no acepta esquema estricto ni imágenes, se degrada a json_object sin fotos y lo recuerda', async () => {
    const cuerpos: { response_format: { type: string }; messages: { content: unknown }[] }[] = []
    const fetch = vi.fn(async (_url: string, init: RequestInit) => {
      const cuerpo = JSON.parse(init.body as string)
      cuerpos.push(cuerpo)
      if (cuerpo.response_format.type === 'json_schema') return rechazo('Field "response_format" must be an object with type "json_object" or "text"')
      if (JSON.stringify(cuerpo.messages).includes('image_url')) return rechazo('Only text content blocks are supported; image blocks are rejected')
      return ok(respuesta)
    })
    vi.stubGlobal('fetch', fetch)
    const experto = crearCompatible({ proveedor: 'shellm', host: 'http://127.0.0.1:6100/', apiKey: '', modelo: 'claude', etiqueta: 'SheLLM' })
    const solicitud = { medidas: librero.dimensiones, fotos: [{ angulo: 'frente', base64: 'AAA' }], notas: '', catalogo, correccion: null }

    const r = await experto.reconstruir(solicitud, new AbortController().signal)
    expect(r.valor.diseno.nombre).toBe('Librero')
    expect(cuerpos.map((c) => c.response_format.type)).toEqual(['json_schema', 'json_object', 'json_object'])
    expect(JSON.stringify(cuerpos[2].messages)).toContain('no puede verlas')
    expect(JSON.stringify(cuerpos[2].messages[0])).toContain('JSON Schema')
    expect(fetch.mock.calls[0][0]).toBe('http://127.0.0.1:6100/v1/chat/completions')

    await experto.reconstruir(solicitud, new AbortController().signal)
    expect(cuerpos).toHaveLength(4)
  })

  it('manda la llave solo si hay', async () => {
    const fetch = vi.fn(async () => ok(respuesta))
    vi.stubGlobal('fetch', fetch)
    await crearCompatible({ proveedor: 'openai', host: 'https://api.openai.com', apiKey: 'sk-x', modelo: 'gpt', etiqueta: 'OpenAI' }).reconstruir(
      { medidas: librero.dimensiones, fotos: [], notas: '', catalogo, correccion: null },
      new AbortController().signal,
    )
    expect((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].headers).toMatchObject({ authorization: 'Bearer sk-x' })
  })
})
