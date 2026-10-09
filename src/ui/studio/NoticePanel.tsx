import { ArrowCounterClockwise, ArrowRight, CheckCircle, Eye, EyeSlash, Lightning, ChatCircleText, Tray, Warning, Wrench, X } from '@phosphor-icons/react'
import { useMemo, useState, type ReactNode } from 'react'
import { isOptional, noticeItem, type Notice, type NoticeBoard } from '../../application/notices'
import type { Design } from '../../domain/design/schema'
import type { Catalog } from '../../domain/materials/catalog'
import { fixesForNotice, type Fix } from '../../domain/editing/fixes/fixes'
import { currentDesign, type DesignState } from '../../domain/session/state'
import { answerItem, answerItemId, noticeItemId, type TrayItem } from '../../domain/session/tray/tray'
import { useServices } from '../services'
import { Button, Chip, Stamp } from '../system/components'
import { RadioCard, RadioGroup } from '../system/RadioCard'
import { useExpertStatus } from '../shell/expertStatus'
import { useStore } from '../store'
import { ProposalFixButton } from '../chat/ProposalFix'

// Every notice with its ways out — a solution Knotty builds now, the tray for the expert, or leaving it as it is — resolved together.

const KIND: Record<Notice['kind'], string> = { finding: '', requirement: 'Requisito', problem: 'Sin resolver', proposal: '', question: '' }

type Way = { kind: 'fix'; fix: Fix } | { kind: 'expert'; item: TrayItem } | { kind: 'accept' }

/** One solution covers every piece of the notice: five sagging shelves get five supports in one click. */
function noticeFixes(notice: Notice, design: Design, catalog: Catalog): Fix[] {
  const pieces = new Set(notice.findings.flatMap((h) => h.pieces)).size
  const general = (f: Fix) => (f.key === 'center-divider' || f.key === 'center-support' ? 'Un apoyo al centro, debajo de cada una' : f.label)
  // A thicker board changes only the thin pieces, not every piece the notice names.
  const count = (f: Fix) => (f.key === 'thicker-board' ? f.operations.flatMap((o) => (o.op === 'changeMaterial' ? o.ids : [])).length : pieces)
  const perPiece = new Set(['center-divider', 'center-support', 'thicker-board'])
  return fixesForNotice(design, catalog, notice.findings).map((f) => (count(f) > 1 && perPiece.has(f.key) ? { ...f, label: `${general(f)} (${count(f)} piezas)` } : f))
}

