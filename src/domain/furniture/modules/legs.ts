import { z } from 'zod'
import type { Piece } from '../../design/schema'
import { LEG_APRON, LEG_FOOT, LEG_LEAN, LEG_WIDTH } from './common'
import { choice, fromLabels, type FieldSpec } from './fields'
import type { Labels } from './module'

// How the legs under a piece of furniture are cut. Every module with legs takes it the same way.

export const LegStyle = z.enum(['straight', 'tapered'])
export type LegStyle = z.infer<typeof LegStyle>
/** Under a box the legs stand back from its edges, so they have room to lean out to them: a module whose legs do takes this one. */
export const LeaningLegStyle = z.enum([...LegStyle.options, 'splayed'])
export type LeaningLegStyle = z.infer<typeof LeaningLegStyle>

export const LEG_STYLE_LABELS = {
  straight: { option: 'Rectas', phrase: 'patas rectas' },
  tapered: { option: 'Cónicas', phrase: 'patas cónicas' },
} satisfies Labels<LegStyle>
export const LEANING_LEG_STYLE_LABELS = { ...LEG_STYLE_LABELS, splayed: { option: 'Abiertas', phrase: 'patas abiertas' } } satisfies Labels<LeaningLegStyle>

export const LEG_STYLE = 'Legs: straight (default) or tapered'
export const LEANING_LEG_STYLE = 'Legs: straight (default), tapered, or splayed: leaning outward and narrowing to the foot'

/**
 * A leg cut to its style. Tapered, its inner side slants from the floor up to what holds the leg, which keeps a square face to meet:
 * `straight` is how much of the top of the leg that is, an apron unless the module says.
 */
export const styled = (layers: Piece[], style: LegStyle | undefined, inner: 'start' | 'end', straight: number = LEG_APRON): Piece[] =>
  style === 'tapered' ? layers.map((p) => ({ ...p, slants: [{ x: null, y: { from: 'start', leave: straight }, z: { from: inner, length: LEG_WIDTH - LEG_FOOT } }] })) : layers

/**
 * A leg that leans outward, cut from a board LEG_LEAN wider than a straight leg, which its layers already are: the outer side slants from the foot in to the top,
 * and the inner one from under the apron out to the foot. Its top is where a straight leg's is, so it meets the same boards; its foot stands LEG_LEAN further out.
 */
export const splayed = (layers: Piece[], inner: 'start' | 'end'): Piece[] => {
  const outer = inner === 'start' ? 'end' : 'start'
  return layers.map((p) => ({ ...p, slants: [{ x: null, y: { from: 'end', leave: 0 }, z: { from: outer, length: LEG_LEAN } }, { x: null, y: { from: 'start', leave: LEG_APRON }, z: { from: inner, length: LEG_WIDTH + LEG_LEAN - LEG_FOOT } }] }))
}

/** How many legs of a design are cut to a style, and how many of them lean: a leg is two layers, counted once. */
export const styledLegs = (pieces: Piece[]) => {
  const legs = (cuts: number) => new Set(pieces.filter((p) => p.id.startsWith('leg-') && (p.slants?.length ?? 0) >= cuts).map((p) => p.id.replace(/-\d$/, ''))).size
  return { cut: legs(1), leaning: legs(2) }
}

/** How the slanted cuts are made, for the person; `under` is what holds the leg, where its taper starts. */
export const legStyleNote = ({ cut, leaning }: ReturnType<typeof styledLegs>, under = 'el faldón'): string[] => [
  ...(leaning ? [`Patas abiertas en ${leaning} ${leaning === 1 ? 'pata' : 'patas'}: cada una sale de una tabla de ${LEG_WIDTH + LEG_LEAN} mm de ancho. Por fuera se corta en diagonal de arriba al piso, para que el pie quede ${LEG_LEAN} mm más afuera; por dentro, de abajo del faldón al piso, para que el pie mida ${LEG_FOOT} mm. Se pegan las dos capas y luego se cortan las dos diagonales, con sierra circular y guía. La maderería entrega el rectángulo.`] : []),
  ...taperNote(cut - leaning, under),
]
const taperNote = (legs: number, under: string): string[] =>
  legs
    ? [`Patas cónicas en ${legs} ${legs === 1 ? 'pata' : 'patas'}: cada una se adelgaza por dentro, de ${LEG_WIDTH} mm bajo ${under} a ${LEG_FOOT} mm en el piso. Se pegan las dos capas y luego se corta la diagonal, con sierra circular y guía o con plantilla en sierra de mesa. La maderería entrega el rectángulo.`]
    : []

type WithLegStyle = { legStyle?: LeaningLegStyle }

/** The plan's field, the same in every module, shown while the furniture stands on legs. */
export const legStyleField = <P extends WithLegStyle>(onLegs: (plan: P) => boolean, labels: Labels<LegStyle> | Labels<LeaningLegStyle> = LEG_STYLE_LABELS): FieldSpec<P> =>
  choice<P, LeaningLegStyle>({ key: 'legStyle', label: 'Forma de las patas', part: 'Patas', ...fromLabels(labels), visibleWhen: onLegs, get: (p) => p.legStyle ?? 'straight', set: (p, legStyle) => ({ ...p, legStyle }) })

export const describeLegStyle = (before: WithLegStyle, after: WithLegStyle): string[] => ((before.legStyle ?? 'straight') === (after.legStyle ?? 'straight') ? [] : [LEANING_LEG_STYLE_LABELS[after.legStyle ?? 'straight'].phrase])
