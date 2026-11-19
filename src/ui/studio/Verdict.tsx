import { ArrowClockwise, ArrowCounterClockwise, CheckSquare, Hammer, Warning, Wrench, XSquare } from '@phosphor-icons/react'
import { useId, useRef, useState, type ReactNode } from 'react'
import type { Design } from '../../domain/design/schema'
import type { PurchaseReview } from '../../domain/session/state'
import { purchaseReviewItems, type PurchaseReviewItem } from '../../domain/session/purchaseReview'
import type { Check, Verdict } from '../../domain/checks/viability/viability'
import { Button } from '../system/components'
import { useExpertStatus } from '../shell/expertStatus'
import { useStore } from '../store'
import { withPageTransition } from '../system/pageTransition'
import { ReviewActivity } from './ReviewActivity'
import { Section } from './Section'

// The verdict carries no left bar: that bar marks a warning (UI-93), and «Se puede hacer» is not one.
const VERDICTS: Record<Verdict, { title: string; icon: ReactNode }> = {
  viable: { title: 'Se puede hacer', icon: <CheckSquare className="text-graphite" weight="fill" /> },
  'needs-changes': { title: 'Hay pendientes antes de comprar', icon: <Warning /> },
  'not-viable': { title: 'Así no se puede hacer', icon: <XSquare className="text-rust" weight="fill" /> },
}
const CHECK_ICON: Record<Check['status'], ReactNode> = {
  ok: <CheckSquare weight="fill" className="text-graphite" />,
  warning: <Warning weight="fill" className="text-graphite" />,
  fail: <XSquare weight="fill" className="text-rust" />,
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
      <p className="font-display text-lg leading-none font-semibold uppercase">Siguiente paso</p>
      <h2 className="flex items-start gap-2 text-xl font-semibold"><Hammer weight="bold" className="mt-1 shrink-0" /> {reviewing ? 'Revisión en curso' : stale ? 'Revisar el diseño actualizado' : 'Revisar antes de comprar'}</h2>
      {notice && <p role="status" className="text-sm leading-relaxed">{notice}</p>}
      {reviewing ? <ReviewActivity /> : (
        <>
          <p className="max-w-2xl text-[15px] text-graphite">Knotty comprueba medidas, estructura y acomodo de las piezas en las hojas.{available ? ' Después pide una segunda opinión al experto conectado.' : ' Puedes hacerlo sin conectar un experto.'}</p>
          {error && <p role="alert" className="flex items-start gap-2 border-l-8 border-graphite py-1 pl-4 text-[15px] font-medium text-graphite"><Warning className="mt-0.5 shrink-0" /> {error}</p>}
          {thinking && <p className="text-sm">Espera a que termine el ajuste del experto antes de revisar este diseño.</p>}
          <Button variant="action" className="min-h-12 self-start px-6" disabled={thinking} onClick={() => void review()}>
            {error ? <ArrowClockwise weight="bold" /> : <Hammer weight="bold" />} {error ? 'Reintentar revisión' : stale ? 'Revisar diseño actualizado' : 'Revisar y ver materiales'}
          </Button>
        </>
      )}
    </section>
  )
}

