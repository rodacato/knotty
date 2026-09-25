import { analyze } from '../domain/analysis'
import { roundTo } from '../domain/diseno/resolve'
import { compactLog } from '../domain/historial/history'
import type { Catalog } from '../domain/materiales/catalog'
import { currentVersion, type DesignState } from '../domain/sesion/state'

// Sent with every change: more context costs more and distracts the expert.
const TOKEN_BUDGET = 12_000
const RECENT_MESSAGES = 6
const tokens = (text: string) => Math.ceil(text.length / 3.5)

const SEVERITY_LABEL = { critical: 'crítico', recommendation: 'recomendación', detail: 'detalle' }

/** What the expert needs for a change, from the most stable to the most volatile; if it does not fit, the least needed is cut. */
export function buildContext(state: DesignState, catalog: Catalog): string {
  const version = currentVersion(state)
  const design = version.design
  const analysis = analyze(design, catalog, state.requirements)

  const fixed: string[] = [`## Diseño actual (v${version.n})`, '```json', JSON.stringify(design), '```']
  if (analysis.valid) {
    fixed.push(
      '',
      '## Geometría resuelta (solo lectura, mm): id: x0–x1 · y0–y1 · z0–z1 · espesor',
      ...[...analysis.geo.boxes].map(([id, c]) => `${id}: ${roundTo(c.x0)}–${roundTo(c.x1)} · ${roundTo(c.y0)}–${roundTo(c.y1)} · ${roundTo(c.z0)}–${roundTo(c.z1)} · ${analysis.geo.thicknesses.get(id)}`),
      '',
      '## Revisión estructural',
      ...(analysis.findings.length
        ? analysis.findings.map((h) => `- [${SEVERITY_LABEL[h.severity]}] ${h.code} ${h.pieces.join(', ')}: ${h.message} Alternativas: ${h.alternatives.map((a) => `${a.description} ${JSON.stringify(a.data)}`).join('; ')}`)
        : ['Sin observaciones.']),
    )
  } else fixed.push('', '## Errores del diseño actual', ...analysis.errors.map((e) => `- ${e.code}: ${e.message}`))

  fixed.push('', '## Requisitos del usuario', ...(state.requirements.length ? state.requirements.map((r) => `- [${r.id}] ${r.text}`) : ['Ninguno todavía.']))
  if (state.proposal)
    fixed.push(
      '',
      '## Propuesta pendiente (no aplicada)',
      `"${state.proposal.summary}" por el pedido "${state.proposal.reason}". Operaciones: ${JSON.stringify(state.proposal.operations)}`,
      ...state.proposal.critical.map((c) => `- Crítico ${c.code} ${c.pieces.join(', ')}: ${c.message}`),
      'Si el usuario elige una opción, responde con las operaciones completas sobre el diseño actual: las de la propuesta más la solución.',
    )

  let decisions = state.decisions.map((d) => `- ${d.topic}: ${d.text}`)
  let log = compactLog(state.versions)
  let chat = state.chat.slice(-RECENT_MESSAGES).map((m) => `${m.author === 'user' ? 'Usuario' : 'Experto'}: ${m.text}`)

  const assemble = () =>
    [...fixed, '', '## Decisiones de diseño', ...(decisions.length ? decisions : ['Ninguna todavía.']), '', '## Bitácora de cambios', ...log, '', '## Conversación reciente', ...chat].join('\n')

  while (tokens(assemble()) > TOKEN_BUDGET) {
    if (chat.length > 2) chat = chat.slice(1)
    else if (log.some((l) => !l.includes('pedido:'))) log = log.filter((l, i) => l.includes('pedido:') || i !== log.findIndex((x) => !x.includes('pedido:')))
    else if (decisions.length) decisions = decisions.slice(1)
    else break
  }
  return assemble()
}
