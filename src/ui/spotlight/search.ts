import type { Room } from '../../domain/furniture/references'
import { plain, ROOM_LABELS } from '../capture/catalog'

type Listed = { code: string; name: string; rooms: readonly Room[] }

const LABEL = new Map(ROOM_LABELS)

export const roomsLine = ({ rooms }: Listed) => rooms.map((r) => LABEL.get(r)).join(', ')

/** Every word typed is in its name, in a room it goes in or in its model, with or without accents or dashes: «tv sala», «recamara», «KC-LIB-03», «lib03». */
export function found(item: Listed, text: string): boolean {
  const code = plain(item.code)
  const searchable = `${plain(item.name)} ${plain(roomsLine(item))} ${code} ${code.replace(/-/g, '')}`
  return plain(text).split(/\s+/).filter(Boolean).every((w) => searchable.includes(w))
}

export const notFoundNote = (text: string) => `Ningún mueble tiene «${text.trim()}» en su nombre, su cuarto o su modelo.`
