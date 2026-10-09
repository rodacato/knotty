import type { Example } from '../../domain/furniture/examples'
import type { DesignState } from '../../domain/session/state'
import type { Phase } from '../store'

/** A piece of furniture the spotlight asks about before opening it. */
export interface Asking {
  name: string
  code: string | null
  example: Example
}

/** What swapping the furniture throws away, so the spotlight asks first; null when nothing of the person's is lost. */
export type SwapLoss = 'design' | 'capture' | 'analyzing'

const asOpened = (state: DesignState) =>
  !!state.ficha && state.versions.length === 1 && state.chat.every((m) => m.author === 'expert') && !state.tray.length && !state.requirements.length && !state.accepted.length && !Object.keys(state.locks).length && !state.review

export function swapLoss(phase: Phase, state: DesignState | null): SwapLoss | null {
  if (phase === 'analyzing') return 'analyzing'
  if (phase === 'capture') return 'capture'
  if (phase !== 'studio' || !state) return null
  return asOpened(state) ? null : 'design'
}

export const LOSS_NOTE: Record<SwapLoss, string> = {
  design: 'Se borran este diseño, su historial y la conversación. No se puede deshacer.',
  capture: 'Se pierde lo que llevas escrito y las fotos que subiste.',
  analyzing: 'El experto está diseñando tu mueble: se cancela y se pierde.',
}
