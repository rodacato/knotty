import { ArrowClockwise, CheckCircle, Hammer, Warning, WarningCircle, Wrench, XCircle } from '@phosphor-icons/react'
import { useId, useRef, type ReactNode } from 'react'
import type { Design } from '../../domain/design/schema'
import type { PurchaseReview } from '../../domain/session/state'
import type { Check, Verdict } from '../../domain/checks/viability/viability'
import { Button } from '../system/components'
import { useExpertStatus } from '../shell/expertStatus'
import { useStore } from '../store'
import { ReviewActivity } from './ReviewActivity'

const VERDICTS: Record<Verdict, { title: string; className: string; icon: ReactNode }> = {
  viable: { title: 'Se puede hacer', className: 'border-slate/40 bg-slate/10 text-slate', icon: <CheckCircle weight="fill" /> },
  'needs-changes': { title: 'Arréglalo antes de comprar', className: 'border-graphite/60 bg-kraft text-graphite', icon: <WarningCircle /> },
  'not-viable': { title: 'Así no se puede hacer', className: 'border-rust/40 bg-rust/10 text-rust', icon: <XCircle weight="fill" /> },
}

const CHECK_ICON: Record<Check['status'], ReactNode> = {
  ok: <CheckCircle weight="fill" className="text-slate" />,
  warning: <WarningCircle weight="fill" className="text-graphite" />,
  fail: <XCircle weight="fill" className="text-rust" />,
}

const GRAVITY = { high: 'border-rust/40 text-rust', medium: 'border-graphite/40 text-graphite', low: 'border-line text-graphite-2' }
const PRIORITY = { high: 'Problema crítico', medium: 'Cambio necesario', low: 'Mejora opcional' }
const REQUESTS = {
  change: { label: 'Pedir ajuste al experto', connect: 'Conectar experto para pedir el ajuste', help: 'Este cambio se solicita al experto en Conversación.', unavailable: 'Conecta un experto para solicitar este cambio.' },
  question: { label: 'Preguntar cómo resolverlo', connect: 'Conectar experto para consultar', help: 'Abre una consulta en Conversación sobre este pendiente.', unavailable: 'Conecta un experto para consultar este pendiente.' },
}

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

function AdjustmentButton({ request, onRequest, question = false, primary = false }: { request: string; onRequest: (text: string) => void; question?: boolean; primary?: boolean }) {
  const thinking = useStore((s) => s.thinking)
  const openConnect = useStore((s) => s.openConnect)
  const { available } = useExpertStatus()
  const copy = question ? REQUESTS.question : REQUESTS.change
  return (
    <div className="mt-1 flex flex-col items-start gap-1">
      {!question && <p className="text-xs text-graphite">Cambio solicitado: {request}</p>}
      <Button variant={primary ? 'primary' : 'secondary'} className="self-start px-3 text-xs" disabled={thinking} onClick={() => available ? onRequest(request) : openConnect(true)}>
        <Wrench /> {available ? copy.label : copy.connect}
      </Button>
      <p className="text-xs text-graphite-2">{available ? copy.help : copy.unavailable}</p>
    </div>
  )
}

function PieceLink({ pieces, design }: { pieces: string[]; design: Design }) {
  const select = useStore((s) => s.select)
  const piece = pieces.find((id) => design.pieces.some((p) => p.id === id))
  return piece ? <button type="button" className="relative self-start text-xs text-graphite-2 underline before:absolute before:-inset-y-3.5 before:inset-x-0" onClick={() => select(piece)}>Ver pieza en 3D</button> : null
}

function CheckRow({ c, design, onRequest }: { c: Check; design: Design; onRequest: (text: string) => void }) {
  return (
    <li className="flex items-start gap-2 py-2 text-sm">
      <span className="mt-0.5 shrink-0">{CHECK_ICON[c.status]}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="font-medium">{c.title}</p>
        <p className={`text-xs ${c.status === 'ok' ? 'text-graphite-2' : ''}`}>{c.detail}</p>
        <PieceLink pieces={c.pieces} design={design} />
        {c.status !== 'ok' && <AdjustmentButton request={c.request ?? `Explícame cómo resolver este pendiente: ${c.title}. ${c.detail}`} question={!c.request} onRequest={onRequest} />}
      </div>
    </li>
  )
}

