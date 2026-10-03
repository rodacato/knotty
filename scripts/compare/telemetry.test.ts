import { afterEach, describe, expect, it } from 'vitest'
import { createSimulated } from '../../src/adapters/llm/simulated/simulated'
import { createTelemetry, identityOfBody } from './telemetry'

// Built at run time so the file holds no key-shaped literal for a secret scanner to flag.
const KEY = ['sk', 'live', '0123456789abcdefghijklmnop'].join('-')

const jsonAnswer = (headers: Record<string, string> = {}) =>
  new Response(JSON.stringify({ id: 'chatcmpl-1', model: 'claude-sonnet-5-20261001', choices: [] }), { status: 200, headers: { 'content-type': 'application/json', ...headers } })

const sseAnswer = () =>
  new Response('data: {"id":"chunk-9","model":"gpt-5-2026","choices":[{"delta":{"content":"a"}}]}\n\ndata: {"choices":[],"usage":{}}\n\ndata: [DONE]\n\n', { status: 200, headers: { 'content-type': 'text/event-stream' } })

const original = globalThis.fetch
afterEach(() => void (globalThis.fetch = original))

describe('telemetry', () => {
  it('records status, timings, model and id of a call, tied to its job', async () => {
    const clock = [0, 40, 100]
    const t = createTelemetry({ fetch: async () => jsonAnswer({ 'x-request-id': 'req-7' }), now: () => clock.shift() ?? 100 })
    const response = await t.run('job-a', () => t.fetch('https://shellm.example.com:8443/v1/chat/completions?token=abc', { method: 'POST', headers: { authorization: `Bearer ${KEY}` }, body: '{}' }), 2)
    expect((await response.json()).model).toBe('claude-sonnet-5-20261001')
    const [call] = await t.take('job-a')
    expect(call).toMatchObject({ host: 'shellm.example.com:8443', call: 2, status: 200, ttfbMs: 40, totalMs: 100, responseModel: 'claude-sonnet-5-20261001', requestId: 'chatcmpl-1', headersAllowlisted: { 'x-request-id': 'req-7' } })
    expect(t.effectiveModels()).toEqual(['claude-sonnet-5-20261001'])
    expect(await t.take('job-a')).toEqual([])
  })

  it('keeps only allowlisted headers and never a credential, in the record or anywhere in it', async () => {
    const t = createTelemetry({
      fetch: async () => jsonAnswer({ 'set-cookie': 'session=abc', 'x-api-key': KEY, authorization: `Bearer ${KEY}`, 'x-ratelimit-remaining-requests': '9', 'x-queue-position': '3', 'content-length': '99', server: 'cloudflare' }),
    })
    await t.run('job-a', () => t.fetch('https://api.example.com/v1/x', { headers: { authorization: `Bearer ${KEY}` } }))
    const taken = await t.take('job-a')
    expect(taken[0].headersAllowlisted).toEqual({ 'x-ratelimit-remaining-requests': '9', 'x-queue-position': '3' })
    expect(JSON.stringify(taken)).not.toContain(KEY)
    expect(JSON.stringify(taken)).not.toMatch(/bearer|cookie|authorization/i)
  })

  it('reads model and id from the first chunk of a stream and leaves the stream readable for the caller', async () => {
    const t = createTelemetry({ fetch: async () => sseAnswer() })
    const response = await t.run('job-a', () => t.fetch('https://api.example.com/v1/x'))
    expect(await response.text()).toContain('[DONE]')
    const [call] = await t.take('job-a')
    expect(call).toMatchObject({ responseModel: 'gpt-5-2026', requestId: 'chunk-9' })
  })

  it('records nothing for a request outside any job, and does not touch what the caller gets back', async () => {
    const t = createTelemetry({ fetch: async () => jsonAnswer() })
    const response = await t.fetch('https://api.example.com/v1/x')
    expect(response.status).toBe(200)
    expect(await t.take('job-a')).toEqual([])
    expect(t.effectiveModels()).toEqual([])
  })

  it('keeps jobs apart when they run at the same time', async () => {
    const t = createTelemetry({ fetch: async () => jsonAnswer() })
    await Promise.all(['a', 'b', 'c'].map((id) => t.run(id, () => t.fetch('https://x.example.com/'))))
    expect((await Promise.all(['a', 'b', 'c'].map((id) => t.take(id)))).map((r) => r.length)).toEqual([1, 1, 1])
  })

  it('wraps the global fetch when installed and puts it back when removed', async () => {
    globalThis.fetch = async () => jsonAnswer()
    const base = globalThis.fetch
    const t = createTelemetry()
    t.install()
    expect(globalThis.fetch).not.toBe(base)
    await t.run('job-a', () => globalThis.fetch('https://x.example.com/'))
    expect(await t.take('job-a')).toHaveLength(1)
    t.uninstall()
    expect(globalThis.fetch).toBe(base)
  })

  it('numbers the calls of a provider within its job', async () => {
    const t = createTelemetry({ fetch: async () => jsonAnswer() })
    const simulated = createSimulated(0)
    const inner = {
      ...simulated,
      proposeAdjustment: async (...args: Parameters<typeof simulated.proposeAdjustment>) => {
        await t.fetch('https://x.example.com/')
        return simulated.proposeAdjustment(...args)
      },
    }
    const wrapped = t.provider(inner, 'job-a')
    const request = { design: null } as unknown as Parameters<typeof simulated.proposeAdjustment>[0]
    await wrapped.proposeAdjustment(request, new AbortController().signal).catch(() => undefined)
    await wrapped.proposeAdjustment(request, new AbortController().signal).catch(() => undefined)
    expect((await t.take('job-a')).map((r) => r.call)).toEqual([0, 1])
  })
})

describe('identityOfBody', () => {
  it('finds Anthropic stream starts and tolerates anything else', () => {
    expect(identityOfBody('event: message_start\ndata: {"type":"message_start","message":{"id":"msg_1","model":"claude-x"}}\n', true)).toEqual({ model: 'claude-x', id: 'msg_1' })
    expect(identityOfBody('not json', false)).toEqual({ model: null, id: null })
    expect(identityOfBody('data: nope\ndata: {"model":"m"}\n', true)).toEqual({ model: 'm', id: null })
  })
})
