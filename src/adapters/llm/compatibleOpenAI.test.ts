import { afterEach, describe, expect, it, vi } from 'vitest'
import { testCatalog } from '../../domain/fixtures/catalog.test-util'
import { exampleBookcase } from '../../domain/fixtures/bookcase'
import { createCompatible } from './compatibleOpenAI'

const respuesta = { explanation: 'Veo un librero', design: exampleBookcase, questions: [], requestedPhotos: [], requirements: [], suggestions: [] }
const ok = (json: unknown) => new Response(JSON.stringify({ choices: [{ message: { content: '```json\n' + JSON.stringify(json) + '\n```' } }] }), { status: 200 })
const conTexto = (contenido: string) => new Response(JSON.stringify({ choices: [{ message: { content: contenido } }] }), { status: 200 })
const rechazo = (texto: string, status = 400) => new Response(texto, { status })
const solicitud = (fotos = [{ angle: 'front', base64: 'AAA' }]) => ({ measures: exampleBookcase.dimensions, photos: fotos, notes: '', reading: null, catalog: testCatalog, correction: null })
let host = 0
const nueva = () => createCompatible({ provider: 'shellm', host: `http://127.0.0.1:${6100 + ++host}`, apiKey: '', model: 'claude', label: 'SheLLM · claude' })

afterEach(() => vi.unstubAllGlobals())

