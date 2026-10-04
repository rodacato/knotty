import type { Base, BaseCategory } from '../../domain/furniture/examples'

export type CategoryFilter = BaseCategory | 'featured'

export const FILTERS: [CategoryFilter, string][] = [
  ['featured', 'Destacados'],
  ['bedroom', 'Recámara'],
  ['storage', 'Guardar'],
  ['tables', 'Mesas'],
  ['seating', 'Asientos'],
]

const COUNT: Record<BaseCategory, [one: string, many: string]> = {
  bedroom: ['mueble de recámara', 'muebles de recámara'],
  storage: ['mueble para guardar', 'muebles para guardar'],
  tables: ['mesa', 'mesas'],
  seating: ['asiento', 'asientos'],
}

const ONLY_ONE: Record<BaseCategory, string> = {
  bedroom: 'de recámara',
  storage: 'para guardar',
  tables: 'de mesas',
  seating: 'de asientos',
}

/** Featured lists the featured bases in their order; a category lists all of its own, featured or not. */
export const basesOfFilter = (bases: Base[], filter: CategoryFilter): Base[] => bases.filter((b) => (filter === 'featured' ? b.featured : b.category === filter))

export function countLine(shown: number, filter: CategoryFilter): string {
  const noun = filter === 'featured' ? (shown === 1 ? 'destacado' : 'destacados') : COUNT[filter][shown === 1 ? 0 : 1]
  return `${shown} ${noun} · alto × ancho × fondo, en mm`
}

export const onlyOneNote = (shown: number, filter: CategoryFilter): string | null => (shown === 1 && filter !== 'featured' ? `Solo hay una base ${ONLY_ONE[filter]} por ahora.` : null)
