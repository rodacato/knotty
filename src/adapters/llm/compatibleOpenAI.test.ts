import { afterEach, describe, expect, it, vi } from 'vitest'
import { testCatalog } from '../../domain/fixtures/catalog.test-util'
import { exampleBookcase } from '../../domain/fixtures/bookcase'
import { createCompatible } from './compatibleOpenAI'

const answer = { explanation: 'Veo un librero', design: exampleBookcase, questions: [], requestedPhotos: [], requirements: [], suggestions: [] }
const ok = (json: unknown) => new Response(JSON.stringify({ choices: [{ message: { content: '```json\n' + JSON.stringify(json) + '\n```' } }] }), { status: 200 })
const withText = (content: string) => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 })
const rejection = (text: string, status = 400) => new Response(text, { status })
const request = (photos = [{ angle: 'front', base64: 'AAA' }]) => ({ measures: exampleBookcase.dimensions, photos, notes: '', reading: null, catalog: testCatalog, correction: null })
let host = 0
const fresh = () => createCompatible({ provider: 'shellm', host: `http://127.0.0.1:${6100 + ++host}`, apiKey: '', model: 'claude', label: 'SheLLM · claude' })

afterEach(() => vi.unstubAllGlobals())

describe('createCompatible', () => {
  it('if the host takes neither strict schemas nor images, it falls back to json_object without photos and remembers it', async () => {
    const bodies: { response_format: { type: string }; messages: { content: unknown }[] }[] = []
    const fetch = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string)
      bodies.push(body)
      if (body.response_format.type === 'json_schema') return rejection('Field "response_format" must be an object with type "json_object" or "text"')
      if (JSON.stringify(body.messages).includes('image_url')) return rejection('Only text content blocks are supported; image blocks are rejected')
      return ok(answer)
    })
    vi.stubGlobal('fetch', fetch)
    const expert = createCompatible({ provider: 'shellm', host: 'http://127.0.0.1:6100/', apiKey: '', model: 'claude', label: 'SheLLM' })
    const request = { measures: exampleBookcase.dimensions, photos: [{ angle: 'front', base64: 'AAA' }], notes: '', reading: null, catalog: testCatalog, correction: null }

    const r = await expert.reconstruct(request, new AbortController().signal)
    expect(r.value.design.name).toBe('Librero')
    expect(bodies.map((c) => c.response_format.type)).toEqual(['json_schema', 'json_object', 'json_object'])
    expect(JSON.stringify(bodies[2].messages)).toContain('cannot see them')
    expect(JSON.stringify(bodies[2].messages[0])).toContain('JSON Schema')
    expect(fetch.mock.calls[0][0]).toBe('http://127.0.0.1:6100/v1/chat/completions')

    await expert.reconstruct(request, new AbortController().signal)
    expect(bodies).toHaveLength(4)
  })

  it('builds the request: text and image interleaved in order, JPEG data URL and strict json_schema', async () => {
    let body: { messages: { role: string; content: { type: string; text?: string; image_url?: { url: string } }[] }[]; response_format: { type: string; json_schema: { name: string; strict: boolean } } } | null = null
    vi.stubGlobal('fetch', async (_: string, init: RequestInit) => ((body = JSON.parse(init.body as string)), ok(answer)))
    await fresh().reconstruct(request([{ angle: 'front', base64: 'AAA' }, { angle: 'three-quarter', base64: 'BBB' }]), new AbortController().signal)
    const parts = body!.messages[1].content
    expect(parts.map((p) => p.text ?? p.image_url?.url)).toEqual([
      expect.stringContaining('Furniture measures'),
      'Photo 1: front',
      'data:image/jpeg;base64,AAA',
      'Photo 2: three-quarter',
      'data:image/jpeg;base64,BBB',
    ])
    expect(body!.response_format).toMatchObject({ type: 'json_schema', json_schema: { name: 'reconstruction', strict: true } })
  })

  it('a 413 with photos retries without them and tells the person', async () => {
    const kinds: boolean[] = []
    vi.stubGlobal('fetch', async (_: string, init: RequestInit) => {
      const withImage = (init.body as string).includes('image_url')
      kinds.push(withImage)
      return withImage ? rejection('Payload Too Large', 413) : ok(answer)
    })
    const r = await fresh().reconstruct(request(), new AbortController().signal)
    expect(kinds).toEqual([true, false])
    expect(r.warnings).toEqual([expect.stringContaining('SheLLM no aceptó las fotos')])
  })

  it('a 400 about neither response_format nor images does not fall back: it is reported', async () => {
    const fetch = vi.fn(async () => rejection('Field "model" is required'))
    vi.stubGlobal('fetch', fetch)
    await expect(fresh().reconstruct(request(), new AbortController().signal)).rejects.toThrow('Field "model" is required')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('a 413 without photos cannot be solved by dropping them: it is reported', async () => {
    vi.stubGlobal('fetch', async () => rejection('Payload Too Large', 413))
    await expect(fresh().reconstruct(request([]), new AbortController().signal)).rejects.toThrow('413')
  })

  it('if SheLLM does not answer, it says what to check: that it runs and the origin is in its CORS', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    await expect(fresh().reconstruct(request(), new AbortController().signal)).rejects.toThrow(/SheLLM en http:\/\/127\.0\.0\.1:\d+.*SHELLM_CORS_ORIGINS/)
  })

  it('if the GET answers but the POST does not go out, it points to the POST CORS and says the size', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => (init?.method === 'POST' ? Promise.reject(new TypeError('Failed to fetch')) : new Response('{"data":[]}', { status: 200 }))))
    await expect(fresh().reconstruct(request([]), new AbortController().signal)).rejects.toThrow(/SheLLM responde.*\(\d+ KB\).*Content-Type y Authorization/)
  })

  it('a 504 from the host is explained as a time limit, not as no connection', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('upstream timeout', { status: 504 })))
    await expect(fresh().reconstruct(request([]), new AbortController().signal)).rejects.toThrow(/SheLLM cortó la petición a los \d+ s.*sube TIMEOUT_MS de SheLLM/)
  })

  it('asks for a stream and builds the answer from the SSE pieces, trailing comments included', async () => {
    const text = JSON.stringify(answer)
    const half = Math.floor(text.length / 2)
    const sse = [
      ': queued 1\n\n',
      `data: ${JSON.stringify({ choices: [{ delta: { content: text.slice(0, half) } }] })}\n\n`,
      // An event split across two reads is joined before it is parsed.
      `data: ${JSON.stringify({ choices: [{ delta: { content: text.slice(half) }, finish_reason: 'stop' }] })}`.slice(0, 20),
      `data: ${JSON.stringify({ choices: [{ delta: { content: text.slice(half) }, finish_reason: 'stop' }] })}\n\n`.slice(20),
      `data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 900, completion_tokens: 3100 } })}\n\n`,
      'data: [DONE]\n\n',
    ]
    const bodies: { stream?: boolean; stream_options?: unknown }[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        bodies.push(JSON.parse(init.body as string))
        const body = new ReadableStream({ start: (c) => (sse.forEach((x) => c.enqueue(new TextEncoder().encode(x))), c.close()) })
        return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } })
      }),
    )
    const r = await fresh().reconstruct(request([]), new AbortController().signal)
    expect(r.value.design.name).toBe('Librero')
    expect(r.usage).toEqual({ inputTokens: 900, outputTokens: 3100 })
    expect(bodies[0]).toMatchObject({ stream: true, stream_options: { include_usage: true } })
  })

  it('a stream cut without [DONE] or finish_reason is reported as a cut, not as invalid JSON', async () => {
    const sse = [`data: ${JSON.stringify({ choices: [{ delta: { content: '{"explanation":"Veo un' } }] })}\n\n`]
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream({ start: (c) => (sse.forEach((x) => c.enqueue(new TextEncoder().encode(x))), c.close()) }), { status: 200, headers: { 'content-type': 'text/event-stream' } })))
    await expect(fresh().reconstruct(request([]), new AbortController().signal)).rejects.toThrow(/se cortó a media respuesta/)
  })

  it('asks for low reasoning and, if the model does not take it, stops asking', async () => {
    const bodies: { reasoning_effort?: string }[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(init.body as string)
        bodies.push(body)
        return body.reasoning_effort ? rejection("Unsupported parameter: 'reasoning_effort' is not supported with this model.") : ok(answer)
      }),
    )
    const expert = fresh()
    await expert.reconstruct(request([]), new AbortController().signal)
    await expert.reconstruct(request([]), new AbortController().signal)
    expect(bodies.map((c) => c.reasoning_effort ?? null)).toEqual(['low', null, null])
  })

  it('if two attempts arrive stuck together, the first wrapped as text, it keeps the good one', async () => {
    const text = JSON.stringify(answer)
    const attempts = `${JSON.stringify({ $PARAMETER_NAME: JSON.stringify(answer, null, 2) })}${text}`
    vi.stubGlobal('fetch', vi.fn(async () => withText(attempts)))
    const r = await fresh().reconstruct(request([]), new AbortController().signal)
    expect(r.value.design.name).toBe('Librero')
  })

  it('a raw newline inside a string does not break the answer', async () => {
    const text = JSON.stringify({ ...answer, explanation: 'Veo un librero__BREAK__con zoclo' }).replace('__BREAK__', '\n\t')
    vi.stubGlobal('fetch', vi.fn(async () => withText(text)))
    const r = await fresh().reconstruct(request([]), new AbortController().signal)
    expect(r.value.explanation).toBe('Veo un librero\n\tcon zoclo')
  })

  it('a single attempt wrapped as text is unwrapped too', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok({ $PARAMETER_NAME: JSON.stringify(answer) })))
    const r = await fresh().reconstruct(request([]), new AbortController().signal)
    expect(r.value.explanation).toBe('Veo un librero')
  })

  it('invalid JSON says how much arrived and how it ends, to tell a cut apart', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"explanation": "Veo un buró", "design": {"dimensions": {"height": 500}, "pieces": [' } }] }), { status: 200 })))
    await expect(fresh().reconstruct(request([]), new AbortController().signal)).rejects.toThrow(/JSON inválido \(\d+ caracteres, termina en «.*pieces": \[»\)/)
  })

  it('if the host does not take streams, it stops asking and remembers it', async () => {
    const bodies: { stream?: boolean }[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(init.body as string)
        bodies.push(body)
        return body.stream ? rejection('Unknown parameter: stream_options') : ok(answer)
      }),
    )
    const expert = fresh()
    await expert.reconstruct(request([]), new AbortController().signal)
    await expert.reconstruct(request([]), new AbortController().signal)
    expect(bodies.map((c) => c.stream ?? false)).toEqual([true, false, false])
  })

  it('sends the key only when there is one', async () => {
    const fetch = vi.fn(async () => ok(answer))
    vi.stubGlobal('fetch', fetch)
    await createCompatible({ provider: 'openai', host: 'https://api.openai.com', apiKey: 'sk-x', model: 'gpt', label: 'OpenAI' }).reconstruct(
      { measures: exampleBookcase.dimensions, photos: [], notes: '', reading: null, catalog: testCatalog, correction: null },
      new AbortController().signal,
    )
    expect((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].headers).toMatchObject({ authorization: 'Bearer sk-x' })
  })
})
