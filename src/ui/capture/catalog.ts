import type { Room } from '../../domain/furniture/references'

export const ROOM_LABELS: [Room, string][] = [
  ['bedroom', 'Recámara'],
  ['living', 'Sala'],
  ['dining', 'Comedor'],
  ['office', 'Oficina'],
  ['kitchen', 'Cocina'],
  ['entry', 'Entrada'],
  ['workshop', 'Taller'],
]

export interface CatalogQuery {
  room: Room | 'all'
  /** Words of its name, of a room it goes in or of its model, in any case, with or without accents or dashes: «escritorio», «recamara», «KC-LIB-14», «lib14». */
  text: string
}

export const ANY: CatalogQuery = { room: 'all', text: '' }

type Listed = { code: string; name: string; rooms: readonly Room[] }

const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const LABEL = new Map(ROOM_LABELS)

export const roomsLine = ({ rooms }: Pick<Listed, 'rooms'>) => rooms.map((r) => LABEL.get(r)).join(', ')

/** Every word typed is in its name, in a room it goes in or in its model. */
export function found(item: Listed, text: string): boolean {
  const code = plain(item.code)
  const searchable = `${plain(item.name)} ${plain(roomsLine(item))} ${code} ${code.replace(/-/g, '')}`
  return plain(text).split(/\s+/).filter(Boolean).every((w) => searchable.includes(w))
}

export const matches = (item: Listed, q: CatalogQuery) => (q.room === 'all' || item.rooms.includes(q.room)) && found(item, q.text)

/** «Todas» and the rooms that have something, each with how many match the words typed. */
export function roomChips(items: readonly Listed[], q: CatalogQuery): { room: Room | 'all'; label: string; count: number }[] {
  const rooms = ROOM_LABELS.filter(([room]) => items.some((i) => i.rooms.includes(room)))
  return [['all', 'Todas'] as const, ...rooms].map(([room, label]) => ({ room, label, count: items.filter((i) => matches(i, { ...q, room })).length }))
}

const cm = (mm: number) => (mm / 10).toLocaleString('es-MX', { maximumFractionDigits: 1 })

/** A base's size as the capture form asks for the space: width, depth and height, in cm. */
export const sizeLine = ({ width, depth, height }: { width: number; depth: number; height: number }) => ({
  text: `${cm(width)} × ${cm(depth)} × ${cm(height)} cm`,
  spoken: `${cm(width)} de ancho, ${cm(depth)} de fondo, ${cm(height)} de alto, en centímetros`,
})

export const noMatchNote = (q: CatalogQuery) => `Ninguna base${q.room === 'all' ? '' : ' de ese cuarto'} tiene «${q.text.trim()}» en su nombre, su cuarto o su modelo.`

export const notFoundNote = (text: string) => `Ningún mueble tiene «${text.trim()}» en su nombre, su cuarto o su modelo.`
