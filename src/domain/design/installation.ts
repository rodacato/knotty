import { useOf } from './use'
import type { Design } from './schema'

/** A wall cabinet with a physical base stands; its anchor restrains tipping. Other wall cabinets hang. */
export function hangsFromWall(design: Design): boolean {
  return useOf(design) === 'wallCabinet' && !design.pieces.some((p) => p.id.startsWith('leg-') || p.role === 'kick')
}

export function installationLabel(design: Design): string {
  return hangsFromWall(design) ? 'Colgado del muro' : design.wallAnchored ? 'Apoyado, con anclaje antivuelco' : 'Apoyado en el piso'
}
