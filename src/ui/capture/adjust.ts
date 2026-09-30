import type { Dimensions } from '../../domain/design/schema'
import type { Example, Base } from '../../domain/furniture/examples'
import type { AxisFit, PlanSummary, SpaceFit } from '../../domain/furniture/quick'
import type { QuickCountKind } from '../../domain/furniture/modules/module'
import type { FurniturePlan } from '../../domain/furniture/modules/plan'
import type { FinishId } from '../../domain/materials/finishes'

export type SpaceAxis = keyof Dimensions

export const SPACE_AXES: readonly [SpaceAxis, string][] = [
  ['width', 'Ancho'],
  ['depth', 'Fondo'],
  ['height', 'Alto'],
]

export const COUNT_LABELS: Record<QuickCountKind, { label: string; noun: string }> = {
  drawer: { label: 'Cajones', noun: 'cajones' },
  door: { label: 'Puertas', noun: 'puertas' },
  open: { label: 'Nichos abiertos', noun: 'nichos abiertos' },
}

/** Whole or decimal centimeters typed by the person, in mm; null when empty or not a positive number. */
export function parseCm(text: string): number | null {
  const clean = text.trim().replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(clean)) return null
  const mm = Math.round(Number(clean) * 10)
  return mm > 0 ? mm : null
}

/** The space the person described: only the axes with a number in them. */
export function spaceOf(inputs: Record<SpaceAxis, string>): Partial<Dimensions> {
  const space: Partial<Dimensions> = {}
  for (const [axis] of SPACE_AXES) {
    const mm = parseCm(inputs[axis])
    if (mm !== null) space[axis] = mm
  }
  return space
}

/** A field the person typed something in that is not a number. */
export const isUnreadable = (text: string) => text.trim() !== '' && parseCm(text) === null

const cmText = (mm: number) => (mm / 10).toLocaleString('es-MX', { maximumFractionDigits: 1 })

/** What the base did with one axis of the space, in words for the person; null when it took it as given or none was given. */
export function axisNote(axis: AxisFit): string | null {
  switch (axis.status) {
    case 'rounded-down':
      return `queda en ${cmText(axis.proposed)} cm.`
    case 'raised':
      return `lo más bajo que da es ${cmText(axis.min)} cm: queda en ${cmText(axis.proposed)} cm y no cabe.`
    case 'lowered':
      return `lo más que da es ${cmText(axis.max)} cm: queda en ${cmText(axis.proposed)} cm.`
    default:
      return null
  }
}

export const sheetsLine = (total: number) => `${total} ${total === 1 ? 'hoja' : 'hojas'} de triplay`

export const costLine = (cost: number) => `~$${Math.round(cost).toLocaleString('es-MX')}`

export const summaryLines = (summary: PlanSummary): { sheets: string; cost: string } | null => (summary.ok ? { sheets: sheetsLine(summary.totalSheets), cost: costLine(summary.cost) } : null)

/** What stops the Studio from opening with this fit; the person sees it and the button waits. */
export const blocking = (fit: SpaceFit): string | null => fit.problems[0] ?? null

/** The base with the plan and finish the person chose, as the Studio opens it. */
export const chosenExample = (base: Base, plan: FurniturePlan, finish: FinishId): Example => ({ ...base, plan, finish })
