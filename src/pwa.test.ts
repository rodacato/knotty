import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'

const script = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')
const origin = 'https://rodacato.github.io'
type FetchEvent = { request: Request; respondWith: (response: Promise<Response>) => void }

function worker() {
  const stored = new Map<string, Response>()
  const events: Record<string, (event: FetchEvent) => void> = {}
  let network: Response | null = new Response('APP')
  const key = (r: Request | string) => new URL(typeof r === 'string' ? r : r.url, `${origin}/knotty/`).href
  runInNewContext(script, {
    URL, Response,
    self: { location: new URL(`${origin}/knotty/sw.js`), addEventListener: (name: string, cb: (e: FetchEvent) => void) => { events[name] = cb } },
    fetch: async () => { if (!network) throw new Error('offline'); return network.clone() },
    caches: {
      open: async () => ({ put: async (r: Request | string, response: Response) => { stored.set(key(r), response) } }),
      match: async (r: Request | string) => stored.get(key(r))?.clone(),
    },
  })
  return {
    offline: () => { network = null },
    navigate: async (path: string, body?: string, status = 200) => {
      if (body !== undefined) network = new Response(body, { status })
      const request = new Request(`${origin}${path}`)
      Object.defineProperty(request, 'mode', { value: 'navigate' })
      let response: Promise<Response> | undefined
      events.fetch({ request, respondWith: (r) => { response = r } })
      return (await response)!
    },
  }
}

describe('offline page identity under the GitHub Pages base path', () => {
  it('keeps the app, presentation and guide in separate documents', async () => {
    const w = worker()
    await w.navigate('/knotty/?ficha=KC-APA-01', 'APP')
    await w.navigate('/knotty/presentacion/', 'PRESENTATION')
    await w.navigate('/knotty/marca/', 'GUIDE')
    w.offline()
    expect(await (await w.navigate('/knotty/')).text()).toBe('APP')
    expect(await (await w.navigate('/knotty/index.html')).text()).toBe('APP')
    expect(await (await w.navigate('/knotty/?q=librero')).text()).toBe('APP')
    expect(await (await w.navigate('/knotty/presentacion/')).text()).toBe('PRESENTATION')
    expect(await (await w.navigate('/knotty/marca/')).text()).toBe('GUIDE')
  })

  it('does not replace a cached document with a failed page request', async () => {
    const w = worker()
    await w.navigate('/knotty/', 'APP')
    await w.navigate('/knotty/', 'NOT FOUND', 404)
    w.offline()
    expect(await (await w.navigate('/knotty/')).text()).toBe('APP')
    expect((await w.navigate('/knotty/missing/')).status).toBe(503)
  })
})
