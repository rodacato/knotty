import { ArrowClockwise, ArrowCounterClockwise, CheckCircle, Hammer, Warning, WarningCircle, Wrench, XCircle } from '@phosphor-icons/react'
import { useId, useRef, useState, type ReactNode } from 'react'
import type { Design } from '../../domain/design/schema'
import type { PurchaseReview } from '../../domain/session/state'
import { purchaseReviewItems, type PurchaseReviewItem } from '../../domain/session/purchaseReview'
import type { Check, Verdict } from '../../domain/checks/viability/viability'
import { Button } from '../system/components'
import { useExpertStatus } from '../shell/expertStatus'
import { useStore } from '../store'
import { ReviewActivity } from './ReviewActivity'

const VERDICTS: Record<Verdict, { title: string; className: string; icon: ReactNode }> = {
  viable: { title: 'Se puede hacer', className: 'border-slate/40', icon: <CheckCircle className="text-slate" weight="fill" /> },
  'needs-changes': { title: 'Hay pendientes antes de comprar', className: 'border-graphite/40', icon: <WarningCircle /> },
  'not-viable': { title: 'Así no se puede hacer', className: 'border-rust/40', icon: <XCircle className="text-rust" weight="fill" /> },
}
const CHECK_ICON: Record<Check['status'], ReactNode> = {
  ok: <CheckCircle weight="fill" className="text-slate" />,
  warning: <WarningCircle weight="fill" className="text-graphite" />,
  fail: <XCircle weight="fill" className="text-rust" />,
}
export const REVIEW_CHOICE = { keep: 'Decidiste dejarlo así', risk: 'Aceptado por ti, bajo tu riesgo', requested: 'Solicitud enviada al experto' }

