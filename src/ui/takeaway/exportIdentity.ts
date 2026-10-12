import { currentDesign, type DesignState } from '../../domain/session/state'

export type ExportMode = 'complete' | 'yard' | 'assembly'
export const EXPORT_MODES: Record<ExportMode, string> = { complete: 'Guía completa', yard: 'Para la maderería', assembly: 'Para armar' }

/** The actual saved origin is kept separate from the current design revision. */
export function exportIdentity(state: DesignState, mode: ExportMode, date: Date) {
  const design = currentDesign(state)
  const origin = state.ficha ? `${state.ficha.code} · ficha v${state.ficha.version}` : 'Diseño propio · sin ficha de origen registrada'
  const slug = design.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'mueble'
  const day = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
  const file = `Knotty_${state.ficha ? `${state.ficha.code}_ficha-v${state.ficha.version}_` : ''}${slug}_diseno-v${state.current}_${mode}_${day}`
  return { origin, file, day }
}