/** `cell`: set inside a ruled row, whose rules already frame it, so it drops its own left bar. */
export function VerdictSummary({ verdict, cell = false }: { verdict: PurchaseReview; cell?: boolean }) {
  const v = VERDICTS[verdict.verdict]
  return (
    <aside role="note" aria-label="Resultado de la revisión" className={cell ? 'flex items-start gap-3' : 'flex max-w-3xl items-start gap-3'}>
      <span className={`shrink-0 ${cell ? 'mt-0.5' : '[&>svg]:size-9 md:[&>svg]:size-11'}`}>{v.icon}</span>
      <div className="min-w-0 space-y-1">
        <h2 className={`font-display leading-tight font-semibold uppercase ${cell ? 'text-xl md:text-2xl' : 'text-3xl md:text-4xl'}`}>{v.title}</h2>
        <p className="text-base leading-relaxed md:text-lg">{verdict.verdict === 'viable' ? 'Confirma los materiales y consulta tu guía para construir.' : verdict.verdict === 'needs-changes' ? 'Decide cómo atenderlos. La guía conserva los problemas que aún no se han corregido.' : 'No compres ni cortes con este diseño. Consulta los cambios necesarios.'}</p>
        {verdict.carpenter ? <details><summary className="flex min-h-11 cursor-pointer items-center text-sm underline">Leer la opinión del experto</summary><p className="pb-1 text-sm leading-relaxed">{verdict.carpenter.summary}</p></details> : <p className="text-base leading-relaxed text-graphite">{verdict.error ? `El experto no respondió: ${verdict.error} Esta revisión incluye solamente las comprobaciones de Knotty.` : 'Revisión de Knotty: medidas, estructura y cortes calculados a partir del diseño.'}</p>}
      </div>
    </aside>
  )
}

/** Where the checkout's next step takes the person: one element per pending decision. */
export const pendingId = (id: string) => `pending-${id}`

function PieceLink({ pieces, design }: { pieces: string[]; design: Design }) {
  const select = useStore((s) => s.select)
  const openCheckout = useStore((s) => s.openCheckout)
  const piece = pieces.find((id) => design.pieces.some((p) => p.id === id))
  const show = (id: string) => withPageTransition('back', () => {
    openCheckout(false)
    select(id)
  })
  return piece ? <button type="button" className="flex min-h-11 items-center self-start text-xs text-graphite-2 underline" onClick={() => show(piece)}>Ver pieza en 3D</button> : null
}

function purpose(item: PurchaseReviewItem) {
  if (item.optional) return { title: 'Mejora opcional', detail: 'Puedes mantener el diseño actual sin aplicar esta mejora.' }
  if (item.source === 'check') return { title: 'Comprobación de Knotty', detail: 'Revisa este dato antes de comprar o construir.' }
  if (item.priority === 'high') return { title: 'Necesario antes de construir', detail: 'Según el experto, puede impedir el armado o afectar la seguridad.' }
  if (item.priority === 'medium') return { title: 'Para evitar fallas con el uso', detail: 'El experto recomienda un cambio. Mantenerlo no corrige el problema.' }
  return { title: 'Detalle por revisar', detail: 'La revisión pide cambios; consulta si este detalle debe corregirse.' }
}