function WayOption({ chosen, caption, icon, label, onChoose, preview }: { chosen: boolean; caption: string; icon?: ReactNode; label?: string; onChoose: () => void; preview?: ReactNode }) {
  const thinking = useStore((s) => s.thinking)
  return (
    <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${chosen ? 'border-graphite bg-paper ring-1 ring-graphite' : 'border-line'}`}>
      <RadioCard variant="bare" checked={chosen} disabled={thinking} onChange={onChoose} className="flex min-h-9 min-w-0 flex-1 items-center gap-3 text-left">
        <span className={`grid size-5 shrink-0 place-items-center rounded-full border-2 ${chosen ? 'border-graphite' : 'border-graphite-2'}`}>{chosen && <span className="size-2 rounded-full bg-graphite" />}</span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-xs font-semibold">
            {icon} {caption}
          </span>
          {label && <span className="block text-sm">{label}</span>}
        </span>
      </RadioCard>
      {preview}
    </div>
  )
}

function PreviewButton({ fix }: { fix: Fix }) {
  const preview = useStore((s) => s.preview)
  const previewFix = useStore((s) => s.previewFix)
  const showing = preview?.label === fix.label
  return (
    <Button variant="ghost" className={`shrink-0 px-3 text-xs ${showing ? 'bg-kraft text-graphite' : ''}`} onClick={() => previewFix(showing ? null : fix)} aria-pressed={showing}>
      {showing ? <EyeSlash /> : <Eye />} {showing ? 'Ocultar' : 'Ver'}
    </Button>
  )
}

function NoticeCard({ notice, state, way, onWay, onAnswer }: { notice: Notice; state: DesignState; way: Way | null; onWay: (way: Way) => void; onAnswer: () => void }) {
  const { catalog } = useServices()
  const select = useStore((s) => s.select)
  const toggleTray = useStore((s) => s.toggleTray)
  const applyProposal = useStore((s) => s.applyProposal)
  const discardProposal = useStore((s) => s.discardProposal)
  const toggleProposal = useStore((s) => s.toggleProposal)
  const showProposal = useStore((s) => s.showProposal)
  const dismissQuestion = useStore((s) => s.dismissQuestion)
  const thinking = useStore((s) => s.thinking)
  const openConnect = useStore((s) => s.openConnect)
  const { available } = useExpertStatus()
  const design = currentDesign(state)
  const fixes = useMemo(() => noticeFixes(notice, design, catalog), [notice, design, catalog])
  const built = new Set(fixes.map((f) => f.key))
  const forExpert = [...new Map(notice.findings.flatMap((h) => h.alternatives).filter((a) => !built.has(a.key)).map((a) => [a.description, a])).values()]
  const name = (id: string) => design.pieces.find((p) => p.id === id)?.name ?? id
  const question = notice.question && state.chat.find((m) => m.id === notice.question!.messageId)?.questions[notice.question.index]
  const answered = notice.question && state.tray.find((t) => t.id === answerItemId(notice.question!.messageId, notice.question!.index))?.label
  const decides = notice.kind === 'finding' || notice.kind === 'requirement' || notice.kind === 'problem'
  const optional = isOptional(notice)
  const risky = notice.kind === 'proposal' && !!state.proposal?.critical.length
  const isExpert = (item: TrayItem) => way?.kind === 'expert' && way.item.text === item.text

  return (
    <li className="flex flex-col gap-3 border-b border-line px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">
          {KIND[notice.kind] && <span className="mr-1.5 text-xs font-normal text-graphite-2">{KIND[notice.kind]} ·</span>}
          {notice.title}
        </span>
        {notice.severity !== 'decision' && <Stamp severity={notice.severity} />}
      </div>
      {notice.reopened && <p className="text-sm text-graphite">{notice.reopened}</p>}
      <p className="text-[15px] leading-snug">{notice.message}</p>
      {notice.pieces.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {notice.pieces.map((id) => (
            <button key={id} type="button" onClick={() => select(id)} className="relative min-h-8 rounded-full border border-line px-3 text-xs text-graphite transition before:absolute before:-inset-x-px before:-inset-y-2 before:content-[''] hover:border-graphite">
              {name(id)}
            </button>
          ))}
        </div>
      )}

      {decides && (
        <RadioGroup label={notice.title} className="flex flex-col gap-2">
          {fixes.map((f) => (
            <WayOption key={f.label} chosen={way?.kind === 'fix' && way.fix.label === f.label} caption="Al instante" icon={<Lightning weight="fill" />} label={f.label} onChoose={() => onWay({ kind: 'fix', fix: f })} preview={<PreviewButton fix={f} />} />
          ))}
          {available &&
            forExpert.map((a) => {
              const item = noticeItem(notice, a.description)
              return <WayOption key={a.description} chosen={isExpert(item)} caption="A la bandeja, para el experto" icon={<Wrench />} label={a.description} onChoose={() => onWay({ kind: 'expert', item })} />
            })}
          {available && !optional && <WayOption chosen={isExpert(noticeItem(notice, null))} caption="A la bandeja, para el experto" icon={<Tray />} label="Que el experto decida" onChoose={() => onWay({ kind: 'expert', item: noticeItem(notice, null) })} />}
          {notice.kind === 'finding' && <WayOption chosen={way?.kind === 'accept'} caption={optional ? 'Dejarlo así' : 'Aceptar así, bajo mi riesgo'} onChoose={() => onWay({ kind: 'accept' })} />}
        </RadioGroup>
      )}
      {decides && !available && forExpert.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-xl bg-kraft px-3 py-2 text-sm">
          <p className="font-medium">Otras formas de resolverlo</p>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            {forExpert.map((a) => (
              <li key={a.description}>{a.description}</li>
            ))}
          </ul>
          <p className="text-graphite-2">Knotty no las aplica sola: para eso, conecta tu experto.</p>
          <Button variant="ghost" className="self-start px-2" onClick={() => openConnect(true)}>
            Conectar experto <ArrowRight weight="bold" />
          </Button>
        </div>
      )}

      {notice.kind === 'proposal' && (
        <div className="flex flex-col gap-2">
          {risky && <ProposalFixButton state={state} />}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={toggleProposal}>
              {showProposal ? <EyeSlash /> : <Eye />} {showProposal ? 'Ver el actual' : 'Ver propuesta'}
            </Button>
            <Button variant={risky ? 'secondary' : 'primary'} className="flex-1" disabled={thinking} onClick={applyProposal}>
              {risky ? 'Aplicar así, bajo mi riesgo' : 'Sí, aplícalo'}
            </Button>
          </div>
          <Button variant="ghost" className="self-start" disabled={thinking} onClick={discardProposal}>
            <ArrowCounterClockwise /> No, déjalo como estaba
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
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={onAnswer} className="flex min-h-11 items-center gap-1 text-sm text-graphite underline">
              <ChatCircleText /> Ver en la conversación
            </button>
            <Button variant="ghost" className="px-3 text-sm text-graphite-2" disabled={thinking} onClick={() => dismissQuestion(notice)}>
              <X /> Descartar
            </Button>
          </div>
        </div>
      )}
    </li>
  )
}

/** What the person set aside, folded away, each with a way back to pending. */
function SetAside({ label, notices, onReopen }: { label: string; notices: Notice[]; onReopen: (notice: Notice) => void }) {
  const [shown, setShown] = useState(false)
  if (!notices.length) return null
  return (
    <div className="px-4 py-3 text-sm">
      <button type="button" className="min-h-11 text-sm text-graphite underline" onClick={() => setShown((v) => !v)}>
        {shown ? 'Ocultar' : 'Ver'} {label} ({notices.length})
      </button>
      {shown && (
        <ul className="mt-2 flex flex-col gap-2">
          {notices.map((n) => (
            <li key={n.key} className="flex items-start gap-2">
              <span className="flex-1">
                <span className="font-medium">{n.title}:</span> {n.message}
              </span>
              <button type="button" onClick={() => onReopen(n)} className="flex min-h-11 shrink-0 items-center gap-1 text-sm underline">
                <ArrowCounterClockwise /> Reabrir
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function NoticePanel({ state, board, onAnswer }: { state: DesignState; board: NoticeBoard; onAnswer: () => void }) {
  const reopenNotice = useStore((s) => s.reopenNotice)
  const reopenQuestion = useStore((s) => s.reopenQuestion)
  const applyFixes = useStore((s) => s.applyFixes)
  const acceptNotice = useStore((s) => s.acceptNotice)
  const toggleTray = useStore((s) => s.toggleTray)
  const sendTray = useStore((s) => s.sendTray)
  const thinking = useStore((s) => s.thinking)
  const [error, setError] = useState<string | null>(null)
  // What is already in the tray for a notice starts out as its chosen way.
  const open = [...board.pending, ...board.recommendations]
  const [ways, setWays] = useState<Record<string, Way>>(() =>
    Object.fromEntries(open.flatMap((n) => state.tray.filter((t) => t.id === noticeItemId(n.key)).map((item) => [n.key, { kind: 'expert', item } as Way]))),
  )
  const chosen = open.filter((n) => ways[n.key])
  const instant = chosen.filter((n) => ways[n.key].kind === 'fix').length
  const toExpert = chosen.filter((n) => ways[n.key].kind === 'expert').length

  const resolve = () => {
    setError(null)
    const fixes = chosen.flatMap((n) => (ways[n.key].kind === 'fix' ? [(ways[n.key] as Extract<Way, { kind: 'fix' }>).fix] : []))
    if (fixes.length) {
      const r = applyFixes(fixes)
      if (!r.ok) return setError(r.message)
    }
    for (const n of chosen) if (ways[n.key].kind === 'accept') acceptNotice(n)
    for (const n of chosen) {
      const way = ways[n.key]
      if (way.kind === 'expert' && !state.tray.some((t) => t.text === way.item.text)) toggleTray(way.item)
    }
    if (toExpert || state.tray.length) consult()
  }

  const consult = () => {
    void sendTray()
    onAnswer()
  }

  return (
    <div className="flex min-h-full flex-col">
      {board.resolved.length > 0 && (
        <ul className="flex flex-col gap-1.5 border-b border-line px-4 py-3 text-sm">
          {board.resolved.map((r) => (
            <li key={r} className="flex items-start gap-2">
              <CheckCircle className="mt-0.5 shrink-0 text-slate" weight="fill" /> Resuelto: {r}
            </li>
          ))}
        </ul>
      )}

      {board.pending.length === 0 && board.recommendations.length === 0 && (
        <div className="flex flex-col items-center gap-2 p-6 text-center text-graphite">
          <Wrench size={28} weight="duotone" className="text-graphite" />
          <p className="font-medium text-graphite">Nada pendiente</p>
          <p className="text-sm">Revisé flecha de entrepaños, espesores por unión, tornillos, vuelco, escuadrado, puertas, base, veta, cajones y el uso del mueble.</p>
        </div>
      )}
      {board.pending.length === 0 && board.recommendations.length > 0 && (
        <p className="flex items-center gap-2 border-b border-line px-4 py-3 text-sm text-graphite">
          <CheckCircle className="shrink-0" /> Nada pendiente
        </p>
      )}
      {board.pending.length > 0 && (
        <ul className="flex flex-col">
          {board.pending.map((n) => (
            <NoticeCard key={n.key} notice={n} state={state} way={ways[n.key] ?? null} onWay={(way) => setWays((w) => ({ ...w, [n.key]: way }))} onAnswer={onAnswer} />
          ))}
        </ul>
      )}

      {board.recommendations.length > 0 && (
        <section aria-labelledby="sturdier">
          <div className="border-b border-line px-4 py-3">
            <h3 id="sturdier" className="font-display text-lg font-semibold">
              Para que dure más
            </h3>
            <p className="text-sm text-graphite-2">{board.pending.some((n) => n.severity === 'critical') ? 'Esto lo haría más firme; es opcional.' : 'Cumple con las reglas. Esto lo haría más firme; es opcional.'}</p>
          </div>
          <ul className="flex flex-col">
            {board.recommendations.map((n) => (
              <NoticeCard key={n.key} notice={n} state={state} way={ways[n.key] ?? null} onWay={(way) => setWays((w) => ({ ...w, [n.key]: way }))} onAnswer={onAnswer} />
            ))}
          </ul>
        </section>
      )}

      <SetAside label="lo que aceptaste así" notices={board.accepted} onReopen={reopenNotice} />

      <SetAside label="lo que descartaste" notices={board.dismissed} onReopen={reopenQuestion} />

      {(chosen.length > 0 || state.tray.length > 0) && (
        <div className="sticky bottom-0 mt-auto flex flex-col gap-2 border-t border-line bg-paper px-4 py-3">
          {error && (
            <p className="flex items-start gap-2 text-sm text-rust">
              <Warning className="mt-0.5 shrink-0" weight="bold" /> {error}
            </p>
          )}
          {chosen.length > 0 && (instant > 0 || toExpert > 0) && (
            <p className="flex items-center gap-4 text-sm text-graphite-2">
              {instant > 0 && (
                <span className="flex items-center gap-1.5">
                  <Lightning weight="fill" className="text-graphite" /> {instant} al instante
                </span>
              )}
              {toExpert > 0 && (
                <span className="flex items-center gap-1.5">
                  <Tray className="text-graphite" /> {toExpert} al experto
                </span>
              )}
            </p>
          )}
          <Button variant="primary" className="min-h-11 w-full" disabled={thinking} onClick={chosen.length ? resolve : consult}>
            {chosen.length ? `Resolver ${chosen.length}` : (
              <>
                <ChatCircleText weight="fill" /> Consultar al experto
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
