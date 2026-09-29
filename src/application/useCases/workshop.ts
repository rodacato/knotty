import { analyze } from '../../domain/checks/analysis'
import { EDGE_LABEL, edgeNeighbours, profilesOf, withPieceProfiles } from '../../domain/design/edges'
import { JOINT_GUIDE } from '../../domain/design/jointGuide'
import type { Edge } from '../../domain/design/schema'
import { chooseJoint as jointChoice, jointGroups, type ChoosableJoint, type JointGroupId } from '../../domain/editing/joints/choice'
import { EDGE_PROFILES, type EdgeProfileId } from '../../domain/materials/edgeProfiles'
import { currentDesign, type DesignState } from '../../domain/session/state'
import { named } from '../named'
import { knownErrors, tryCandidate } from './candidate'
import { currentPlan, layered } from './currentPlan'
import type { Kit } from './kit'

export type WorkshopResult = { ok: true; state: DesignState; notes: string[] } | { ok: false; message: string }

const listed = (words: string[]) => (words.length > 1 ? `${words.slice(0, -1).join(', ')} y ${words.at(-1)}` : (words[0] ?? ''))

/** How the pieces are joined and how their edges are shaped: choices the person makes by hand, each one a version. */
export function createWorkshop(kit: Kit) {
  const { catalog, save, addVersion, noted } = kit

  /** Every joint of a group becomes the chosen type; one R2 rejects for these boards is refused, and one it only warns about is said. */
  function chooseJoint(state: DesignState, group: JointGroupId, type: ChoosableJoint): WorkshopResult {
    const design = currentDesign(state)
    const analysis = analyze(design, catalog, state.requirements)
    const target = jointGroups(design).find((g) => g.id === group)
    if (!analysis.geo || !target) return { ok: false, message: 'No encuentro esas uniones en el diseño.' }
    const choice = jointChoice(design, analysis.geo, group, type, catalog)
    const critical = choice.findings.filter((f) => f.severity === 'critical')
    if (critical.length) return { ok: false, message: `Con estos tableros no: ${named(design.pieces, critical[0].message)}` }
    if (!choice.operations.length) return { ok: true, state, notes: [] }
    const candidate = tryCandidate(design, choice.operations, catalog, state.requirements, { known: knownErrors(analysis) })
    if (!candidate.ok) return { ok: false, message: `Así no queda: ${named(design.pieces, candidate.added[0]?.message ?? '')}` }
    const name = JOINT_GUIDE[type].name
    const summary = `${target.label.split(':')[0]}: ${name.toLowerCase()}`
    const withVersion = addVersion(state, candidate.design, { summary: summary.slice(0, 90), reason: `A mano: ${summary}`, operations: choice.operations, origin: null, ...layered(currentPlan(state), choice.operations) })
    const notes = [...new Set(choice.findings.map((f) => named(design.pieces, f.message)))]
    if (choice.kept) notes.push(`${choice.kept === 1 ? 'Una unión va' : `${choice.kept} uniones van`} en ranura o rebaje y se queda${choice.kept === 1 ? '' : 'n'} así.`)
    return { ok: true, state: save(noted(withVersion, 'user', `Cambié a mano: ${summary}.`)), notes }
  }

  /** The profile of the chosen edges of one piece; `profile` null leaves them straight. Any edge of the face takes one: the sheet warns when it will not show, or the board or the tools do not allow it. */
  function chooseEdgeProfiles(state: DesignState, pieceId: string, edges: Edge[], profile: EdgeProfileId | null): WorkshopResult {
    const design = currentDesign(state)
    const analysis = analyze(design, catalog, state.requirements)
    const piece = design.pieces.find((p) => p.id === pieceId)
    if (!analysis.geo || !piece) return { ok: false, message: 'No encuentro esa pieza en el diseño.' }
    const onFace = new Set(edgeNeighbours(design, analysis.geo, pieceId).map((n) => n.edge))
    const chosen = edges.filter((e) => onFace.has(e))
    const choices = profile ? chosen.map((edge) => ({ edge, profile })) : []
    const before = profilesOf(design, pieceId)
    if (before.length === choices.length && choices.every((c) => before.some((b) => b.edge === c.edge && b.profile === c.profile))) return { ok: true, state, notes: [] }
    const summary = `Cantos de ${piece.name.toLowerCase()}: ${profile && chosen.length ? `${listed(chosen.map((e) => EDGE_LABEL[e].toLowerCase()))}, ${EDGE_PROFILES[profile].name.toLowerCase()}` : 'rectos'}`
    const withVersion = addVersion(state, withPieceProfiles(design, pieceId, choices), { summary: summary.slice(0, 90), reason: `A mano: ${summary}`, operations: [], origin: null, ...layered(currentPlan(state), []) })
    return { ok: true, state: save(noted(withVersion, 'user', `Elegí ${summary.charAt(0).toLowerCase()}${summary.slice(1)}.`)), notes: [] }
  }

  return { chooseJoint, chooseEdgeProfiles }
}
