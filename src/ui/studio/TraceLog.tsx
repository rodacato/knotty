import { CheckCircle, WarningCircle, Wrench, XCircle } from '@phosphor-icons/react'
import { byKnotty, type TraceEntry } from '../../domain/session/trace/trace'

const STEP: Record<TraceEntry['step'], string> = { read: 'Lectura de foto', plan: 'Esqueleto', reconstruct: 'Diseño inicial', adjust: 'Cambio', verdict: 'Revisión antes de comprar' }

const OUTCOME: Record<TraceEntry['outcome'], { label: string; icon: React.ReactNode }> = {
  ok: { label: 'Listo', icon: <CheckCircle weight="fill" className="text-slate" /> },
  invalid: { label: 'No pasó la validación', icon: <WarningCircle weight="fill" className="text-amber" /> },
  unreadable: { label: 'Respuesta ilegible', icon: <WarningCircle weight="fill" className="text-amber" /> },
  failed: { label: 'Falló la conexión', icon: <XCircle weight="fill" className="text-rust" /> },
}

const time = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

/** Every call to the expert, and what Knotty answered alone, newest first: how long it took, what it cost and what went wrong. */
export function TraceLog({ trace, pieces = [] }: { trace: TraceEntry[]; pieces?: { id: string; name: string }[] }) {
  const named = (message: string) => pieces.reduce((m, p) => m.replaceAll(`"${p.id}"`, p.name), message)
  if (!trace.length) return <p className="text-sm text-graphite-2">Todavía no hay llamadas al experto en este diseño.</p>
  const calls = trace.filter((t) => !byKnotty(t)).length
  const alone = trace.length - calls
  const total = trace.reduce((s, t) => s + t.seconds, 0)
  const tokens = trace.reduce((s, t) => s + (t.outputTokens ?? 0), 0)
  return (
    <div className="flex flex-col gap-2">
      <p className="numerals text-xs text-graphite-2">
        {calls} {calls === 1 ? 'llamada' : 'llamadas'}
        {alone ? ` · ${alone} sin experto` : ''} · {Math.round(total)} s{tokens ? ` · ${tokens.toLocaleString('es-MX')} tokens de salida` : ''}
      </p>
      <ol className="flex flex-col divide-y divide-line rounded-xl border border-line bg-bone">
        {[...trace].reverse().map((t, i) => (
          <li key={`${t.at}-${i}`} className="flex flex-col gap-1 px-3 py-2 text-sm">
            <span className="flex items-center gap-2">
              {OUTCOME[t.outcome].icon}
              <span className="font-medium">
                {t.subject ?? STEP[t.step]}
                {t.attempt > 0 ? `, intento ${t.attempt + 1}` : ''}
              </span>
              <span className="numerals ml-auto text-xs text-graphite-2">
                {time.format(new Date(t.at))} · {t.seconds} s{t.outputTokens ? ` · ${t.outputTokens.toLocaleString('es-MX')} tok` : ''}
              </span>
            </span>
            <span className="text-xs text-graphite-2">
              {OUTCOME[t.outcome].label}
              {t.promptId ? ` · ${t.promptId}` : ''}
            </span>
            {t.repairs.length > 0 && (
              <ul className="flex flex-col gap-0.5 text-xs">
                {t.repairs.map((r, j) => (
                  <li key={j} className="flex items-start gap-1.5">
                    <Wrench className="mt-0.5 shrink-0 text-slate" /> {r}
                  </li>
                ))}
              </ul>
            )}
            {t.errors.length > 0 && (
              <ul className="list-disc pl-5 text-xs">
                {t.errors.slice(0, 5).map((e, j) => (
                  <li key={j}>
                    <span className="font-mono text-[11px] text-graphite-2">{e.code}</span> {named(e.message)}
                  </li>
                ))}
                {t.errors.length > 5 && <li className="text-graphite-2">y {t.errors.length - 5} más</li>}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
