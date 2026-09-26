import { analyze } from '../domain/analysis'
import { roundTo } from '../domain/design/resolve'
import { compactLog } from '../domain/history/history'
import type { Catalog } from '../domain/materials/catalog'
import { FINISHES, type FinishId } from '../domain/materials/finishes'
import type { Operation } from '../domain/operations/schema'
import { currentVersion, type DesignState } from '../domain/session/state'
import { isAccepted } from '../domain/structure/accepted'
import type { Finding } from '../domain/structure/finding'

// Sent with every change: more context costs more and distracts the expert.
const TOKEN_BUDGET = 12_000
const RECENT_MESSAGES = 6
export const estimateTokens = (text: string) => Math.ceil(text.length / 3.5)

/** A finding's ways out as the expert reads them; the longest span a sagging board takes goes last, as one more fact to work with. */
export function describeAlternatives(h: Finding) {
  const lines = h.alternatives.map((a) => `${a.description} ${JSON.stringify(a.data)}`)
  if (typeof h.data.maxSpan === 'number') lines.push(`Claro máximo con ${h.data.thickness} mm ${JSON.stringify({ span: h.data.maxSpan })}`)
  return lines.join('; ')
}

const finishLine = (finish: FinishId | undefined) =>
  finish && finish !== 'none' ? [`Finish the person chose (Knotty keeps it and buys it): ${FINISHES[finish].name}.`] : []

const requirementLines = (state: DesignState) => ['', "## The person's requirements", ...(state.requirements.length ? state.requirements.map((r) => `- [${r.id}] ${r.text}`) : ['None yet.'])]

/** The pending proposal; a change through the plan brings no operations, it is the whole plan. `operations: false` leaves the piece operations out. */
function proposalLines(state: DesignState, operations: boolean): string[] {
  const p = state.proposal
  if (!p) return []
  const throughPlan = p.plan && !p.operations.length
  return [
    '',
    '## Pending proposal (not applied)',
    `"${p.summary}" for the request "${p.reason}".${operations && p.operations.length ? ` Operations: ${JSON.stringify(p.operations)}` : ''}`,
    ...p.critical.map((c) => `- Critical ${c.code} ${c.pieces.join(', ')}: ${c.message}`),
    throughPlan
      ? `It changes the plan to: ${JSON.stringify(p.plan)}. If the person answers or picks an option, answer with the complete plan: the proposal's plus that.`
      : operations
        ? "If the person picks an option, answer with the complete operations on the current design: the proposal's plus the fix."
        : 'It changes pieces, not the plan: if the person picks an option the plan can say, answer with the complete plan with it.',
  ]
}

/** From the most stable to the most volatile, fitted to the budget: if it does not fit, the least needed is cut. */
function fitted(fixed: string[], state: DesignState): string {
  let decisions = state.decisions.map((d) => `- ${d.topic}: ${d.text}`)
  let log = compactLog(state.versions)
  let chat = state.chat.slice(-RECENT_MESSAGES).map((m) => `${m.author === 'user' ? 'Person' : 'Expert'}: ${m.text}`)

  const assemble = () =>
    [...fixed, '', '## Design decisions', ...(decisions.length ? decisions : ['None yet.']), '', '## Change log', ...log, '', '## Recent conversation', ...chat].join('\n')

  while (estimateTokens(assemble()) > TOKEN_BUDGET) {
    if (chat.length > 2) chat = chat.slice(1)
    else if (log.some((l) => !l.includes('request:'))) log = log.filter((l, i) => l.includes('request:') || i !== log.findIndex((x) => !x.includes('request:')))
    else if (decisions.length) decisions = decisions.slice(1)
    else break
  }
  return assemble()
}

/** What the expert needs for a change piece by piece: the whole design, its geometry and its review. */
export function buildContext(state: DesignState, catalog: Catalog): string {
  const version = currentVersion(state)
  const { finish, ...design } = version.design
  const analysis = analyze(design, catalog, state.requirements)

  const fixed: string[] = [`## Current design (v${version.n})`, '```json', JSON.stringify(design), '```', ...finishLine(finish)]
  if (analysis.valid) {
    fixed.push(
      '',
      '## Resolved geometry (read only, mm): id: x0–x1 · y0–y1 · z0–z1 · thickness',
      ...[...analysis.geo.boxes].map(([id, c]) => `${id}: ${roundTo(c.x0)}–${roundTo(c.x1)} · ${roundTo(c.y0)}–${roundTo(c.y1)} · ${roundTo(c.z0)}–${roundTo(c.z1)} · ${analysis.geo.thicknesses.get(id)}`),
      '',
      '## Structural review',
      ...(analysis.findings.length
        ? analysis.findings.map((h) => `- [${h.severity}] ${h.code} ${h.pieces.join(', ')}: ${h.message} Alternatives: ${describeAlternatives(h)}`)
        : ['No findings.']),
    )
  } else fixed.push('', '## Errors in the current design', ...analysis.errors.map((e) => `- ${e.code}: ${e.message}`))

  fixed.push(...requirementLines(state), ...proposalLines(state, true))
  return fitted(fixed, state)
}

/** A free change on top of the plan, in a few words: what it does and to what. */
function describeExtra(e: Operation): string {
  const target = 'piece' in e ? e.piece.id : 'id' in e ? e.id : 'group' in e ? e.group : 'ids' in e ? e.ids.join(', ') : 'joint' in e ? e.joint.id : null
  return `- ${e.op}${target ? ` ${target}` : ''}`
}

/**
 * What the expert needs to edit a live plan: the plan itself goes with the request, so no pieces or geometry,
 * only the review's codes and messages, what the person accepted, the requirements, decisions and conversation.
 */
export function buildPlanContext(state: DesignState, catalog: Catalog, extras: Operation[] = []): string {
  const version = currentVersion(state)
  const { finish, ...design } = version.design
  const analysis = analyze(design, catalog, state.requirements)

  const fixed: string[] = [`## Current design (v${version.n}): built by Knotty from the plan below`, ...finishLine(finish)]
  if (extras.length) fixed.push('', '## Free changes on top of the plan (Knotty reapplies them)', ...extras.map(describeExtra))
  if (analysis.valid)
    fixed.push(
      '',
      '## Structural review',
      ...(analysis.findings.length
        ? analysis.findings.map((h) => `- [${h.severity}] ${h.code}: ${h.message}${isAccepted(h, state.accepted) ? ' (the person accepted it as it is)' : ''}`)
        : ['No findings.']),
    )
  else fixed.push('', '## Errors in the current design', ...analysis.errors.map((e) => `- ${e.code}: ${e.message}`))

  fixed.push(...requirementLines(state), ...proposalLines(state, false))
  return fitted(fixed, state)
}
