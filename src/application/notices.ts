import { analyze } from '../domain/analysis'
import type { Design } from '../domain/diseno/schema'
import { findingKey, type Finding, type Severity } from '../domain/structure/finding'
import type { Catalog } from '../domain/materiales/catalog'
import { checkRequirements } from '../domain/requisitos/requirements'
import { currentDesign, type DesignState } from '../domain/sesion/state'
import { noticeItemId, type TrayItem } from '../domain/tray/tray'

// Everything that waits for a decision, in one list: what the rules found, what the expert proposes or asks, what is still broken.

export type NoticeKind = 'finding' | 'requirement' | 'problem' | 'proposal' | 'question'

export interface Notice {
  /** Stable while the problem lasts, so accepting it and seeing it resolved refer to the same thing. */
  key: string
  kind: NoticeKind
  severity: Severity | 'decision'
  title: string
  message: string
  pieces: string[]
  /** The findings behind a finding notice: its keys are what gets accepted. */
  findings: Finding[]
  /** For a question: the chat message it belongs to and its index. */
  question?: { messageId: string; index: number }
}

export interface NoticeBoard {
  pending: Notice[]
  accepted: Notice[]
  /** What the last change fixed ("Entrepaños que se pandean: Piso"), to show it went away on purpose. */
  resolved: string[]
}

const TITLES: Record<string, string> = {
  R1_FLECHA: 'Entrepaños que se pandean',
  R2_ESPESOR_UNION: 'Espesor para la unión',
  R3_TORNILLOS: 'Tornillos',
  R4_VUELCO: 'Riesgo de vuelco',
  R5_ESCUADRADO: 'Escuadrado',
  R6_PUERTAS: 'Puertas',
  R7_BASE: 'Base',
  R8_VETA: 'Veta',
  R9_CAJONES: 'Cajones',
  R10_USO: 'Uso del mueble',
}
const RANK = { critico: 0, decision: 1, recomendacion: 2, detalle: 3 }

const named = (design: Design, text: string) => design.pieces.reduce((m, p) => m.replaceAll(`"${p.id}"`, p.name), text)

/** Findings of the same rule and severity read as one notice, with all their pieces. */
function findingNotices(findings: Finding[]): Notice[] {
  const groups = new Map<string, Finding[]>()
  for (const h of findings) groups.set(`${h.code}|${h.severity}`, [...(groups.get(`${h.code}|${h.severity}`) ?? []), h])
  return [...groups.values()].map((group) => {
    const [first] = group
    return {
      key: `finding:${first.severity}:${group.map(findingKey).sort().join('+')}`,
      kind: 'finding',
      severity: first.severity,
      title: TITLES[first.code] ?? first.code,
      message: `${first.message}${group.length > 1 ? ` Y ${group.length - 1 === 1 ? 'otra pieza' : `${group.length - 1} piezas más`} igual.` : ''}`,
      pieces: [...new Set(group.flatMap((h) => h.pieces))],
      findings: group,
    }
  })
}

function noticesOf(state: DesignState, design: Design, catalog: Catalog): Notice[] {
  const analysis = analyze(design, catalog)
  const notices: Notice[] = []
  if (!analysis.valid)
    notices.push({
      key: 'problems',
      kind: 'problem',
      severity: 'critico',
      title: 'Problemas sin resolver',
      message: analysis.errors.map((e) => named(design, e.message)).join(' '),
      pieces: [...new Set(analysis.errors.flatMap((e) => Object.values(e.data ?? {}).filter((v): v is string => typeof v === 'string' && design.pieces.some((p) => p.id === v))))],
      findings: [],
    })
  for (const e of checkRequirements(design, state.requirements))
    notices.push({ key: `requirement:${e.message}`, kind: 'requirement', severity: 'critico', title: 'Tus requisitos', message: e.message, pieces: [], findings: [] })
  if (analysis.valid) notices.push(...findingNotices(analysis.findings))
  return notices
}

/** The board for the current version: pending and accepted notices, and what the last change resolved. */
export function noticeBoard(state: DesignState, catalog: Catalog): NoticeBoard {
  const design = currentDesign(state)
  const accepted = new Set(state.accepted.map((a) => a.key))
  const all = noticesOf(state, design, catalog)
  const isAccepted = (n: Notice) => n.kind === 'finding' && n.findings.every((h) => accepted.has(findingKey(h)))

  const extra: Notice[] = []
  if (state.proposal)
    extra.push({
      key: 'proposal',
      kind: 'proposal',
      severity: 'decision',
      title: 'Propuesta del experto sin aplicar',
      message: [...state.proposal.holds, ...state.proposal.critical.map((c) => c.message)].join(' ') || state.proposal.summary,
      pieces: state.proposal.critical.flatMap((c) => c.pieces),
      findings: [],
    })
  for (const m of state.chat) {
    if (m.author !== 'expert' || m.answered || m.proposal === 'pending') continue
    m.questions.forEach((q, index) => {
      if (!q.options || m.answers.includes(`p${index}`)) return
      extra.push({ key: `question:${m.id}:${index}`, kind: 'question', severity: 'decision', title: 'Pregunta del experto', message: q.text, pieces: [], findings: [], question: { messageId: m.id, index } })
    })
  }

  const ordered = [...state.versions].sort((a, b) => a.n - b.n)
  const before = ordered[ordered.findIndex((v) => v.n === state.current) - 1]
  const now = new Set(all.flatMap((n) => n.findings.map(findingKey)))
  const resolved = before
    ? noticesOf(state, before.design, catalog)
        .filter((n) => n.kind === 'finding')
        .flatMap((n) => {
          const gone = n.findings.filter((h) => !now.has(findingKey(h)))
          const names = [...new Set(gone.flatMap((h) => h.pieces.map((id) => before.design.pieces.find((p) => p.id === id)?.name ?? id)))]
          return gone.length ? [`${n.title}${names.length ? `: ${names.join(', ')}` : ''}`] : []
        })
    : []

  const sort = (list: Notice[]) => [...list].sort((a, b) => RANK[a.severity] - RANK[b.severity])
  return { pending: sort([...extra, ...all.filter((n) => !isAccepted(n))]), accepted: all.filter(isAccepted), resolved }
}

/** A notice for the expert: with one of its alternatives, or for the expert to decide how. */
export function noticeItem(notice: Notice, alternative: string | null): TrayItem {
  return {
    id: noticeItemId(notice.key),
    kind: 'notice',
    text: alternative ? `${notice.message} ${alternative}.` : `Corrige esto: ${notice.message}`,
    label: `${notice.title}: ${alternative ?? 'que decida el experto'}`,
    answers: null,
  }
}
