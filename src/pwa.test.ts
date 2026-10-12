import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'

const script = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')
const origin = 'https://rodacato.github.io'
type FetchEvent = { request: Request; respondWith: (response: Promise<Response>) => void }

function worker() {
  const cachesByName = new Map<string, Map<string, Response>>()
  const events: Record<string, (event: FetchEvent) => void> = {}
  let network: Response | null = new Response('APP')
  const key = (r: Request | string) => new URL(typeof r === 'string' ? r : r.url, `${origin}/knotty/`).href
  runInNewContext(script, {
    URL, Response,
    self: { location: new URL(`${origin}/knotty/sw.js`), addEventListener: (name: string, cb: (e: FetchEvent) => void) => { events[name] = cb } },
    fetch: async () => { if (!network) throw new Error('offline'); return network.clone() },
    caches: {
      open: async (name: string) => {
        if (!cachesByName.has(name)) cachesByName.set(name, new Map())
        const stored = cachesByName.get(name)!
        return { put: async (r: Request | string, response: Response) => { stored.set(key(r), response) }, match: async (r: Request | string) => stored.get(key(r))?.clone() }
      },
      match: async (r: Request | string) => { for (const stored of cachesByName.values()) { const response = stored.get(key(r)); if (response) return response.clone() } },
    },
  })
  const respond = async (path: string, body: string | undefined, status: number, navigate: boolean) => {
    if (body !== undefined) network = new Response(body, { status })
    const request = new Request(`${origin}${path}`)
    if (navigate) Object.defineProperty(request, 'mode', { value: 'navigate' })
    let response: Promise<Response> | undefined
    events.fetch({ request, respondWith: (r) => { response = r } })
    return (await response)!
  }
  return {
    offline: () => { network = null },
    navigate: (path: string, body?: string, status = 200) => respond(path, body, status, true),
    asset: (path: string, body?: string, status = 200) => respond(path, body, status, false),
    old: (path: string, body: string) => { if (!cachesByName.has('knotty-v3:/knotty/')) cachesByName.set('knotty-v3:/knotty/', new Map()); cachesByName.get('knotty-v3:/knotty/')!.set(key(path), new Response(body)) },
  }
}

describe('offline page identity under the GitHub Pages base path', () => {
  it('keeps the landing, catalog, presentation alias and guide in separate documents', async () => {
    const w = worker()
    await w.navigate('/knotty/', 'LANDING')
    await w.navigate('/knotty/catalogo/?ficha=KC-APA-01', 'APP')
    await w.navigate('/knotty/presentacion/', 'PRESENTATION')
    await w.navigate('/knotty/marca/', 'GUIDE')
    w.offline()
    expect(await (await w.navigate('/knotty/')).text()).toBe('LANDING')
    expect(await (await w.navigate('/knotty/index.html')).text()).toBe('LANDING')
    expect(await (await w.navigate('/knotty/catalogo/index.html')).text()).toBe('APP')
    expect(await (await w.navigate('/knotty/catalogo/?q=librero')).text()).toBe('APP')
    expect(await (await w.navigate('/knotty/presentacion/')).text()).toBe('PRESENTATION')
    expect(await (await w.navigate('/knotty/marca/')).text()).toBe('GUIDE')
  })

  it('does not serve the old root app document over the new landing after an upgrade', async () => {
    const w = worker()
    w.old('/knotty/', 'OLD APP')
    w.old('/knotty/assets/old-hash.js', 'PREVIOUS ASSET')
    await w.navigate('/knotty/', 'LANDING')
    await w.navigate('/knotty/catalogo/', 'CATALOG')
    w.offline()
    expect(await (await w.navigate('/knotty/')).text()).toBe('LANDING')
    expect(await (await w.navigate('/knotty/catalogo/')).text()).toBe('CATALOG')
    expect(await (await w.asset('/knotty/assets/old-hash.js')).text()).toBe('PREVIOUS ASSET')
  })

  it('does not replace a cached document with a failed page request', async () => {
    const w = worker()
    await w.navigate('/knotty/', 'APP')
    await w.navigate('/knotty/', 'NOT FOUND', 404)
    w.offline()
    expect(await (await w.navigate('/knotty/')).text()).toBe('APP')
    expect((await w.navigate('/knotty/missing/')).status).toBe(503)
  })

  it('refreshes cached brand downloads online and preserves the last good export offline', async () => {
    const w = worker()
    const kit = '/knotty/brand/knotty-brand-kit.zip'
    expect(await (await w.asset(kit, 'OLD KIT')).text()).toBe('OLD KIT')
    expect(await (await w.asset(kit, 'CURRENT KIT')).text()).toBe('CURRENT KIT')
    expect((await w.asset(kit, 'NOT FOUND', 404)).status).toBe(404)
    w.offline()
    expect(await (await w.asset(kit)).text()).toBe('CURRENT KIT')
  })
})
