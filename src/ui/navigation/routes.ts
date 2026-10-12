import type { Store } from '../store'

export type Route =
  | { screen: 'catalog'; code?: string }
  | { screen: 'capture' }
  | { screen: 'takeaway' }
  | { screen: 'studio'; panel?: 'materials' | 'notices' | 'history'; side?: 'outside' | 'inside'; part?: string; piece?: string }

/** Fragment names describe views; design data stays in the existing browser repository. */
export function routeFrom(hash: string): Route | null {
  let words: string[]
  try { words = hash.replace(/^#/, '').split('/').map(decodeURIComponent) } catch { return null }
  const [screen, view, detail, part, marker, piece] = words
  if (screen === 'catalogo') {
    if (words.length === 1) return { screen: 'catalog' }
    return view === 'ajustar' && detail && words.length === 3 ? { screen: 'catalog', code: detail } : null
  }
  if (screen === 'disenar' && words.length === 1) return { screen: 'capture' }
  if (screen === 'para-llevar' && words.length === 1) return { screen: 'takeaway' }
  if (screen !== 'estudio') return null
  if (words.length === 1 || (view === 'conversacion' && words.length === 2)) return { screen: 'studio' }
  const panel = { materiales: 'materials', avisos: 'notices', historial: 'history' } as const
  if (Object.hasOwn(panel, view) && words.length === 2) return { screen: 'studio', panel: panel[view as keyof typeof panel] }
  if (view === 'pieza' && detail && words.length === 3) return { screen: 'studio', piece: detail }
  if (view !== 'editar' || (detail !== 'exterior' && detail !== 'interior')) return null
  const side = detail === 'exterior' ? 'outside' : 'inside'
  if (words.length === 3) return { screen: 'studio', side }
  if (part && words.length === 4) return { screen: 'studio', side, part }
  if (part && marker === 'pieza' && piece && words.length === 6) return { screen: 'studio', side, part, piece }
  return null
}

export function fragmentOf(s: Store): string {
  if (s.phase === 'capture' || s.phase === 'analyzing') return '#disenar'
  if (s.phase !== 'studio' || !s.state) return s.adjusting?.code ? `#catalogo/ajustar/${encodeURIComponent(s.adjusting.code)}` : '#catalogo'
  if (s.takeAway) return '#para-llevar'
  if (s.editing) {
    const root = `#estudio/editar/${s.editing === 'outside' ? 'exterior' : 'interior'}`
    const part = s.part ? `/${encodeURIComponent(s.part.id)}` : ''
    const piece = s.part && s.selection ? `/pieza/${encodeURIComponent(s.selection)}` : ''
    return `${root}${part}${piece}`
  }
  if (s.selection) return `#estudio/pieza/${encodeURIComponent(s.selection)}`
  if (s.studioOverlay) return `#estudio/${s.studioOverlay === 'notices' ? 'avisos' : 'historial'}`
  return s.studioTab === 'materials' ? '#estudio/materiales' : '#estudio'
}

export const hasLinkedFicha = (at: Pick<Location, 'search' | 'hash'>) => new URLSearchParams(at.search).has('ficha') || new URLSearchParams(at.hash.slice(1)).has('ficha')

/** Root links from before the catalog move still reach the app, including installed icons with the old start URL. */
export function catalogDestination(at: Pick<Location, 'href' | 'search' | 'hash'>, standalone = false): string | null {
  const query = new URLSearchParams(at.search)
  const appFragment = routeFrom(at.hash)
  if (!standalone && !hasLinkedFicha(at) && !query.has('q') && !query.has('cuarto') && (!appFragment || (appFragment.screen === 'catalog' && !appFragment.code))) return null
  const next = new URL('./catalogo/', at.href)
  next.search = at.search
  next.hash = at.hash || (standalone ? '#estudio' : '#catalogo')
  return next.href
}