/** `wall`: the question about the wall, a decision like the review's own, so it is counted and listed with them. */
export function VerdictCard({ verdict, design, onRequest, wall = null }: { verdict: PurchaseReview; design: Design; onRequest: (text: string) => void; wall?: ReactNode }) {
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
  const total = items.length + (wall ? 1 : 0)
  const pending = undecided.length + (wall ? 1 : 0)
  return (
    <div className="flex flex-col gap-4">
      {/* What the person has to do on this page, so it heads its block like a section of the ticket (UI-93). */}
      <div role="status" className="flex flex-col gap-1 border-t-[3px] border-graphite pt-3">
        <p className="font-display text-2xl leading-tight font-semibold uppercase md:text-3xl">{total ? `${pending} ${pending === 1 ? 'decisión por tomar' : 'decisiones por tomar'} de ${total}` : 'No hay decisiones pendientes en esta revisión'}</p>
        {total > 0 && <p className="text-base leading-relaxed md:text-lg">Abre un pendiente para revisar el motivo y elegir qué hacer.</p>}
      </div>
      {choices.length > 0 && <p role="status" className="text-sm leading-relaxed text-graphite">Tus decisiones quedan registradas. Solo un cambio aplicado y revisado puede corregir los problemas.</p>}
      <div className="flex flex-col gap-3">
        {wall && <div id={pendingId('wall')}>{wall}</div>}
        {items.map((item) => {
          const choice = choices.find((choice) => choice.id === item.id)?.choice
          const why = purpose(item)
          const question = !item.request || /^[¿?]/.test(item.request.trim())
          return (
            <div key={item.id} id={pendingId(item.id)} className={`max-w-3xl scroll-mt-20 border-2 border-graphite ${item.priority === 'high' && !item.optional ? 'border-l-8' : ''}`}><details open={open === item.id} onToggle={(event) => { if (event.currentTarget.open) { setOpen(item.id); setConfirm(null) } else setOpen((current) => current === item.id ? null : current) }}>
              <summary ref={(element) => { if (element) summaries.current.set(item.id, element); else summaries.current.delete(item.id) }} className="min-h-11 cursor-pointer p-3 text-base marker:text-graphite md:text-lg">
                <span className="font-medium">{item.title}</span>
                <span className="mt-1 block pl-4 text-sm text-graphite">{choice ? REVIEW_CHOICE[choice] : why.title}</span>
              </summary>
              <div className="flex flex-col gap-3 px-3 pb-3">
                <p className="text-sm leading-relaxed text-graphite">{why.detail}</p>
                <p className="text-base leading-relaxed">{item.detail}</p>
                <PieceLink pieces={item.pieces} design={design} />
                {!choice && confirm !== item.id && <div className="flex flex-wrap gap-3">
                  <Button variant="secondary" className="px-3 text-xs" disabled={thinking} onClick={() => request(item)}><Wrench /> {available ? question ? 'Preguntar cómo resolverlo' : 'Pedir ajuste al experto' : question ? 'Conectar experto para consultar' : 'Conectar experto para pedir el ajuste'}</Button>
                  <Button variant="ghost" className="px-2 text-xs" disabled={thinking} onClick={() => { setConfirm(item.id); requestAnimationFrame(() => confirmation.current?.focus()) }}>{item.optional ? 'Dejarlo así' : 'Aceptar así, bajo mi riesgo'}</Button>
                </div>}
                {confirm === item.id && <div ref={confirmation} tabIndex={-1} className="flex flex-col gap-3 border-l-4 border-graphite py-1 pl-3 focus-visible:outline-2 focus-visible:outline-focus" role="group" aria-label="Confirmar decisión" aria-describedby={confirmationId}>
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
      {!!verdict.carpenter?.tips.length && <Section minor title="Consejos opcionales para el taller"><ul className="max-w-3xl list-disc space-y-2 py-2 pl-5 text-[15px] leading-relaxed">{verdict.carpenter.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul></Section>}
    </div>
  )
}

/** What Knotty itself checked, as one ruled band of cells: the evidence under the verdict, not a decision (UI-93). */
export function ReviewChecks({ verdict }: { verdict: PurchaseReview }) {
  const review = useStore((s) => s.review)
  const thinking = useStore((s) => s.thinking)
  const notes = verdict.checks.filter((check) => check.status !== 'ok').length
  const passed = verdict.checks.filter((check) => check.status === 'ok').length
  return (
    <section aria-label="Comprobaciones de Knotty" className="flex flex-col gap-3 border-t-[3px] border-graphite pt-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="font-display text-2xl leading-none font-semibold uppercase md:text-3xl">Comprobaciones de Knotty</h2>
        <span className="border-l-[3px] border-graphite pl-3 text-base text-graphite md:text-lg">{notes ? `${notes} ${notes === 1 ? 'nota por revisar' : 'notas por revisar'}` : `${passed} sin pendientes`}</span>
        <Button variant="secondary" className="min-h-11 px-4 md:ml-auto" disabled={thinking} onClick={() => void review()}><ArrowClockwise weight="bold" /> Repetir revisión</Button>
      </div>
      <ul className="grid border-t-2 border-l-2 border-graphite sm:grid-cols-2 lg:grid-cols-3">
        {verdict.checks.map((check) => <li key={check.id} className="flex items-start gap-2 border-r-2 border-b-2 border-graphite p-3"><span className="mt-0.5 shrink-0">{CHECK_ICON[check.status]}</span><div className="min-w-0 space-y-1"><p className="text-base font-semibold">{check.title}</p><p className="text-sm leading-relaxed text-graphite">{check.detail}</p></div></li>)}
      </ul>
    </section>
  )
}
