import { afterEach, describe, expect, it, vi } from 'vitest'
import { exampleBookcase } from '../../domain/furniture/fixtures/bookcase'
import { testCatalog } from '../../domain/furniture/fixtures/catalog.test-util'
import { createAnthropic, readTokens, type Effort } from './anthropic'

afterEach(() => vi.unstubAllGlobals())

describe('input tokens', () => {
  it('count what came from the cache and what went into it: the system prompt is cached', () => {
    expect(readTokens({ input_tokens: 400, cache_read_input_tokens: 2500, cache_creation_input_tokens: 0 })).toBe(2900)
    expect(readTokens({ input_tokens: 400, cache_read_input_tokens: null, cache_creation_input_tokens: 2500 })).toBe(2900)
    expect(readTokens({ input_tokens: 2900 })).toBe(2900)
  })
})

describe('a schema the API cannot compile', () => {
  it('is asked again with the schema in the prompt, and every later call skips the strict format', async () => {
    const bodies: Record<string, unknown>[] = []
    const reply = (message: string) => new Response(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message } }), { status: 400, headers: { 'content-type': 'application/json' } })
    vi.stubGlobal('fetch', async (_: unknown, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)))
      return reply(bodies.length === 1 ? 'The compiled grammar is too large, which would cause performance issues. Simplify your tool schemas or reduce the number of strict tools.' : 'stop here')
    })
    const expert = createAnthropic('sk-test', 'claude-haiku-5-5')
    const review = () => expert.reviewPurchase({ context: '', review: '', design: exampleBookcase, checks: [], catalog: testCatalog }, new AbortController().signal).catch((e: unknown) => e)

    expect(await review()).toMatchObject({ message: expect.stringMatching(/stop here/) })
    expect(await review()).toMatchObject({ message: expect.stringMatching(/stop here/) })

    const system = (b: Record<string, unknown>) => (b.system as { text: string }[])[0].text
    expect(bodies).toHaveLength(3)
    expect(bodies[0].output_config).toBeDefined()
    expect(system(bodies[0])).not.toContain('# Output format')
    for (const later of bodies.slice(1)) {
      expect((later.output_config as { format?: unknown } | undefined)?.format).toBeUndefined()
      expect(system(later)).toContain('# Output format')
      expect(system(later)).toContain(JSON.stringify((bodies[0].output_config as { format: { schema: unknown } }).format.schema))
    }
  })
})

describe('the effort', () => {
  const sent = async (effort?: Effort, model = 'claude-sonnet-5-5') => {
    let body: Record<string, unknown> = {}
    vi.stubGlobal('fetch', async (_: unknown, init?: RequestInit) => {
      body = JSON.parse(String(init?.body))
      return new Response(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'stop here' } }), { status: 400, headers: { 'content-type': 'application/json' } })
    })
    await createAnthropic('sk-test', model, { effort }).reviewPurchase({ context: '', review: '', design: exampleBookcase, checks: [], catalog: testCatalog }, new AbortController().signal).catch(() => null)
    return { effort: (body.output_config as { effort?: string } | undefined)?.effort, thinking: body.thinking }
  }

  it('is the model default when none is given: the request names neither effort nor thinking', async () => {
    expect(await sent()).toEqual({ effort: undefined, thinking: undefined })
  })

  it('is low for Haiku 5.5 unless one is chosen: it designs as well as at medium, faster', async () => {
    expect(await sent(undefined, 'claude-haiku-5-5')).toEqual({ effort: 'low', thinking: undefined })
    expect(await sent('medium', 'claude-haiku-5-5')).toEqual({ effort: 'medium', thinking: undefined })
  })

  it('goes in the output config', async () => {
    expect(await sent('low')).toEqual({ effort: 'low', thinking: undefined })
  })

  it('off turns the thinking off and names no effort', async () => {
    expect(await sent('off')).toEqual({ effort: undefined, thinking: { type: 'disabled' } })
  })
})

describe('a stream that goes quiet', () => {
  const event = (data: object) => `event: ${(data as { type: string }).type}\ndata: ${JSON.stringify(data)}\n\n`
  const start = event({ type: 'message_start', message: { id: 'm', type: 'message', role: 'assistant', model: 'claude-haiku-5-5', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } } })
  const answer = JSON.stringify({ verdict: 'needs-changes', summary: 'Sube la repisa', problems: [], tips: ['Mide el espesor'] })
  const chunks = [
    start,
    event({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }),
    ...[answer.slice(0, 30), answer.slice(30, 60), answer.slice(60)].map((text) => event({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } })),
    event({ type: 'content_block_stop', index: 0 }),
    event({ type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 20 } }),
    event({ type: 'message_stop' }),
  ]
  /** Sends each chunk `gapMs` apart; with `stallAfter`, sends that many and then nothing, until the request is aborted. */
  const streaming = (gapMs: number, stallAfter?: number) => async (_: unknown, init?: RequestInit) => {
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        init?.signal?.addEventListener('abort', () => controller.error(new DOMException('aborted', 'AbortError')))
        for (const chunk of chunks.slice(0, stallAfter)) {
          if (init?.signal?.aborted) return
          controller.enqueue(new TextEncoder().encode(chunk))
          await new Promise((r) => setTimeout(r, gapMs))
        }
        if (stallAfter === undefined) controller.close()
      },
    })
    return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } })
  }
  const review = (signal = new AbortController().signal) =>
    createAnthropic('sk-test', 'claude-haiku-5-5', { idleMs: 100 }).reviewPurchase({ context: '', review: '', design: exampleBookcase, checks: [], catalog: testCatalog }, signal)

  it('is cut with the timeout message instead of waiting forever', async () => {
    vi.stubGlobal('fetch', streaming(10, 1))
    expect(await review().catch((e: unknown) => e)).toMatchObject({ message: 'El proveedor tardó demasiado en responder.' })
  })

  it('is not cut while it keeps sending, however long the whole answer takes', async () => {
    vi.stubGlobal('fetch', streaming(40))
    expect((await review()).value.summary).toBe('Sube la repisa')
  })

  it('still reads as cancelled when the person stops it', async () => {
    vi.stubGlobal('fetch', streaming(10, 1))
    const stop = new AbortController()
    setTimeout(() => stop.abort(), 30)
    expect(await review(stop.signal).catch((e: unknown) => e)).toMatchObject({ name: 'AbortError', message: 'Cancelado.' })
  })
})

describe('a call the caller stops', () => {
  it('comes out as an AbortError, which is how the bench tells cancelled from failed', async () => {
    const pending = (_: unknown, init?: RequestInit) => new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))
    vi.stubGlobal('fetch', pending)
    const stop = new AbortController()
    const asking = createAnthropic('sk-test', 'claude-sonnet-4-5').reviewPurchase({ context: '', review: '', design: exampleBookcase, checks: [], catalog: testCatalog }, stop.signal)
    setTimeout(() => stop.abort(), 50)
    expect(await asking.catch((e: unknown) => e)).toMatchObject({ name: 'AbortError' })
  })
})
