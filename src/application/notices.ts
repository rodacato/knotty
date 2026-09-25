import { analizar } from '../domain/analisis'
import type { Diseno } from '../domain/diseno/esquema'
import { findingKey, type Finding, type Severity } from '../domain/structure/finding'
import type { Catalog } from '../domain/materiales/catalog'
import { verificarRequisitos } from '../domain/requisitos/requisitos'
import { disenoActual, type EstadoDiseno } from '../domain/sesion/estado'
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

const named = (design: Diseno, text: string) => design.piezas.reduce((m, p) => m.replaceAll(`"${p.id}"`, p.nombre), text)

/** Findings of the same rule and severity read as one notice, with all their pieces. */
function findingNotices(findings: Finding[]): Notice[] {
  const groups = new Map<string, Finding[]>()
  for (const h of findings) groups.set(`${h.code}|${h.severity}`, [...(groups.get(`${h.code}|${h.severity}`) ?? []), h])
  return [...groups.values()].map((group) => {
    const [first] = group
    return {
      key: `finding:${group.map(findingKey).sort().join('+')}`,
      kind: 'finding',
      severity: first.severity,
      title: TITLES[first.code] ?? first.code,
      message: `${first.message}${group.length > 1 ? ` Y ${group.length - 1 === 1 ? 'otra pieza' : `${group.length - 1} piezas más`} igual.` : ''}`,
      pieces: [...new Set(group.flatMap((h) => h.pieces))],
      findings: group,
    }
  })
}

function noticesOf(estado: EstadoDiseno, design: Diseno, catalog: Catalog): Notice[] {
  const analysis = analizar(design, catalog)
  const notices: Notice[] = []
  if (!analysis.valido)
    notices.push({
      key: 'problems',
      kind: 'problem',
      severity: 'critico',
      title: 'Problemas sin resolver',
      message: analysis.errores.map((e) => named(design, e.message)).join(' '),
      pieces: [...new Set(analysis.errores.flatMap((e) => Object.values(e.data ?? {}).filter((v): v is string => typeof v === 'string' && design.piezas.some((p) => p.id === v))))],
      findings: [],
    })
  for (const e of verificarRequisitos(design, estado.requisitos))
    notices.push({ key: `requirement:${e.message}`, kind: 'requirement', severity: 'critico', title: 'Tus requisitos', message: e.message, pieces: [], findings: [] })
  if (analysis.valido) notices.push(...findingNotices(analysis.hallazgos))
  return notices
}

/** The board for the current version: pending and accepted notices, and what the last change resolved. */
export function noticeBoard(estado: EstadoDiseno, catalog: Catalog): NoticeBoard {
  const design = disenoActual(estado)
  const accepted = new Set(estado.accepted.map((a) => a.key))
  const all = noticesOf(estado, design, catalog)
  const isAccepted = (n: Notice) => n.kind === 'finding' && n.findings.every((h) => accepted.has(findingKey(h)))

  const extra: Notice[] = []
  if (estado.propuesta)
    extra.push({
      key: 'proposal',
      kind: 'proposal',
      severity: 'decision',
      title: 'Propuesta del experto sin aplicar',
      message: [...estado.propuesta.holds, ...estado.propuesta.criticos.map((c) => c.mensaje)].join(' ') || estado.propuesta.resumen,
      pieces: estado.propuesta.criticos.flatMap((c) => c.piezas),
      findings: [],
    })
  for (const m of estado.chat) {
    if (m.autor !== 'experto' || m.respondida || m.propuesta === 'pendiente') continue
    m.preguntas.forEach((q, index) => {
      if (!q.opciones || m.respuestas.includes(`p${index}`)) return
      extra.push({ key: `question:${m.id}:${index}`, kind: 'question', severity: 'decision', title: 'Pregunta del experto', message: q.texto, pieces: [], findings: [], question: { messageId: m.id, index } })
    })
  }

  const ordered = [...estado.versiones].sort((a, b) => a.n - b.n)
  const before = ordered[ordered.findIndex((v) => v.n === estado.actual) - 1]
  const now = new Set(all.flatMap((n) => n.findings.map(findingKey)))
  const resolved = before
    ? noticesOf(estado, before.diseno, catalog)
        .filter((n) => n.kind === 'finding')
        .flatMap((n) => {
          const gone = n.findings.filter((h) => !now.has(findingKey(h)))
          const names = [...new Set(gone.flatMap((h) => h.pieces.map((id) => before.diseno.piezas.find((p) => p.id === id)?.nombre ?? id)))]
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
