import { analyze } from '../domain/analysis'
import { roundTo } from '../domain/diseno/resolve'
import { compactLog } from '../domain/historial/history'
import type { Catalog } from '../domain/materiales/catalog'
import { currentVersion, type DesignState } from '../domain/sesion/state'

// Sent with every change: more context costs more and distracts the expert.
const TOKEN_BUDGET = 12_000
const RECENT_MESSAGES = 6
const tokens = (text: string) => Math.ceil(text.length / 3.5)

/** What the expert needs for a change, from the most stable to the most volatile; if it does not fit, the least needed is cut. */
export function buildContext(state: DesignState, catalog: Catalog): string {
  const version = currentVersion(state)
  const design = version.design
  const analysis = analyze(design, catalog, state.requirements)

  const fixed: string[] = [`## Current design (v${version.n})`, '```json', JSON.stringify(design), '```']
  if (analysis.valid) {
    fixed.push(
      '',
      '## Resolved geometry (read only, mm): id: x0–x1 · y0–y1 · z0–z1 · thickness',
      ...[...analysis.geo.boxes].map(([id, c]) => `${id}: ${roundTo(c.x0)}–${roundTo(c.x1)} · ${roundTo(c.y0)}–${roundTo(c.y1)} · ${roundTo(c.z0)}–${roundTo(c.z1)} · ${analysis.geo.thicknesses.get(id)}`),
      '',
      '## Structural review',
      ...(analysis.findings.length
        ? analysis.findings.map((h) => `- [${h.severity}] ${h.code} ${h.pieces.join(', ')}: ${h.message} Alternatives: ${h.alternatives.map((a) => `${a.description} ${JSON.stringify(a.data)}`).join('; ')}`)
        : ['No findings.']),
    )
  } else fixed.push('', '## Errors in the current design', ...analysis.errors.map((e) => `- ${e.code}: ${e.message}`))

  fixed.push('', '## The person\'s requirements', ...(state.requirements.length ? state.requirements.map((r) => `- [${r.id}] ${r.text}`) : ['None yet.']))
  if (state.proposal)
    fixed.push(
      '',
      '## Pending proposal (not applied)',
      `"${state.proposal.summary}" for the request "${state.proposal.reason}". Operations: ${JSON.stringify(state.proposal.operations)}`,
      ...state.proposal.critical.map((c) => `- Critical ${c.code} ${c.pieces.join(', ')}: ${c.message}`),
      'If the person picks an option, answer with the complete operations on the current design: the proposal\'s plus the fix.',
    )

  let decisions = state.decisions.map((d) => `- ${d.topic}: ${d.text}`)
  let log = compactLog(state.versions)
  let chat = state.chat.slice(-RECENT_MESSAGES).map((m) => `${m.author === 'user' ? 'Person' : 'Expert'}: ${m.text}`)

  const assemble = () =>
    [...fixed, '', '## Design decisions', ...(decisions.length ? decisions : ['None yet.']), '', '## Change log', ...log, '', '## Recent conversation', ...chat].join('\n')

  while (tokens(assemble()) > TOKEN_BUDGET) {
    if (chat.length > 2) chat = chat.slice(1)
    else if (log.some((l) => !l.includes('request:'))) log = log.filter((l, i) => l.includes('request:') || i !== log.findIndex((x) => !x.includes('request:')))
    else if (decisions.length) decisions = decisions.slice(1)
    else break
  }
  return assemble()
}
