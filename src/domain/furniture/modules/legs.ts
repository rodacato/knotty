import { z } from 'zod'
import type { Piece } from '../../design/schema'
import { LEG_APRON, LEG_FOOT, LEG_WIDTH } from './common'
import { choice, fromLabels, type FieldSpec } from './fields'
import type { Labels } from './module'

// How the legs under a piece of furniture are cut. Every module with legs takes it the same way.

export const LegStyle = z.enum(['straight', 'tapered'])
export type LegStyle = z.infer<typeof LegStyle>

export const LEG_STYLE_LABELS = {
  straight: { option: 'Rectas', phrase: 'patas rectas' },
  tapered: { option: 'Cónicas', phrase: 'patas cónicas' },
} satisfies Labels<LegStyle>

export const LEG_STYLE = 'Legs: straight (default) or tapered'

/** A leg cut to its style. Tapered, its inner side slants from under the apron to the foot: the apron keeps a square face to meet. */
export const styled = (layers: Piece[], style: LegStyle | undefined, inner: 'start' | 'end'): Piece[] =>
  style === 'tapered' ? layers.map((p) => ({ ...p, slants: [{ x: null, y: { from: 'start', leave: LEG_APRON }, z: { from: inner, length: LEG_WIDTH - LEG_FOOT } }] })) : layers

/** How the slanted cuts are made, for the person. */
export const legStyleNote = (style: LegStyle | undefined, legs: number): string[] =>
  style === 'tapered'
    ? [`Patas cónicas en ${legs} ${legs === 1 ? 'pata' : 'patas'}: cada una se adelgaza por dentro, de ${LEG_WIDTH} mm bajo el faldón a ${LEG_FOOT} mm en el piso. Se pegan las dos capas y luego se corta la diagonal, con sierra circular y guía o con plantilla en sierra de mesa. La maderería entrega el rectángulo.`]
    : []

type WithLegStyle = { legStyle?: LegStyle }

/** The plan's field, the same in every module, shown while the furniture stands on legs. */
export const legStyleField = <P extends WithLegStyle>(onLegs: (plan: P) => boolean): FieldSpec<P> =>
  choice<P, LegStyle>({ key: 'legStyle', label: 'Forma de las patas', part: 'Patas', ...fromLabels(LEG_STYLE_LABELS), visibleWhen: onLegs, get: (p) => p.legStyle ?? 'straight', set: (p, legStyle) => ({ ...p, legStyle }) })

export const describeLegStyle = (before: WithLegStyle, after: WithLegStyle): string[] => ((before.legStyle ?? 'straight') === (after.legStyle ?? 'straight') ? [] : [LEG_STYLE_LABELS[after.legStyle ?? 'straight'].phrase])