describe('createCompatible', () => {
  it('if the host takes neither strict schemas nor images, it falls back to json_object without photos and remembers it', async () => {
    const cuerpos: { response_format: { type: string }; messages: { content: unknown }[] }[] = []
    const fetch = vi.fn(async (_url: string, init: RequestInit) => {
      const cuerpo = JSON.parse(init.body as string)
      cuerpos.push(cuerpo)
      if (cuerpo.response_format.type === 'json_schema') return rechazo('Field "response_format" must be an object with type "json_object" or "text"')
      if (JSON.stringify(cuerpo.messages).includes('image_url')) return rechazo('Only text content blocks are supported; image blocks are rejected')
      return ok(respuesta)
    })
    vi.stubGlobal('fetch', fetch)
    const experto = createCompatible({ provider: 'shellm', host: 'http://127.0.0.1:6100/', apiKey: '', model: 'claude', label: 'SheLLM' })
    const solicitud = { measures: exampleBookcase.dimensions, photos: [{ angle: 'front', base64: 'AAA' }], notes: '', reading: null, catalog: testCatalog, correction: null }

    const r = await experto.reconstruct(solicitud, new AbortController().signal)
    expect(r.value.design.name).toBe('Librero')
    expect(cuerpos.map((c) => c.response_format.type)).toEqual(['json_schema', 'json_object', 'json_object'])
    expect(JSON.stringify(cuerpos[2].messages)).toContain('no puede verlas')
    expect(JSON.stringify(cuerpos[2].messages[0])).toContain('JSON Schema')
    expect(fetch.mock.calls[0][0]).toBe('http://127.0.0.1:6100/v1/chat/completions')

    await experto.reconstruct(solicitud, new AbortController().signal)
    expect(cuerpos).toHaveLength(4)
  })

  it('builds the request: text and image interleaved in order, JPEG data URL and strict json_schema', async () => {
    let cuerpo: { messages: { role: string; content: { type: string; text?: string; image_url?: { url: string } }[] }[]; response_format: { type: string; json_schema: { name: string; strict: boolean } } } | null = null
    vi.stubGlobal('fetch', async (_: string, init: RequestInit) => ((cuerpo = JSON.parse(init.body as string)), ok(respuesta)))
    await nueva().reconstruct(solicitud([{ angle: 'front', base64: 'AAA' }, { angle: 'three-quarter', base64: 'BBB' }]), new AbortController().signal)
    const partes = cuerpo!.messages[1].content
    expect(partes.map((p) => p.text ?? p.image_url?.url)).toEqual([
      expect.stringContaining('Furniture measures'),
      'Photo 1: front',
      'data:image/jpeg;base64,AAA',
      'Photo 2: three-quarter',
      'data:image/jpeg;base64,BBB',
    ])
    expect(cuerpo!.response_format).toMatchObject({ type: 'json_schema', json_schema: { name: 'reconstruccion', strict: true } })
  })

  it('a 413 with photos retries without them and tells the person', async () => {
    const tipos: boolean[] = []
    vi.stubGlobal('fetch', async (_: string, init: RequestInit) => {
      const conImagen = (init.body as string).includes('image_url')
      tipos.push(conImagen)
      return conImagen ? rechazo('Payload Too Large', 413) : ok(respuesta)
    })
    const r = await nueva().reconstruct(solicitud(), new AbortController().signal)
    expect(tipos).toEqual([true, false])
    expect(r.warnings).toEqual([expect.stringContaining('SheLLM no aceptó las fotos')])
  })

  it('a 400 about neither response_format nor images does not fall back: it is reported', async () => {
    const fetch = vi.fn(async () => rechazo('Field "model" is required'))
    vi.stubGlobal('fetch', fetch)
    await expect(nueva().reconstruct(solicitud(), new AbortController().signal)).rejects.toThrow('Field "model" is required')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('a 413 without photos cannot be solved by dropping them: it is reported', async () => {
    vi.stubGlobal('fetch', async () => rechazo('Payload Too Large', 413))
    await expect(nueva().reconstruct(solicitud([]), new AbortController().signal)).rejects.toThrow('413')
  })

  it('if SheLLM does not answer, it says what to check: that it runs and the origin is in its CORS', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    await expect(nueva().reconstruct(solicitud(), new AbortController().signal)).rejects.toThrow(/SheLLM en http:\/\/127\.0\.0\.1:\d+.*SHELLM_CORS_ORIGINS/)
  })

  it('if the GET answers but the POST does not go out, it points to the POST CORS and says the size', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => (init?.method === 'POST' ? Promise.reject(new TypeError('Failed to fetch')) : new Response('{"data":[]}', { status: 200 }))))
    await expect(nueva().reconstruct(solicitud([]), new AbortController().signal)).rejects.toThrow(/SheLLM responde.*\(\d+ KB\).*Content-Type y Authorization/)
  })

  it('a 504 from the host is explained as a time limit, not as no connection', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('upstream timeout', { status: 504 })))
    await expect(nueva().reconstruct(solicitud([]), new AbortController().signal)).rejects.toThrow(/SheLLM cortó la petición a los \d+ s.*sube TIMEOUT_MS de SheLLM/)
  })

  it('asks for a stream and builds the answer from the SSE pieces, trailing comments included', async () => {
    const texto = JSON.stringify(respuesta)
    const mitad = Math.floor(texto.length / 2)
    const sse = [
      ': queued 1\n\n',
      `data: ${JSON.stringify({ choices: [{ delta: { content: texto.slice(0, mitad) } }] })}\n\n`,
      // Un evento partido entre dos lecturas se junta antes de leerse.
      `data: ${JSON.stringify({ choices: [{ delta: { content: texto.slice(mitad) }, finish_reason: 'stop' }] })}`.slice(0, 20),
      `data: ${JSON.stringify({ choices: [{ delta: { content: texto.slice(mitad) }, finish_reason: 'stop' }] })}\n\n`.slice(20),
      `data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 900, completion_tokens: 3100 } })}\n\n`,
      'data: [DONE]\n\n',
    ]
    const cuerpos: { stream?: boolean; stream_options?: unknown }[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        cuerpos.push(JSON.parse(init.body as string))
        const cuerpo = new ReadableStream({ start: (c) => (sse.forEach((x) => c.enqueue(new TextEncoder().encode(x))), c.close()) })
        return new Response(cuerpo, { status: 200, headers: { 'content-type': 'text/event-stream' } })
      }),
    )
    const r = await nueva().reconstruct(solicitud([]), new AbortController().signal)
    expect(r.value.design.name).toBe('Librero')
    expect(r.usage).toEqual({ inputTokens: 900, outputTokens: 3100 })
    expect(cuerpos[0]).toMatchObject({ stream: true, stream_options: { include_usage: true } })
  })

  it('a stream cut without [DONE] or finish_reason is reported as a cut, not as invalid JSON', async () => {
    const sse = [`data: ${JSON.stringify({ choices: [{ delta: { content: '{"explicacion":"Veo un' } }] })}\n\n`]
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream({ start: (c) => (sse.forEach((x) => c.enqueue(new TextEncoder().encode(x))), c.close()) }), { status: 200, headers: { 'content-type': 'text/event-stream' } })))
    await expect(nueva().reconstruct(solicitud([]), new AbortController().signal)).rejects.toThrow(/se cortó a media respuesta/)
  })

  it('asks for low reasoning and, if the model does not take it, stops asking', async () => {
    const cuerpos: { reasoning_effort?: string }[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        const cuerpo = JSON.parse(init.body as string)
        cuerpos.push(cuerpo)
        return cuerpo.reasoning_effort ? rechazo("Unsupported parameter: 'reasoning_effort' is not supported with this model.") : ok(respuesta)
      }),
    )
    const experto = nueva()
    await experto.reconstruct(solicitud([]), new AbortController().signal)
    await experto.reconstruct(solicitud([]), new AbortController().signal)
    expect(cuerpos.map((c) => c.reasoning_effort ?? null)).toEqual(['low', null, null])
  })

  it('if two attempts arrive stuck together, the first wrapped as text, it keeps the good one', async () => {
    const texto = JSON.stringify(respuesta)
    const intentos = `${JSON.stringify({ $PARAMETER_NAME: JSON.stringify(respuesta, null, 2) })}${texto}`
    vi.stubGlobal('fetch', vi.fn(async () => conTexto(intentos)))
    const r = await nueva().reconstruct(solicitud([]), new AbortController().signal)
    expect(r.value.design.name).toBe('Librero')
  })

  it('a raw newline inside a string does not break the answer', async () => {
    const texto = JSON.stringify({ ...respuesta, explanation: 'Veo un librero__SALTO__con zoclo' }).replace('__SALTO__', '\n\t')
    vi.stubGlobal('fetch', vi.fn(async () => conTexto(texto)))
    const r = await nueva().reconstruct(solicitud([]), new AbortController().signal)
    expect(r.value.explanation).toBe('Veo un librero\n\tcon zoclo')
  })

  it('a single attempt wrapped as text is unwrapped too', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok({ $PARAMETER_NAME: JSON.stringify(respuesta) })))
    const r = await nueva().reconstruct(solicitud([]), new AbortController().signal)
    expect(r.value.explanation).toBe('Veo un librero')
  })

  it('invalid JSON says how much arrived and how it ends, to tell a cut apart', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"explicacion": "Veo un buró", "diseno": {"dimensiones": {"alto": 500}, "piezas": [' } }] }), { status: 200 })))
    await expect(nueva().reconstruct(solicitud([]), new AbortController().signal)).rejects.toThrow(/JSON inválido \(\d+ caracteres, termina en «.*piezas": \[»\)/)
  })

  it('if the host does not take streams, it stops asking and remembers it', async () => {
    const cuerpos: { stream?: boolean }[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        const cuerpo = JSON.parse(init.body as string)
        cuerpos.push(cuerpo)
        return cuerpo.stream ? rechazo('Unknown parameter: stream_options') : ok(respuesta)
      }),
    )
    const experto = nueva()
    await experto.reconstruct(solicitud([]), new AbortController().signal)
    await experto.reconstruct(solicitud([]), new AbortController().signal)
    expect(cuerpos.map((c) => c.stream ?? false)).toEqual([true, false, false])
  })

  it('sends the key only when there is one', async () => {
    const fetch = vi.fn(async () => ok(respuesta))
    vi.stubGlobal('fetch', fetch)
    await createCompatible({ provider: 'openai', host: 'https://api.openai.com', apiKey: 'sk-x', model: 'gpt', label: 'OpenAI' }).reconstruct(
      { measures: exampleBookcase.dimensions, photos: [], notes: '', reading: null, catalog: testCatalog, correction: null },
      new AbortController().signal,
    )
    expect((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].headers).toMatchObject({ authorization: 'Bearer sk-x' })
  })
})
