import { analyze } from '../../domain/analysis'
import { DIMENSION_OF_AXIS, DIMENSION_LABEL, type Axis, type Position } from '../../domain/design/schema'
import type { Fix } from '../../domain/fixes/fixes'
import { materialById } from '../../domain/materials/catalog'
import { describePlanChanges, FurniturePlan, moduleOf } from '../../domain/modules/plan'
import { rebuildFromPlan } from '../../domain/modules/rebuild'
import { applyOperations } from '../../domain/operations/apply'
import type { Operation } from '../../domain/operations/schema'
import { currentDesign, type DesignState } from '../../domain/session/state'
import { describeProblems, traceErrors } from '../../domain/trace/trace'
import { named } from '../named'
import { knownErrors, tryCandidate } from './candidate'
import { currentPlan, layered } from './currentPlan'
import type { Kit } from './kit'

export type PieceEdit = { kind: 'length'; axis: Axis; value: number } | { kind: 'thickness'; material: string } | { kind: 'move'; axis: Axis; delta: number }
export type PieceEditResult = { ok: true; state: DesignState } | { ok: false; message: string; alternatives: { label: string; axis: Axis; value: number }[] }

/** A cota tied to an outer face of the piece of furniture. */
const toOutside = (position: Position | null) => position?.type === 'ref' && position.ref.startsWith('furniture.')

