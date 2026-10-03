import { ArrowSquareOut, CaretDown, CaretRight, CheckCircle, Play, Stop, WarningCircle, XCircle } from '@phosphor-icons/react'
import { useState } from 'react'
import { moduleName } from '../../domain/furniture/modules/plan'
import { CaseList } from '../debug/CaseList'
import { useCaseRun } from '../debug/useCaseRun'
import { useServices } from '../services'
import { useStore } from '../store'
import { Button } from '../system/components'
import type { ModuleGroup, Verdict, VariantRow } from './variants'

// The bench inside the workshop: every variant is a door into the Studio, and the expert's cases run from the same place.

const ICON: Record<Verdict, { icon: typeof CheckCircle; className: string; label: string }> = {
  ok: { icon: CheckCircle, className: 'text-slate', label: 'Limpia' },
  note: { icon: WarningCircle, className: 'text-graphite', label: 'Con avisos' },
  invalid: { icon: XCircle, className: 'text-rust', label: 'Inválida' },
}

export const variantKey = (module: string, variant: string) => `${module}/${variant}`

interface LabBenchProps {
  groups: ModuleGroup[]
  opened: string | null
  onOpen: (module: ModuleGroup['module'], row: VariantRow) => void
  onReview: () => void
}

export function LabBench({ groups, opened, onOpen, onReview }: LabBenchProps) {
  const { bench } = useServices()
  const openState = useStore((s) => s.openState)
  const { selected, results, running, expert, run, stop, toggle, toggleAll } = useCaseRun()
  const [folded, setFolded] = useState<Set<string>>(() => new Set(groups.filter((g) => g.variants.every((v) => v.verdict === 'ok')).map((g) => g.module)))
  const rows = groups.flatMap((g) => g.variants)
  const clean = rows.filter((r) => r.verdict === 'ok').length

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex min-h-[60px] shrink-0 items-center gap-2 pr-14 pl-4">
        <h2 className="font-display text-lg font-semibold">Banco de pruebas</h2>
      </div>
      <p className="px-4 pb-2 text-xs leading-snug text-graphite-2">Casos fijos contra {expert}, calificados con las cuentas de Knotty</p>

      <section className="flex flex-col gap-1 px-3 pt-3 pb-2">
        <div className="flex items-center gap-2 px-1">
          <h3 className="flex-1 text-sm font-semibold">Sin experto: los módulos de Knotty</h3>
          <Button variant="secondary" className="px-3 text-xs" onClick={onReview}>
            <Play weight="fill" /> Revisar
          </Button>
        </div>
        <p className="numerals px-1 text-xs text-graphite-2">
          {rows.length} variantes: {clean} limpias{rows.length - clean ? `, ${rows.length - clean} con algo` : ''}.
        </p>
        {groups.map((g) => {
          const isFolded = folded.has(g.module)
          return (
            <div key={g.module} className="flex flex-col">
              <button
                type="button"
                aria-expanded={!isFolded}
                onClick={() => setFolded((f) => (f.has(g.module) ? new Set([...f].filter((m) => m !== g.module)) : new Set([...f, g.module])))}
                className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-left hover:bg-kraft"
              >
                {isFolded ? <CaretRight className="text-graphite-2" /> : <CaretDown className="text-graphite-2" />}
                <span className="font-mono text-[11px] font-bold text-graphite-2">{moduleName(g.module)}</span>
                <span className="flex-1" />
                <span className="text-xs text-graphite-2">{isFolded ? `${g.variants.length} variantes` : ''}</span>
              </button>
              {!isFolded &&
                g.variants.map((v) => {
                  const key = variantKey(g.module, v.variant)
                  const sel = opened === key
                  const { icon: Icon, className, label } = ICON[v.verdict]
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={sel}
                      onClick={() => onOpen(g.module, v)}
                      className={`flex min-h-11 items-center gap-2.5 rounded-lg border px-3 text-left text-sm ${sel ? 'border-amber bg-amber-soft font-semibold' : 'border-transparent hover:bg-kraft'}`}
                    >
                      <Icon weight="regular" className={`shrink-0 ${className}`} size={18} aria-label={label} />
                      <span className="flex-1">{v.variant}</span>
                      {v.notes.length > 0 && (
                        <span className="text-xs font-normal text-graphite-2">
                          {v.notes.length} {v.notes.length === 1 ? 'aviso' : 'avisos'}
                        </span>
                      )}
                    </button>
                  )
                })}
            </div>
          )
        })}
      </section>

      <section className="flex flex-col gap-2 border-t border-line px-3 py-3">
        <div className="flex items-center gap-2 px-1">
          <h3 className="flex-1 text-sm font-semibold">Con el experto</h3>
          <button type="button" className="relative text-xs text-graphite-2 underline before:absolute before:-inset-2.5 before:content-['']" onClick={toggleAll}>
            {selected.size === bench.cases.length ? 'Ninguno' : 'Todos'}
          </button>
          {running ? (
            <Button variant="secondary" className="px-3 text-xs" onClick={stop}>
              <Stop weight="fill" /> Detener
            </Button>
          ) : (
            <Button variant="primary" className="px-3 text-xs" disabled={!selected.size} onClick={() => void run()}>
              <Play weight="fill" /> Correr {selected.size}
            </Button>
          )}
        </div>
        <CaseList
          cases={bench.cases}
          selected={selected}
          results={results}
          running={running}
          onToggle={toggle}
          openAction={(_, r) => (
            <button type="button" className="flex items-center gap-1 underline" onClick={() => openState(r.state!)}>
              <ArrowSquareOut /> Abrir en el estudio
            </button>
          )}
        />
      </section>
    </div>
  )
}
