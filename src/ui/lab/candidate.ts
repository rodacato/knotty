import { currentPlan } from '../../application/useCases'
import { currentDesign, type DesignState } from '../../domain/session/state'

// A ficha is a plan, so the debug tools can hand back only what a plan says: `npm run probe -- --diff/--adopt` takes the file and does the rest.

export interface Origin {
  /** The ficha the design was opened from, when it was. */
  code: string | null
}

export type Candidate = { ok: true; file: Record<string, unknown>; filename: string } | { ok: false; reason: string }

const slug = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'design'

export function candidateOf(state: DesignState, origin: Origin): Candidate {
  const { plan, extras, diverged } = currentPlan(state)
  if (!plan) return { ok: false, reason: 'Este diseño no sale de una ficha de plan: una ficha solo guarda un plan, no piezas sueltas.' }
  if (diverged || extras.length) return { ok: false, reason: 'Después del plan hubo cambios pieza por pieza. Una ficha solo guarda el plan: vuelve a pedir esos cambios en la ficha (medidas, columnas, base) y exporta de nuevo.' }
  const design = currentDesign(state)
  const finish = design.finish ? { finish: design.finish } : {}
  if (origin.code) return { ok: true, file: { plan, ...finish }, filename: `${origin.code.toLowerCase()}.candidate.json` }
  const id = slug(plan.name)
  return { ok: true, file: { id, name: plan.name, notes: design.notes || plan.name, ...(design.kind ? { kind: design.kind } : {}), ...finish, plan }, filename: `${id}.candidate.json` }
}

/** The commands that check and adopt the file, for the dialog to show. */
export const adoptionCommands = (filename: string, code: string | null) => {
  const target = code ?? 'GN-XXX-00'
  return [`npm run probe -- --diff ${target} ${filename}`, `npm run probe -- --adopt ${target} ${filename}`]
}
