import { CheckCircle, WarningCircle, XCircle } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { describeAdjustments, describeStructure, type BenchResult } from '../../application/bench/bench'
import type { BenchCase } from '../../application/bench/cases'
import { problemsOf } from '../../application/bench/report'

export function Verdict({ r }: { r: BenchResult }) {
  if (!r.ok) return <XCircle className="text-rust" weight="fill" aria-label="Falló" />
  if (!problemsOf(r).length) return <CheckCircle className="text-slate" weight="fill" aria-label="Viable" />
  return <WarningCircle className="text-graphite" weight="fill" aria-label="Con observaciones" />
}

interface CaseListProps {
  cases: BenchCase[]
  selected: Set<string>
  results: Record<string, BenchResult | 'running'>
  running: boolean
  onToggle: (id: string) => void
  /** What lets the person open a result's design; each place decides how (the dialog asks first). */
  openAction: (id: string, r: BenchResult) => ReactNode
}

export function CaseList({ cases, selected, results, running, onToggle, openAction }: CaseListProps) {
  return (
    <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-bone">
      {cases.map((c) => {
        const r = results[c.id]
        return (
          <li key={c.id} className="flex flex-col gap-1 px-3 py-2 text-sm">
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" checked={selected.has(c.id)} disabled={running} onChange={() => onToggle(c.id)} />
              <span className="min-w-0 flex-1">
                <span className="font-medium">{c.id}</span> <span className="text-graphite-2">· {c.notes}</span>
              </span>
              {r === 'running' ? <span className="text-xs text-graphite-2">corriendo…</span> : r ? <Verdict r={r} /> : null}
            </label>
            {r && r !== 'running' && (
              <div className="ml-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-graphite-2">
                {r.ok ? (
                  <>
                    <span className="numerals">{r.seconds.toFixed(0)} s</span>
                    <span>{r.path === 'plan' ? 'por ficha' : 'pieza por pieza'}</span>
                    <span>
                      {r.calls} {r.calls === 1 ? 'llamada' : 'llamadas'}
                      {r.corrections.length ? ` (corrigió ${r.corrections.join(', ')})` : ''}
                    </span>
                    {r.inputTokens !== null && <span className="numerals">{r.inputTokens.toLocaleString('es-MX')} tokens de entrada</span>}
                    <span className="numerals">{r.measures} mm</span>
                    {!r.reasonable && <span className="text-rust">medidas raras</span>}
                    {r.structure && <span className={r.structure.ok === false ? 'text-rust' : undefined}>{describeStructure(r.structure)}</span>}
                    <span>
                      {r.verdict}
                      {r.criticals ? ` · ${r.criticals} críticos (${r.rules.join(' ')})` : ''}
                    </span>
                    {r.adjustments.length > 0 && <span>{describeAdjustments(r.adjustments)}</span>}
                    {problemsOf(r).map((p) => (
                      <span key={p} className="basis-full text-rust">
                        {p}
                      </span>
                    ))}
                    {r.state && openAction(c.id, r)}
                  </>
                ) : (
                  <span className="text-rust">
                    {r.error} ({r.seconds.toFixed(0)} s)
                  </span>
                )}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
