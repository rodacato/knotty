import { analyze } from '../../domain/checks/analysis'
import { describeChange, restorePieces } from '../../domain/editing/changes/changes'
import type { Operation } from '../../domain/editing/operations/schema'
import { currentDesign, type DesignState } from '../../domain/session/state'
import { named } from '../named'
import { knownErrors, newErrors } from './candidate'
import { currentPlan, layered } from './currentPlan'
import type { Kit } from './kit'

type Outcome = { ok: true; state: DesignState } | { ok: false; message: string }

/** The version a given one was made from: the one just before it in the timeline. */
const previousOf = (state: DesignState, n: number) => {
  const ordered = [...state.versions].sort((a, b) => a.n - b.n)
  const i = ordered.findIndex((v) => v.n === n)
  return i > 0 ? ordered[i - 1] : null
}

/** Moving through the versions: nothing is ever lost, going back makes a new version. */
export function createHistory(kit: Kit) {
  const { catalog, save, addVersion, noted } = kit

  function backToVersion(state: DesignState, n: number): DesignState {
    const target = state.versions.find((v) => v.n === n)
    if (!target || n === state.current) return state
    const withChange = addVersion({ ...state, decisions: target.decisions }, target.design, { summary: `Volver a v${n}`, reason: `Volver a v${n}: ${target.summary}`, operations: [], origin: null, plan: target.plan, extras: target.extras })
    return save(noted(withChange, 'expert', `Regresé al diseño de la v${n} (${target.summary}).`))
  }

  /** Brings pieces back to how they were before version `n`, keeping everything that came after. */
  function restoreFromVersion(state: DesignState, n: number, ids: string[]): Outcome {
    const before = previousOf(state, n)
    if (!before || !ids.length) return { ok: false, message: 'No hay una versión anterior de dónde regresar.' }
    const current = currentDesign(state)
    const r = restorePieces(current, before.design, ids, catalog)
    const pieces = current.pieces.concat(before.design.pieces)
    if (!r.ok) return { ok: false, message: `No se puede regresar así: ${named(pieces, r.errors[0]?.message) || 'choca con lo que cambió después'}` }
    const added = newErrors(analyze(r.design, catalog, state.requirements), knownErrors(analyze(current, catalog, state.requirements)))
    if (added.length) return { ok: false, message: `No se puede regresar así: ${named(pieces, added[0].message)}` }
    const names = ids.map((id) => before.design.pieces.find((p) => p.id === id)?.name ?? current.pieces.find((p) => p.id === id)?.name ?? id)
    const summary = `Regresar ${names.join(', ')}`
    const operations: Operation[] = ids.flatMap((id): Operation[] => {
      const was = before.design.pieces.find((p) => p.id === id)
      const now = current.pieces.some((p) => p.id === id)
      if (!was) return [{ op: 'removePiece', id }]
      return [...(now ? [{ op: 'removePiece' as const, id }] : []), { op: 'addPiece' as const, piece: was }]
    })
    const asBefore = `como ${names.length === 1 ? 'estaba' : 'estaban'} antes de la v${n}`
    const withVersion = addVersion(state, r.design, { summary: summary.slice(0, 90), reason: `${summary} ${asBefore}`, operations: operations, origin: null, ...layered(currentPlan(state), operations) })
    return { ok: true, state: save(noted(withVersion, 'user', `Regresé ${names.join(', ')} ${asBefore}.`)) }
  }

  /** Undoes one change: the last one exactly; an older one by bringing back what it touched. */
  function undoChange(state: DesignState, n: number): Outcome {
    const before = previousOf(state, n)
    if (!before) return { ok: false, message: 'Es la primera versión: no hay nada antes.' }
    if (n === state.current) return { ok: true, state: backToVersion(state, before.n) }
    const version = state.versions.find((v) => v.n === n)!
    const ids = describeChange(before.design, version.design, catalog).direct.map((c) => c.id)
    return restoreFromVersion(state, n, ids)
  }

  return { backToVersion, restoreFromVersion, undoChange }
}