export function VerdictCard({ verdict, design, onRequest, children }: { verdict: PurchaseReview; design: Design; onRequest: (text: string) => void; children?: ReactNode }) {
  const review = useStore((s) => s.review)
  const thinking = useStore((s) => s.thinking)
  const v = VERDICTS[verdict.verdict]
  const c = verdict.carpenter
  const pending = verdict.checks.filter((check) => check.status !== 'ok')
  const passed = verdict.checks.filter((check) => check.status === 'ok')
  const problems = c?.problems.filter((problem) => verdict.verdict !== 'viable' || problem.severity !== 'low') ?? []
  const suggestions = verdict.verdict === 'viable' ? c?.problems.filter((problem) => problem.severity === 'low') ?? [] : []
  const pendingRef = useRef<HTMLDivElement>(null)
  const pendingId = useId()
  const hasPending = pending.length > 0 || problems.length > 0
  const showPending = () => {
    pendingRef.current?.focus({ preventScroll: true })
    pendingRef.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' })
  }
  const problemRows = (rows: NonNullable<typeof c>['problems']) => rows.map((p, i) => (
    <li key={i} className={`flex flex-col gap-2 rounded-xl border bg-paper/60 p-3 ${GRAVITY[p.severity]}`}>
      <p className="text-xs font-medium">{p.severity === 'low' && verdict.verdict !== 'viable' ? 'Detalle por revisar' : PRIORITY[p.severity]}</p>
      <p className="text-sm font-medium">{p.title}</p>
      <p className="text-sm text-graphite">{p.detail}</p>
      <PieceLink pieces={p.pieces} design={design} />
      {p.request ? <AdjustmentButton request={p.request} onRequest={onRequest} /> : verdict.verdict !== 'viable' && <AdjustmentButton request={`Explícame cómo resolver este pendiente: ${p.title}. ${p.detail}`} question onRequest={onRequest} />}
    </li>
  ))
  return (
    <section className="flex flex-col gap-4" aria-label="Resultado de la revisión">
      <h2 role="status" className={`flex items-center gap-2 self-start rounded-xl border px-3 py-2 ${verdict.verdict === 'viable' ? 'text-sm font-medium' : 'text-xl font-semibold'} ${v.className}`}>{v.icon} {v.title}</h2>
      {c ? <p className="text-sm leading-relaxed">{c.summary}</p> : <p className="text-sm text-graphite">{verdict.error ? `El experto no respondió: ${verdict.error} Esta revisión incluye solamente las comprobaciones de Knotty.` : 'Revisión de Knotty: medidas, estructura y cortes calculados a partir del diseño.'}</p>}
      {verdict.verdict !== 'viable' && hasPending && (
        <div className="flex flex-col items-start gap-2" aria-label="Siguiente paso">
          <p className="text-xs font-medium text-graphite-2">Siguiente paso</p>
          <p className="text-sm">Revisa los pendientes antes de comprar o cortar.</p>
          <Button variant="primary" className="px-4" onClick={showPending} aria-controls={pendingId}>Ver qué corregir</Button>
        </div>
      )}
      {verdict.verdict !== 'viable' && !hasPending && (
        <div className="flex flex-col gap-2" aria-label="Siguiente paso">
          <p className="text-xs font-medium text-graphite-2">Siguiente paso</p>
          <p className="text-sm">La revisión pide cambios, pero no detalla cómo hacerlos. Consulta al experto antes de comprar o cortar.</p>
          <AdjustmentButton request={`Explícame qué debo corregir en este diseño: ${c?.summary ?? v.title}`} question primary onRequest={onRequest} />
        </div>
      )}
      {verdict.verdict === 'viable' && children}
      {hasPending && (
        <div ref={pendingRef} id={pendingId} tabIndex={-1} className="flex flex-col gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-focus">
          <h3 className="text-sm font-medium">Pendientes antes de comprar</h3>
          {problems.length > 0 && <ul className="flex flex-col gap-2">{problemRows(problems)}</ul>}
          {pending.length > 0 && <ul className="divide-y divide-line">{pending.map((check) => <CheckRow key={check.id} c={check} design={design} onRequest={onRequest} />)}</ul>}
        </div>
      )}
      {verdict.verdict !== 'viable' && children}
      <details className="border-t border-line pt-2">
        <summary className="min-h-11 cursor-pointer text-sm font-medium">Detalles de la revisión · {passed.length} comprobaciones sin pendientes</summary>
        <div className="flex flex-col gap-3 pt-2">
          <ul className="divide-y divide-line">{passed.map((check) => <CheckRow key={check.id} c={check} design={design} onRequest={onRequest} />)}</ul>
          <p className="text-xs text-graphite-2">Puedes repetir la revisión para consultar otra vez al experto conectado.</p>
          <Button variant="ghost" className="self-start px-2 text-xs" disabled={thinking} onClick={() => void review()}><ArrowClockwise /> Repetir revisión</Button>
        </div>
      </details>
      {(suggestions.length > 0 || (c?.tips.length ?? 0) > 0) && (
        <details className="border-t border-line pt-2">
          <summary className="min-h-11 cursor-pointer text-sm font-medium">Consejos opcionales para el taller</summary>
          <div className="flex flex-col gap-3 pt-2">
            {suggestions.length > 0 && <ul className="flex flex-col gap-2">{problemRows(suggestions)}</ul>}
            {c && <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">{c.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>}
          </div>
        </details>
      )}
    </section>
  )
}
