import type { Store } from '../store'

export type Route =
  | { screen: 'room' }
  | { screen: 'catalog'; code?: string }
  | { screen: 'capture' }
  | { screen: 'takeaway' }
  | { screen: 'studio'; panel?: 'materials' | 'notices' | 'history'; side?: 'outside' | 'inside'; part?: string; piece?: string }

/** Fragment names describe views; design data stays in the existing browser repository. */
export function routeFrom(hash: string): Route | null {
  let words: string[]
  try { words = hash.replace(/^#/, '').split('/').map(decodeURIComponent) } catch { return null }
  const [screen, view, detail, part, marker, piece] = words
  if (screen === 'space' && words.length === 1) return { screen: 'room' }
  if (screen === 'catalog') {
    if (words.length === 1) return { screen: 'catalog' }
    return view === 'adjust' && detail && words.length === 3 ? { screen: 'catalog', code: detail } : null
  }
  if (screen === 'design' && words.length === 1) return { screen: 'capture' }
  if (screen === 'takeaway' && words.length === 1) return { screen: 'takeaway' }
  if (screen !== 'studio') return null
  if (words.length === 1 || (view === 'conversation' && words.length === 2)) return { screen: 'studio' }
  const panel = { materials: 'materials', notices: 'notices', history: 'history' } as const
  if (Object.hasOwn(panel, view) && words.length === 2) return { screen: 'studio', panel: panel[view as keyof typeof panel] }
  if (view === 'piece' && detail && words.length === 3) return { screen: 'studio', piece: detail }
  if (view !== 'edit' || (detail !== 'outside' && detail !== 'inside')) return null
  const side = detail
  if (words.length === 3) return { screen: 'studio', side }
  if (part && words.length === 4) return { screen: 'studio', side, part }
  if (part && marker === 'piece' && piece && words.length === 6) return { screen: 'studio', side, part, piece }
  return null
}

export function fragmentOf(s: Store): string {
  if (s.roomOpen) return '#space'
  if (s.phase === 'capture' || s.phase === 'analyzing') return '#design'
  if (s.phase !== 'studio' || !s.state) return s.adjusting?.code ? `#catalog/adjust/${encodeURIComponent(s.adjusting.code)}` : '#catalog'
  if (s.takeAway) return '#takeaway'
  if (s.checkout) return '#studio/materials'
  if (s.editing) {
    const root = `#studio/edit/${s.editing}`
    const part = s.part ? `/${encodeURIComponent(s.part.id)}` : ''
    const piece = s.part && s.selection ? `/piece/${encodeURIComponent(s.selection)}` : ''
    return `${root}${part}${piece}`
  }
  if (s.selection) return `#studio/piece/${encodeURIComponent(s.selection)}`
  if (s.studioOverlay) return `#studio/${s.studioOverlay}`
  return '#studio'
}

export const hasLinkedFicha = (at: Pick<Location, 'search' | 'hash'>) => new URLSearchParams(at.search).has('ficha') || new URLSearchParams(at.hash.slice(1)).has('ficha')

/** Root links from before the catalog move still reach the app, including installed icons with the old start URL. */
export function catalogDestination(at: Pick<Location, 'href' | 'search' | 'hash'>, standalone = false): string | null {
  const query = new URLSearchParams(at.search)
  const appFragment = routeFrom(at.hash)
  if (!standalone && !hasLinkedFicha(at) && !query.has('q') && !query.has('cuarto') && (!appFragment || (appFragment.screen === 'catalog' && !appFragment.code))) return null
  const next = new URL('./catalog/', at.href)
  next.search = at.search
  next.hash = at.hash || (standalone ? '#studio' : '#catalog')
  return next.href
}
