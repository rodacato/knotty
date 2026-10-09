import type { Room } from '../../domain/furniture/references'
import { ANY, plain, ROOM_LABELS, type CatalogQuery } from './catalog'

const TEXT = 'q'
const ROOM = 'cuarto'
const SLUGS: [Room, string][] = ROOM_LABELS.map(([room, label]) => [room, plain(label)])

/** What the home is filtered by, as the address says it: `?q=escritorio&cuarto=oficina`. */
export function browsingFrom(search: string): CatalogQuery {
  const params = new URLSearchParams(search)
  const slug = plain(params.get(ROOM) ?? '')
  return { text: params.get(TEXT) ?? ANY.text, room: SLUGS.find(([, s]) => s === slug)?.[0] ?? ANY.room }
}

/** The address with the home's filter in it, and whatever else it had. */
export function searchWith(search: string, { text, room }: CatalogQuery): string {
  const params = new URLSearchParams(search)
  params.delete(TEXT)
  params.delete(ROOM)
  if (text.trim()) params.set(TEXT, text.trim())
  const slug = SLUGS.find(([r]) => r === room)?.[1]
  if (slug) params.set(ROOM, slug)
  const said = params.toString()
  return said ? `?${said}` : ''
}
