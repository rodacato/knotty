import { afterEach, describe, expect, it, vi } from 'vitest'
import { catalogo } from '../../domain/fixtures/catalogo.test-util'
import { librero } from '../../domain/fixtures/librero'
import { crearCompatible } from './compatibleOpenAI'

const respuesta = { explicacion: 'Veo un librero', diseno: librero, preguntas: [], fotosSolicitadas: [], requisitos: [], sugerencias: [] }
const ok = (json: unknown) => new Response(JSON.stringify({ choices: [{ message: { content: '```json\n' + JSON.stringify(json) + '\n```' } }] }), { status: 200 })
const rechazo = (texto: string, status = 400) => new Response(texto, { status })
const solicitud = (fotos = [{ angulo: 'frente', base64: 'AAA' }]) => ({ medidas: librero.dimensiones, fotos, notas: '', catalogo, correccion: null })
let host = 0
const nueva = () => crearCompatible({ proveedor: 'shellm', host: `http://127.0.0.1:${6100 + ++host}`, apiKey: '', modelo: 'claude', etiqueta: 'SheLLM · claude' })

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

  it('arma la petición: texto e imagen intercalados en orden, data URL JPEG y json_schema estricto', async () => {
    let cuerpo: { messages: { role: string; content: { type: string; text?: string; image_url?: { url: string } }[] }[]; response_format: { type: string; json_schema: { name: string; strict: boolean } } } | null = null
    vi.stubGlobal('fetch', async (_: string, init: RequestInit) => ((cuerpo = JSON.parse(init.body as string)), ok(respuesta)))
    await nueva().reconstruir(solicitud([{ angulo: 'frente', base64: 'AAA' }, { angulo: '3/4', base64: 'BBB' }]), new AbortController().signal)
    const partes = cuerpo!.messages[1].content
    expect(partes.map((p) => p.text ?? p.image_url?.url)).toEqual([
      expect.stringContaining('Medidas del mueble'),
      'Foto 1: frente',
      'data:image/jpeg;base64,AAA',
      'Foto 2: 3/4',
      'data:image/jpeg;base64,BBB',
    ])
    expect(cuerpo!.response_format).toMatchObject({ type: 'json_schema', json_schema: { name: 'reconstruccion', strict: true } })
  })

  it('un 413 con fotos se reintenta sin ellas y avisa a la persona', async () => {
    const tipos: boolean[] = []
    vi.stubGlobal('fetch', async (_: string, init: RequestInit) => {
      const conImagen = (init.body as string).includes('image_url')
      tipos.push(conImagen)
      return conImagen ? rechazo('Payload Too Large', 413) : ok(respuesta)
    })
    const r = await nueva().reconstruir(solicitud(), new AbortController().signal)
    expect(tipos).toEqual([true, false])
    expect(r.avisos).toEqual([expect.stringContaining('SheLLM no aceptó las fotos')])
  })

  it('un 400 que no habla de response_format ni de imágenes no degrada: se reporta', async () => {
    const fetch = vi.fn(async () => rechazo('Field "model" is required'))
    vi.stubGlobal('fetch', fetch)
    await expect(nueva().reconstruir(solicitud(), new AbortController().signal)).rejects.toThrow('Field "model" is required')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('un 413 sin fotos no se puede resolver quitándolas: se reporta', async () => {
    vi.stubGlobal('fetch', async () => rechazo('Payload Too Large', 413))
    await expect(nueva().reconstruir(solicitud([]), new AbortController().signal)).rejects.toThrow('413')
  })

  it('si SheLLM no responde, dice qué revisar: que esté corriendo y el origen en su CORS', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    await expect(nueva().reconstruir(solicitud(), new AbortController().signal)).rejects.toThrow(/SheLLM en http:\/\/127\.0\.0\.1:\d+.*SHELLM_CORS_ORIGINS/)
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
