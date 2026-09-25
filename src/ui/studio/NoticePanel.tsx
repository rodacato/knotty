import { ArrowCounterClockwise, CheckCircle, Eye, Lightning, ChatCircleText, Tray, Wrench } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { noticeBoard, noticeItem, type Notice } from '../../application/notices'
import { fixesFor, type Fix } from '../../domain/fixes/fixes'
import { currentDesign, type DesignState } from '../../domain/session/state'
import { answerItem, answerItemId, noticeItemId } from '../../domain/tray/tray'
import { useServices } from '../services'
import { Button, Chip, Stamp } from '../system/components'
import { useStore } from '../store'

// Every notice with its way out: a solution Knotty builds (previewed in 3D), the tray for the expert, or leaving it as it is.

const KIND: Record<Notice['kind'], string> = { finding: '', requirement: 'Requisito', problem: 'Sin resolver', proposal: '', question: '' }

function FixButton({ fix }: { fix: Fix }) {
  const preview = useStore((s) => s.preview)
  const previewFix = useStore((s) => s.previewFix)
  const applyFix = useStore((s) => s.applyFix)
  const thinking = useStore((s) => s.thinking)
  const showing = preview?.label === fix.label
  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-xl border px-2 py-1.5 ${showing ? 'border-amber bg-amber-soft' : 'border-line bg-bone'}`}>
      <Lightning className="shrink-0 text-amber" weight="fill" />
      <span className="min-w-0 flex-1 text-sm">{fix.label}</span>
      <Button variant="ghost" className="min-h-8 px-2 text-xs" onClick={() => previewFix(showing ? null : fix)} aria-pressed={showing}>
        <Eye /> {showing ? 'Ocultar' : 'Ver'}
      </Button>
      <Button variant="primary" className="min-h-8 px-3 text-xs" disabled={thinking} onClick={() => applyFix(fix)}>
        Aplicar
      </Button>
    </div>
  )
}

function NoticeCard({ notice, state, onAnswer }: { notice: Notice; state: DesignState; onAnswer: () => void }) {
  const { catalog } = useServices()
  const select = useStore((s) => s.select)
  const acceptNotice = useStore((s) => s.acceptNotice)
  const toggleTray = useStore((s) => s.toggleTray)
  const applyProposal = useStore((s) => s.applyProposal)
  const discardProposal = useStore((s) => s.discardProposal)
  const toggleProposal = useStore((s) => s.toggleProposal)
  const showProposal = useStore((s) => s.showProposal)
  const thinking = useStore((s) => s.thinking)
  const design = currentDesign(state)
  // One solution covers every piece of the notice: five sagging shelves get five supports in one click.
  const fixes = useMemo(() => {
    const [first] = notice.findings
    if (!first) return []
    const pieces = [...new Set(notice.findings.flatMap((h) => h.pieces))]
    const general = (f: Fix) => (f.key === 'center-divider' || f.key === 'center-support' ? 'Un apoyo al centro, debajo de cada una' : f.label)
    const perPiece = new Set(['center-divider', 'center-support', 'thicker-board'])
    return fixesFor(design, catalog, { ...first, pieces }).map((f) => (pieces.length > 1 && perPiece.has(f.key) ? { ...f, label: `${general(f)} (${pieces.length} piezas)` } : f))
  }, [notice, design, catalog])
  const built = new Set(fixes.map((f) => f.key))
  const forExpert = [...new Map(notice.findings.flatMap((h) => h.alternatives).filter((a) => a.key !== 'max-span' && !built.has(a.key)).map((a) => [a.description, a])).values()]
  const name = (id: string) => design.pieces.find((p) => p.id === id)?.name ?? id
  const inTray = state.tray.find((t) => t.id === noticeItemId(notice.key))
  const question = notice.question && state.chat.find((m) => m.id === notice.question!.messageId)?.questions[notice.question.index]
  const answered = notice.question && state.tray.find((t) => t.id === answerItemId(notice.question!.messageId, notice.question!.index))?.label

  return (
    <li className={`animate-appear flex flex-col gap-2.5 rounded-2xl border p-4 ${notice.severity === 'critical' ? 'border-rust/30 bg-rust/5' : notice.severity === 'decision' ? 'border-amber/40 bg-amber-soft/40' : 'border-line bg-bone'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">
          {KIND[notice.kind] && <span className="mr-1.5 text-xs text-graphite-2">{KIND[notice.kind]} ·</span>}
          {notice.title}
        </span>
        {notice.severity !== 'decision' && <Stamp severity={notice.severity} />}
      </div>
      <p className="text-[15px] leading-snug">{notice.message}</p>
      {notice.pieces.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {notice.pieces.map((id) => (
            <button key={id} type="button" onClick={() => select(id)} className="rounded-full border border-line px-2.5 py-0.5 text-xs text-graphite-2 transition hover:border-amber hover:text-graphite">
              {name(id)}
            </button>
          ))}
        </div>
      )}

      {fixes.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium tracking-wide text-graphite-2 uppercase">Al instante</p>
          {fixes.map((f) => (
            <FixButton key={f.label} fix={f} />
          ))}
        </div>
      )}

      {notice.kind === 'proposal' && (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" className="min-h-9 text-xs" onClick={toggleProposal}>
            <Eye /> {showProposal ? 'Ver el actual' : 'Ver propuesta'}
          </Button>
          <Button variant="primary" className="min-h-9 text-xs" disabled={thinking} onClick={applyProposal}>
            Sí, aplícalo
          </Button>
          <Button variant="ghost" className="min-h-9 text-xs" disabled={thinking} onClick={discardProposal}>
            No, déjalo como estaba
          </Button>
        </div>
      )}

      {notice.question && question && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {question.options?.map((o) => (
              <Chip key={o} active={answered === o} aria-pressed={answered === o} disabled={thinking} onClick={() => toggleTray(answerItem(notice.question!.messageId, notice.question!.index, question.text, o))}>
                {o}
              </Chip>
            ))}
          </div>
          <button type="button" onClick={onAnswer} className="flex items-center gap-1 self-start text-xs text-graphite-2 underline hover:text-graphite">
            <ChatCircleText /> Ver en la conversación
          </button>
        </div>
      )}

      {(notice.kind === 'finding' || notice.kind === 'requirement' || notice.kind === 'problem') && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium tracking-wide text-graphite-2 uppercase">A la bandeja, para el experto</p>
          <div className="flex flex-wrap gap-2">
            {forExpert.map((a) => {
              const item = noticeItem(notice, a.description)
              return (
                <Chip key={a.description} active={inTray?.text === item.text} aria-pressed={inTray?.text === item.text} disabled={thinking} onClick={() => toggleTray(item)}>
                  <Wrench /> {a.description}
                </Chip>
              )
            })}
            <Chip active={inTray?.text === noticeItem(notice, null).text} aria-pressed={inTray?.text === noticeItem(notice, null).text} disabled={thinking} onClick={() => toggleTray(noticeItem(notice, null))}>
              Que el experto decida
            </Chip>
          </div>
        </div>
      )}

      {notice.kind === 'finding' && (
        <button type="button" onClick={() => acceptNotice(notice)} className="self-start text-xs text-graphite-2 underline hover:text-graphite">
          Aceptar así, bajo mi riesgo
        </button>
      )}
    </li>
  )
}

