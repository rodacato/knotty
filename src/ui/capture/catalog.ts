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
  /** Words of its code or name, in any case, with or without accents or dashes: «lib14», «KC-LIB-14», «escritorio». */
  text: string
}

export const ANY: CatalogQuery = { room: 'all', text: '' }

type Listed = { code: string; name: string; rooms: readonly Room[] }

export const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const searchable = ({ code, name }: Listed) => `${plain(code)} ${plain(code).replace(/-/g, '')} ${plain(name)}`

export function matches(item: Listed, q: CatalogQuery): boolean {
  const words = plain(q.text).split(/\s+/).filter(Boolean)
  return (q.room === 'all' || item.rooms.includes(q.room)) && words.every((w) => searchable(item).includes(w))
}

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

export const noMatchNote = (q: CatalogQuery) => `Ninguna base${q.room === 'all' ? '' : ' de ese cuarto'} tiene «${q.text.trim()}» en su nombre.`
