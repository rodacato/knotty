import { ArrowClockwise, CheckCircle, Hammer, Lightbulb, Stop, Warning, WarningCircle, Wrench, XCircle } from '@phosphor-icons/react'
import type { Design } from '../../domain/diseno/schema'
import type { PurchaseReview } from '../../domain/sesion/state'
import type { Check, Verdict } from '../../domain/viabilidad/viability'
import { Button, Pencil } from '../sistema/components'
import { useStore } from '../store'

const VERDICTS: Record<Verdict, { title: string; className: string; icon: React.ReactNode }> = {
  viable: { title: 'Se puede hacer', className: 'border-pizarra/40 bg-pizarra/10 text-pizarra', icon: <CheckCircle weight="fill" /> },
  'needs-changes': { title: 'Arréglalo antes de comprar', className: 'border-ambar/50 bg-ambar-suave text-grafito', icon: <WarningCircle weight="fill" className="text-ambar" /> },
  'not-viable': { title: 'Así no se puede hacer', className: 'border-oxido/40 bg-oxido/10 text-oxido', icon: <XCircle weight="fill" /> },
}

const CHECK_ICON: Record<Check['status'], React.ReactNode> = {
  ok: <CheckCircle weight="fill" className="text-pizarra" />,
  warning: <WarningCircle weight="fill" className="text-ambar" />,
  fail: <XCircle weight="fill" className="text-oxido" />,
}

const GRAVITY = { high: 'border-oxido/40 text-oxido', medium: 'border-ambar/60 text-grafito', low: 'border-linea text-grafito-2' }

const WHAT_IT_CHECKS = ['Que las medidas cierren', 'Que cada pieza quepa en la hoja real', 'Estructura y estabilidad', 'Que se pueda cortar y armar', 'Que las medidas tengan sentido para ese mueble']

/** Before the shopping list: nobody should buy without someone reviewing the plan. */
export function ReviewGate({ stale }: { stale: boolean }) {
  const review = useStore((s) => s.review)
  const cancel = useStore((s) => s.cancelReview)
  const reviewing = useStore((s) => s.reviewing)
  const error = useStore((s) => s.verdictError)

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-linea bg-hueso p-4">
      <p className="flex items-start gap-2 font-medium">
        <Hammer weight="duotone" className="mt-1 shrink-0 text-ambar" /> {stale ? 'Cambió el diseño o los ajustes de corte: hay que revisar de nuevo' : 'Antes de comprar, una revisión'}
      </p>
      <p className="text-sm text-grafito-2">
        Un carpintero revisa tu diseño completo para que no compres algo que no se puede armar. Tarda unos segundos; con tu experto conectado, hasta un par de minutos.
      </p>
      <ul className="flex flex-col gap-1 text-sm">
        {WHAT_IT_CHECKS.map((q) => (
          <li key={q} className="flex items-center gap-2 text-grafito-2">
            <CheckCircle className="shrink-0 text-grafito/30" /> {q}
          </li>
        ))}
      </ul>
      {error && (
        <p className="flex items-start gap-2 rounded-xl border border-oxido/30 bg-oxido/10 p-3 text-sm text-oxido">
          <Warning className="mt-0.5 shrink-0" weight="bold" /> {error}
        </p>
      )}
      {reviewing ? (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-kraft/60 px-3 py-2 text-sm" aria-live="polite">
          <span className="flex items-center gap-2">
            <Pencil className="h-5 w-12 text-ambar" /> Revisando el plano…
          </span>
          <Button variant="ghost" className="min-h-8 px-2 text-xs" onClick={cancel}>
            <Stop weight="fill" /> Cancelar
          </Button>
        </div>
      ) : (
        <Button variant="primary" className="min-h-11 self-start px-5" onClick={() => void review()}>
          {error ? <ArrowClockwise weight="bold" /> : <Hammer weight="bold" />} {error ? 'Reintentar' : stale ? 'Revisar de nuevo' : 'Revisar y ver materiales'}
        </Button>
      )}
    </section>
  )
}

function CheckRow({ c, design, onRequest }: { c: Check; design: Design; onRequest: (text: string) => void }) {
  const select = useStore((s) => s.select)
  const thinking = useStore((s) => s.thinking)
  const piece = c.pieces.find((id) => design.pieces.some((p) => p.id === id))
  return (
    <li className="flex items-start gap-2 py-2 text-sm">
      <span className="mt-0.5 shrink-0">{CHECK_ICON[c.status]}</span>
      <span className="min-w-0 flex-1">
        <span className="font-medium">{c.title}</span>
        <span className={`block text-xs ${c.status === 'ok' ? 'text-grafito-2' : ''}`}>{c.detail}</span>
        {piece && (
          <button type="button" className="text-xs text-grafito-2 underline" onClick={() => select(piece)}>
            Ver en 3D
          </button>
        )}
        {c.status !== 'ok' && c.request && (
          <Button variant="secondary" className="mt-1.5 min-h-8 text-xs" disabled={thinking} onClick={() => onRequest(c.request!)}>
            <Wrench /> {c.request}
          </Button>
        )}
      </span>
    </li>
  )
}

export function VerdictCard({ verdict, design, onRequest }: { verdict: PurchaseReview; design: Design; onRequest: (text: string) => void }) {
  const review = useStore((s) => s.review)
  const reviewing = useStore((s) => s.reviewing)
  const thinking = useStore((s) => s.thinking)
  const v = VERDICTS[verdict.verdict]
  const c = verdict.carpenter

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-linea bg-hueso p-4">
      <div className={`flex items-center gap-2 self-start rounded-full border px-3 py-1 text-sm font-medium ${v.className}`}>
        {v.icon} {v.title}
      </div>
      {c ? (
        <p className="text-[15px] leading-relaxed">{c.summary}</p>
      ) : (
        <p className="text-sm text-grafito-2">
          El carpintero no contestó{verdict.error ? `: ${verdict.error}` : '.'} Lo de abajo son las cuentas, que valen igual.
        </p>
      )}

      {c && c.problems.length > 0 && (
        <ul className="flex flex-col gap-2">
          {c.problems.map((p, i) => (
            <li key={i} className={`flex flex-col gap-1.5 rounded-xl border bg-papel/60 p-3 ${GRAVITY[p.severity]}`}>
              <span className="text-sm font-medium">{p.title}</span>
              <span className="text-sm text-grafito">{p.detail}</span>
              {p.request && (
                <Button variant="secondary" className="min-h-8 self-start text-xs" disabled={thinking} onClick={() => onRequest(p.request!)}>
                  <Wrench /> {p.request}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div>
        <p className="text-xs font-medium tracking-wide text-grafito-2 uppercase">Las cuentas</p>
        <ul className="divide-y divide-linea">
          {verdict.checks.map((x) => (
            <CheckRow key={x.id} c={x} design={design} onRequest={onRequest} />
          ))}
        </ul>
      </div>

      {c && c.tips.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-xl bg-ambar-suave px-3 py-2">
          <p className="flex items-center gap-1.5 text-xs font-medium">
            <Lightbulb weight="fill" className="text-ambar" /> Para el taller
          </p>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
            {c.tips.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      )}

      <Button variant="ghost" className="min-h-8 self-start px-2 text-xs text-grafito-2" disabled={!!reviewing} onClick={() => void review()}>
        <ArrowClockwise /> {reviewing ? 'Revisando…' : 'Revisar de nuevo'}
      </Button>
    </section>
  )
}