export function NoticePanel({ state, onAnswer }: { state: DesignState; onAnswer: () => void }) {
  const { catalog } = useServices()
  const reopenNotice = useStore((s) => s.reopenNotice)
  const sendTray = useStore((s) => s.sendTray)
  const thinking = useStore((s) => s.thinking)
  const board = useMemo(() => noticeBoard(state, catalog), [state, catalog])
  const [showAccepted, setShowAccepted] = useState(false)

  return (
    <div className="flex flex-col gap-4 p-4">
      {board.resolved.length > 0 && (
        <ul className="flex flex-col gap-1.5 rounded-2xl border border-slate/30 bg-slate/10 p-3 text-sm text-slate">
          {board.resolved.map((r) => (
            <li key={r} className="flex items-start gap-2">
              <CheckCircle className="mt-0.5 shrink-0" weight="fill" /> Resuelto: {r}
            </li>
          ))}
        </ul>
      )}

      {board.pending.length === 0 ? (
        <div className="flex flex-col items-center gap-2 p-6 text-center text-graphite-2">
          <Wrench size={28} weight="duotone" className="text-amber" />
          <p className="font-medium text-graphite">Nada pendiente</p>
          <p className="text-sm">Revisé flecha de entrepaños, espesores por unión, tornillos, vuelco, escuadrado, puertas, base, veta, cajones y el uso del mueble.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {board.pending.map((n) => (
            <NoticeCard key={n.key} notice={n} state={state} onAnswer={onAnswer} />
          ))}
        </ul>
      )}

      {board.accepted.length > 0 && (
        <div className="rounded-2xl border border-line bg-bone/60 p-3 text-sm">
          <button type="button" className="text-xs text-graphite-2 underline" onClick={() => setShowAccepted((v) => !v)}>
            {showAccepted ? 'Ocultar' : 'Ver'} lo que aceptaste así ({board.accepted.length})
          </button>
          {showAccepted && (
            <ul className="mt-2 flex flex-col gap-2">
              {board.accepted.map((n) => (
                <li key={n.key} className="flex items-start gap-2">
                  <span className="flex-1">
                    <span className="font-medium">{n.title}:</span> {n.message}
                  </span>
                  <button type="button" onClick={() => reopenNotice(n)} className="flex shrink-0 items-center gap-1 text-xs underline">
                    <ArrowCounterClockwise /> Reabrir
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {state.tray.length > 0 && (
        <div className="sticky bottom-3 flex items-center justify-between gap-2 rounded-2xl border border-amber/60 bg-bone p-3 shadow-md">
          <span className="flex items-center gap-1.5 text-sm">
            <Tray weight="duotone" className="text-amber" /> {state.tray.length} en la bandeja
          </span>
          <Button
            variant="primary"
            className="min-h-9 text-xs"
            disabled={thinking}
            onClick={() => {
              void sendTray()
              onAnswer()
            }}
          >
            <ChatCircleText weight="fill" /> Consultar al experto
          </Button>
        </div>
      )}
    </div>
  )
}