/** Changes the person makes by hand, with no expert: each one a version if the design holds. */
export function createEdits(kit: Kit) {
  const { catalog, save, addVersion, noted } = kit

  /** The person confirms by hand a piece the expert left as a sketch. */
  function confirmPiece(state: DesignState, id: string): DesignState {
    const design = currentDesign(state)
    const piece = design.pieces.find((p) => p.id === id)
    if (!piece || piece.confidence === 'high') return state
    const operations: Operation[] = [{ op: 'changeProperties', id, name: null, role: null, grain: null, load: null, support: null, edges: null, confidence: 'high' }]
    const r = applyOperations(design, operations, catalog)
    if (!r.ok) return state
    const withChange = addVersion(state, r.value.design, { summary: `Confirmar ${piece.name.toLowerCase()}`, reason: 'Confirmada a mano', operations: operations, origin: null, ...layered(currentPlan(state), operations) })
    return save(noted(withChange, 'expert', `Anoté ${piece.name.toLowerCase()} como confirmada.`))
  }

  /** A change made on the plan itself: rebuilt at once, no expert involved. */
  function applyPlan(state: DesignState, plan: FurniturePlan): { ok: true; state: DesignState; notes: string[] } | { ok: false; message: string } {
    const parsed = FurniturePlan.safeParse(plan)
    if (!parsed.success) return { ok: false, message: 'Hay un valor que no tiene sentido en la ficha: revisa que las medidas y los altos sean mayores que cero.' }
    const current = currentPlan(state)
    const { design, notes, dropped } = rebuildFromPlan(parsed.data, current.diverged ? [] : current.extras, catalog, state.requirements)
    const analysis = analyze(design, catalog, state.requirements)
    if (!analysis.valid) {
      const first = named(design.pieces, analysis.errors[0]?.message ?? '')
      return { ok: false, message: `Así no se puede armar: quedarían ${describeProblems(traceErrors(analysis.errors))}. ${first}` }
    }
    const previous = current.plan
    const changes = previous ? describePlanChanges(previous, parsed.data) : []
    const summary = changes.length ? changes.join(', ') : 'sin cambios'
    const extras = (current.diverged ? [] : current.extras).filter((e) => !dropped.includes(e))
    const withVersion = addVersion(state, design, { summary: `Ficha: ${summary}`.slice(0, 90), reason: `Desde la ficha: ${summary}`, operations: [], origin: null, plan: parsed.data, extras })
    return { ok: true, state: save({ ...noted(withVersion, 'user', `Cambié desde la ficha: ${summary}.`), measures: design.dimensions }), notes }
  }

  /** A hand edit on one piece, with no expert: the edit if it holds, or the ways it could. */
  function editPiece(state: DesignState, id: string, edit: PieceEdit): PieceEditResult {
    const design = currentDesign(state)
    const piece = design.pieces.find((p) => p.id === id)
    const analysis = analyze(design, catalog, state.requirements)
    const box = analysis.geo?.boxes.get(id)
    if (!piece || !box) return { ok: false, message: 'No encuentro esa pieza en el diseño.', alternatives: [] }
    const size = (axis: Axis) => box[`${axis}1`] - box[`${axis}0`]
    const operations: Operation[] =
      edit.kind === 'thickness'
        ? [{ op: 'changeMaterial', ids: [id], material: edit.material }]
        : edit.kind === 'move'
          ? [{ op: 'move', id, axis: edit.axis, at: { type: 'mm', mm: box[`${edit.axis}0`] + edit.delta } }]
          : [
              // The end tied to the outside of the piece stays; the other one moves.
              toOutside(piece[edit.axis].to) && !toOutside(piece[edit.axis].from)
                ? { op: 'resize', id, axis: edit.axis, end: 'from', at: { type: 'mm', mm: box[`${edit.axis}1`] - edit.value } }
                : { op: 'resize', id, axis: edit.axis, end: 'to', at: { type: 'mm', mm: box[`${edit.axis}0`] + edit.value } },
            ]
    const summary =
      edit.kind === 'thickness'
        ? `${piece.name} de ${materialById(catalog, edit.material)?.thickness ?? '?'} mm`
        : edit.kind === 'move'
          ? `Mover ${piece.name.toLowerCase()} ${Math.abs(edit.delta)} mm`
          : `${piece.name} de ${Math.round(size(edit.axis))} a ${Math.round(edit.value)} mm`
    const candidate = tryCandidate(design, operations, catalog, state.requirements, { known: knownErrors(analysis) })
    if (candidate.ok) {
      const withVersion = addVersion(state, candidate.design, { summary: summary.slice(0, 90), reason: `A mano: ${summary}`, operations: operations, origin: null, ...layered(currentPlan(state), operations) })
      return { ok: true, state: save(noted(withVersion, 'user', `Cambié a mano: ${summary}.`)) }
    }
    const reason = candidate.added[0]?.message
    // Tied to the outside of the piece: what can change is the whole piece of furniture.
    const alternatives: { label: string; axis: Axis; value: number }[] =
      edit.kind === 'length'
        ? [{ label: `Cambiar el ${DIMENSION_LABEL[DIMENSION_OF_AXIS[edit.axis]]} del mueble en ${edit.value - Math.round(size(edit.axis)) > 0 ? '+' : ''}${Math.round(edit.value - size(edit.axis))} mm`, axis: edit.axis, value: Math.round(design.dimensions[DIMENSION_OF_AXIS[edit.axis]] + edit.value - size(edit.axis)) }]
        : []
    return { ok: false, message: `Así no queda: ${(named(design.pieces, reason) || 'la pieza está amarrada a otras').replace(/\.$/, '')}.`, alternatives }
  }

  /** The whole piece of furniture grows or shrinks along one axis; through the plan when there is one. */
  function resizeFurniture(state: DesignState, axis: Axis, value: number): PieceEditResult {
    const current = currentPlan(state)
    if (current.plan && !current.diverged) {
      const plan = current.plan
      const resized = moduleOf(plan).resize(plan, axis, value)
      if (!resized.ok) return { ok: false, message: resized.message, alternatives: [] }
      const r = applyPlan(state, resized.plan)
      return r.ok ? { ok: true, state: r.state } : { ok: false, message: r.message, alternatives: [] }
    }
    const operations: Operation[] = [{ op: 'resizeFurniture', axis: axis, value: value, rule: 'stretch' }]
    const candidate = tryCandidate(currentDesign(state), operations, catalog, state.requirements)
    if (!candidate.ok || !candidate.analysis.valid) return { ok: false, message: 'Tampoco se puede cambiar la medida del mueble así.', alternatives: [] }
    const dimension = DIMENSION_OF_AXIS[axis]
    const summary = `${dimension.charAt(0).toUpperCase()}${dimension.slice(1)} del mueble a ${value} mm`
    const withVersion = addVersion(state, candidate.design, { summary: summary, reason: `A mano: ${summary}`, operations: operations, origin: null })
    return { ok: true, state: save({ ...noted(withVersion, 'user', `Cambié a mano: ${summary}.`), measures: candidate.design.dimensions }) }
  }

  /** A solution Knotty built: applied as one version, with no expert. */
  function applyFix(state: DesignState, fix: Fix): DesignState {
    const withVersion = addVersion(state, fix.design, { summary: fix.label.slice(0, 90), reason: `Solución: ${fix.label}`, operations: fix.operations, origin: null, ...layered(currentPlan(state), fix.operations) })
    return save(noted(withVersion, 'user', `Resolví: ${fix.label}.`))
  }

  return { confirmPiece, applyPlan, editPiece, resizeFurniture, applyFix }
}