export function ReviewGate({ stale }: { stale: boolean }) {
  const review = useStore((s) => s.review)
  const reviewing = useStore((s) => s.reviewing)
  const thinking = useStore((s) => s.thinking)
  const error = useStore((s) => s.verdictError)
  const notice = useStore((s) => s.reviewNotice)
  const { available } = useExpertStatus()
  return (
    <section className="flex flex-col gap-3" aria-label="Siguiente paso">
      <p className="text-xs font-medium text-graphite-2">Siguiente paso</p>
      <h2 className="flex items-start gap-2 font-medium"><Hammer weight="duotone" className="mt-1 shrink-0" /> {reviewing ? 'Revisión en curso' : stale ? 'Revisar el diseño actualizado' : 'Revisar antes de comprar'}</h2>
      {notice && <p role="status" className="text-sm leading-relaxed">{notice}</p>}
      {reviewing ? <ReviewActivity /> : (
        <>
          <p className="text-sm text-graphite">Knotty comprueba medidas, estructura y acomodo de las piezas en las hojas.{available ? ' Después pide una segunda opinión al experto conectado.' : ' Puedes hacerlo sin conectar un experto.'}</p>
          {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-rust/30 bg-rust/10 p-3 text-sm text-rust"><Warning className="mt-0.5 shrink-0" /> {error}</p>}
          {thinking && <p className="text-sm">Espera a que termine el ajuste del experto antes de revisar este diseño.</p>}
          <Button variant="primary" className="self-start px-5" disabled={thinking} onClick={() => void review()}>
            {error ? <ArrowClockwise weight="bold" /> : <Hammer weight="bold" />} {error ? 'Reintentar revisión' : stale ? 'Revisar diseño actualizado' : 'Revisar y ver materiales'}
          </Button>
        </>
      )}
    </section>
  )
}

export function VerdictSummary({ verdict }: { verdict: PurchaseReview }) {
  const v = VERDICTS[verdict.verdict]
  return (
    <aside role="note" aria-label="Resultado de la revisión" className={`flex items-start gap-3 rounded-xl border bg-kraft p-3 ${v.className}`}>
      <span className="mt-0.5 shrink-0">{v.icon}</span>
      <div className="min-w-0 space-y-1">
        <h2 className="text-sm font-semibold">{v.title}</h2>
        <p className="text-xs leading-relaxed">{verdict.verdict === 'viable' ? 'Confirma los materiales y consulta tu guía para construir.' : verdict.verdict === 'needs-changes' ? 'Decide cómo atenderlos. La guía conserva los problemas que aún no se han corregido.' : 'No compres ni cortes con este diseño. Consulta los cambios necesarios.'}</p>
        {verdict.carpenter ? <details><summary className="flex min-h-11 cursor-pointer items-center text-xs underline">Leer la opinión del experto</summary><p className="pb-1 text-sm leading-relaxed">{verdict.carpenter.summary}</p></details> : <p className="text-xs leading-relaxed text-graphite-2">{verdict.error ? `El experto no respondió: ${verdict.error} Esta revisión incluye solamente las comprobaciones de Knotty.` : 'Revisión de Knotty: medidas, estructura y cortes calculados a partir del diseño.'}</p>}
      </div>
    </aside>
  )
}

function PieceLink({ pieces, design }: { pieces: string[]; design: Design }) {
  const select = useStore((s) => s.select)
  const piece = pieces.find((id) => design.pieces.some((p) => p.id === id))
  return piece ? <button type="button" className="flex min-h-11 items-center self-start text-xs text-graphite-2 underline" onClick={() => select(piece)}>Ver pieza en 3D</button> : null
}

function purpose(item: PurchaseReviewItem) {
  if (item.optional) return { title: 'Mejora opcional', detail: 'Puedes mantener el diseño actual sin aplicar esta mejora.' }
  if (item.source === 'check') return { title: 'Comprobación de Knotty', detail: 'Revisa este dato antes de comprar o construir.' }
  if (item.priority === 'high') return { title: 'Necesario antes de construir', detail: 'Según el experto, puede impedir el armado o afectar la seguridad.' }
  if (item.priority === 'medium') return { title: 'Para evitar fallas con el uso', detail: 'El experto recomienda un cambio. Mantenerlo no corrige el problema.' }
  return { title: 'Detalle por revisar', detail: 'La revisión pide cambios; consulta si este detalle debe corregirse.' }
}

export function VerdictCard({ verdict, design, onRequest }: { verdict: PurchaseReview; design: Design; onRequest: (text: string) => void }) {
  const review = useStore((s) => s.review)
  const choose = useStore((s) => s.choosePurchaseReview)
  const thinking = useStore((s) => s.thinking)
  const openConnect = useStore((s) => s.openConnect)
  const { available } = useExpertStatus()
  const items = purchaseReviewItems(verdict)
  const choices = verdict.choices ?? []
  const undecided = items.filter((item) => !choices.some((choice) => choice.id === item.id))
  const [open, setOpen] = useState<string | null>(undecided[0]?.id ?? null)
  const confirmation = useRef<HTMLDivElement>(null)
  const confirmationId = useId()
  const summaries = useRef(new Map<string, HTMLElement>())
  const [confirm, setConfirm] = useState<string | null>(null)
  const decided = (item: PurchaseReviewItem, choice: 'keep' | 'risk' | 'requested') => {
    choose(item.id, choice)
    setConfirm(null)
    const next = undecided.find((next) => next.id !== item.id)?.id ?? null
    setOpen(next)
    requestAnimationFrame(() => summaries.current.get(next ?? item.id)?.focus())
  }
  const request = (item: PurchaseReviewItem) => {
    if (!available) return openConnect(true)
    decided(item, 'requested')
    onRequest(item.request ?? `Explícame cómo resolver este pendiente: ${item.title}. ${item.detail}`)
  }
  const notes = verdict.checks.filter((check) => check.status !== 'ok').length
  const passed = verdict.checks.filter((check) => check.status === 'ok').length
  return (
    <div className="flex flex-col gap-4">
      <p role="status" className="text-sm leading-relaxed">{items.length ? `${undecided.length} ${undecided.length === 1 ? 'decisión por tomar' : 'decisiones por tomar'} de ${items.length}. Abre un pendiente para revisar el motivo y elegir qué hacer.` : 'No hay decisiones pendientes en esta revisión.'}</p>
      {choices.length > 0 && <p role="status" className="text-xs leading-relaxed text-graphite-2">Tus decisiones quedan registradas. Solo un cambio aplicado y revisado puede corregir los problemas.</p>}
      <div className="flex flex-col gap-3">
        {items.map((item) => {
          const choice = choices.find((choice) => choice.id === item.id)?.choice
          const why = purpose(item)
          const question = !item.request || /^[¿?]/.test(item.request.trim())
          return (
            <div key={item.id} className={`rounded-xl border bg-paper/60 ${item.priority === 'high' && !item.optional ? 'border-rust/40' : 'border-line'}`}><details open={open === item.id} onToggle={(event) => { if (event.currentTarget.open) { setOpen(item.id); setConfirm(null) } else setOpen((current) => current === item.id ? null : current) }}>
              <summary ref={(element) => { if (element) summaries.current.set(item.id, element); else summaries.current.delete(item.id) }} className="min-h-11 cursor-pointer rounded-xl p-3 text-sm marker:text-graphite-2">
                <span className="font-medium">{item.title}</span>
                <span className="mt-1 block pl-4 text-xs text-graphite-2">{choice ? REVIEW_CHOICE[choice] : why.title}</span>
              </summary>
              <div className="flex flex-col gap-3 px-3 pb-3">
                <p className="text-xs leading-relaxed text-graphite-2">{why.detail}</p>
                <p className="text-sm leading-relaxed">{item.detail}</p>
                <PieceLink pieces={item.pieces} design={design} />
                {!choice && confirm !== item.id && <div className="flex flex-wrap gap-3">
                  <Button variant="secondary" className="px-3 text-xs" disabled={thinking} onClick={() => request(item)}><Wrench /> {available ? question ? 'Preguntar cómo resolverlo' : 'Pedir ajuste al experto' : question ? 'Conectar experto para consultar' : 'Conectar experto para pedir el ajuste'}</Button>
                  <Button variant="ghost" className="px-2 text-xs" disabled={thinking} onClick={() => { setConfirm(item.id); requestAnimationFrame(() => confirmation.current?.focus()) }}>{item.optional ? 'Dejarlo así' : 'Aceptar así, bajo mi riesgo'}</Button>
                </div>}
                {confirm === item.id && <div ref={confirmation} tabIndex={-1} className="flex flex-col gap-3 rounded-lg bg-kraft p-3 focus-visible:outline-2 focus-visible:outline-focus" role="group" aria-label="Confirmar decisión" aria-describedby={confirmationId}>
                  <p id={confirmationId} className="text-sm leading-relaxed">{item.optional ? '¿Quieres mantener el diseño sin esta mejora? Puedes deshacer esta decisión.' : 'Este problema seguirá en el diseño, la guía y la lista. Aceptarlo no significa que sea seguro ni que esté corregido. ¿Quieres mantenerlo así, bajo tu riesgo?'}</p>
                  <div className="flex flex-wrap gap-3"><Button variant="secondary" className="px-3 text-xs" disabled={thinking} onClick={() => decided(item, item.optional ? 'keep' : 'risk')}>{item.optional ? 'Confirmar: dejarlo así' : 'Confirmar: aceptar bajo mi riesgo'}</Button><Button variant="ghost" className="px-2 text-xs" onClick={() => { setConfirm(null); summaries.current.get(item.id)?.focus() }}>Volver</Button></div>
                </div>}
                {choice && <p className="text-xs leading-relaxed">{choice === 'requested' ? 'Revisa la respuesta en Conversación. La solicitud no aplica cambios por sí sola.' : item.optional ? 'Conservas el diseño sin esta mejora.' : 'El pendiente sigue presente; resuélvelo antes de comprar o cortar.'}</p>}
              </div>
            </details>
              {choice && <button type="button" className="mx-3 mb-2 flex min-h-11 items-center gap-1 text-xs underline" disabled={thinking} onClick={() => { choose(item.id, null); setConfirm(null); setOpen(item.id); requestAnimationFrame(() => summaries.current.get(item.id)?.focus()) }}><ArrowCounterClockwise /> Deshacer decisión{choice === 'requested' ? ' (no cancela la solicitud)' : ''}</button>}
            </div>
          )
        })}
      </div>
      <details className="border-t border-line pt-2">
        <summary className="min-h-11 cursor-pointer text-sm font-medium">Comprobaciones de Knotty · {notes ? `${notes} ${notes === 1 ? 'nota por revisar' : 'notas por revisar'}` : `${passed} sin pendientes`}</summary>
        <ul className="divide-y divide-line">
          {verdict.checks.map((check) => <li key={check.id} className="flex items-start gap-2 py-3 text-sm"><span className="mt-0.5 shrink-0">{CHECK_ICON[check.status]}</span><div className="min-w-0 space-y-1"><p className="font-medium">{check.title}</p><p className="text-xs leading-relaxed">{check.detail}</p></div></li>)}
        </ul>
        <Button variant="ghost" className="mt-2 px-2 text-xs" disabled={thinking} onClick={() => void review()}><ArrowClockwise /> Repetir revisión</Button>
      </details>
      {!!verdict.carpenter?.tips.length && <details className="border-t border-line pt-2"><summary className="min-h-11 cursor-pointer text-sm font-medium">Consejos opcionales para el taller</summary><ul className="list-disc space-y-2 py-2 pl-5 text-sm leading-relaxed">{verdict.carpenter.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul></details>}
    </div>
  )
}
