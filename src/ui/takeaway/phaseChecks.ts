import type { Design } from '../../domain/design/schema'

/** A visible checkpoint is a workshop observation, never a load certification. */
export function phaseCheck(id: string, design: Design): string {
  if (id === 'prepare') return 'Todas las piezas están etiquetadas, las caras y el frente marcados; el ensayo en seco cierra y hay acceso para las herramientas.'
  if (id === 'square' || id === 'frame' || id === 'body' || id === 'pedestal') return 'Anota ambas diagonales: ____ / ____ mm. Deben coincidir antes de fijar la escuadra y cerrar las siguientes piezas.'
  if (id === 'legs' || (id === 'base' && design.pieces.some((p) => p.id.startsWith('leg-')))) return 'Las capas de cada pata están alineadas, las parejas espejo identificadas y los apoyos asientan en una superficie plana.'
  if (id === 'base') return 'El zoclo y sus apoyos quedan alineados y asientan en una superficie plana.'
  if (id === 'doors' || id === 'drawers') return 'Cada frente recorre todo su movimiento sin rozar. Las hojas se pueden montar y retirar; las separaciones permanecen libres después del acabado.'
  if (id === 'shelves') return 'Cada repisa asienta en todos sus soportes y se puede retirar sin forzarla.'
  if (id === 'platform') return 'Cada tablilla o panel descansa en sus apoyos; ninguna junta de panel queda suspendida y los herrajes siguen accesibles.'
  if (id === 'install') return design.wallAnchored ? 'Muro identificado, sistema de fijación confirmado e instalado según su fabricante. Anota el modelo del kit: ____.' : 'El mueble está nivelado, todas sus conexiones están firmes y su espacio de uso queda libre.'
  return 'Las uniones cierran, las piezas coinciden con el despiece y se puede seguir sin forzar el montaje.'
}
