import type { Example } from '../../domain/furniture/examples'
import type { DesignState } from '../../domain/session/state'
import type { Phase, Store } from '../store'

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

/** `saved`: the open design sits in one of the person's places as it is now, so nothing of it goes away. */
export function swapLoss(phase: Phase, state: DesignState | null, saved = false): SwapLoss | null {
  if (phase === 'analyzing') return 'analyzing'
  if (phase === 'capture') return 'capture'
  if (!state) return null
  return saved || asOpened(state) ? null : 'design'
}

export const lossOf = (s: Pick<Store, 'phase' | 'state' | 'services'>) => swapLoss(s.phase, s.state, s.services?.library.current().saved)

export const LOSS_NOTE: Record<SwapLoss, string> = {
  design: 'Se borran este diseño, su historial y la conversación. Guárdalo en «Mis muebles» o descárgalo antes si lo quieres conservar.',
  capture: 'Se pierde lo que llevas escrito y las fotos que subiste.',
  analyzing: 'El experto está diseñando tu mueble: se cancela y se pierde.',
}
