import { ArrowSquareOut, CaretDown, CaretRight, CheckCircle, DownloadSimple, Play, Stop, WarningCircle, XCircle } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { moduleName } from '../../domain/furniture/modules/plan'
import { groupVariants, listFichas, type FichaRow, type Verdict, type VariantRow } from '../lab/variants'
import { useServices } from '../services'
import { useStore } from '../store'
import { Button } from '../system/components'
import { CaseList } from './CaseList'
import { useCaseRun } from './useCaseRun'

// «Banco de pruebas»: every variant and ficha is a door into the Studio on a throwaway design, and the expert's fixed cases run from the same place.

const ICON: Record<Verdict, { icon: typeof CheckCircle; className: string; label: string }> = {
  ok: { icon: CheckCircle, className: 'text-slate', label: 'Limpia' },
  note: { icon: WarningCircle, className: 'text-graphite', label: 'Con avisos' },
  invalid: { icon: XCircle, className: 'text-rust', label: 'Inválida' },
}

const EXPLAINER = 'Le manda al modelo conectado pedidos fijos, como los que escribiría una persona, y califica el diseño que devuelve con las cuentas de Knotty. Toca «Ver qué pasó» en un caso para ver qué se le pidió, qué hizo y qué se comprobó. Cuesta tokens.'

function Row({ selected, verdict, children, onClick }: { selected: boolean; verdict: Verdict; children: React.ReactNode; onClick: () => void }) {
  const { icon: Icon, className, label } = ICON[verdict]
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex min-h-11 items-center gap-2.5 rounded-lg border px-3 text-left text-sm ${selected ? 'border-amber bg-amber-soft font-semibold' : 'border-transparent hover:bg-kraft'}`}
    >
      <Icon weight="regular" className={`shrink-0 ${className}`} size={18} aria-label={label} />
      {children}
    </button>
  )
}

export function BenchDrawer() {
  const { bench, references, catalog } = useServices()
  const sandboxed = useStore((s) => s.sandboxed)
  const sandboxExample = useStore((s) => s.sandboxExample)
  const sandboxState = useStore((s) => s.sandboxState)
  const { selected, results, running, expert, run, stop, toggle, toggleAll, download } = useCaseRun()
  const [groups, setGroups] = useState(() => groupVariants(bench))
  const fichas = useMemo(() => listFichas(references.all(), catalog), [references, catalog])
  const [opened, setOpened] = useState<string | null>(null)
  const [folded, setFolded] = useState<Set<string>>(() => new Set(groups.map((g) => g.module)))
  const rows = groups.flatMap((g) => g.variants)
  const clean = rows.filter((r) => r.verdict === 'ok').length
  const current = sandboxed ? opened : null

  const openVariant = (module: string, row: VariantRow) => {
    setOpened(`${module}/${row.variant}`)
    sandboxExample({ name: row.plan.name, plan: row.plan, notes: '' })
  }
  const openFicha = ({ reference: r }: FichaRow) => {
    setOpened(`ficha/${r.code}`)
    sandboxExample({ name: r.name, plan: r.plan, notes: r.notes, ...(r.kind ? { kind: r.kind } : {}), ...(r.finish ? { finish: r.finish } : {}) }, r.code)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex min-h-15 shrink-0 flex-col justify-center pr-14 pl-4">
        <h2 className="font-display text-lg leading-tight font-semibold">Banco de pruebas</h2>
        <p className="text-xs leading-snug text-graphite-2">Casos fijos contra {expert}, calificados con las cuentas de Knotty</p>
      </div>
      <div className="px-3 pb-1">
        <Button variant="ghost" className="px-2 text-xs" onClick={() => download(bench.runModules())}>
          <DownloadSimple /> Exportar
        </Button>
      </div>

      <section className="flex flex-col gap-1 px-3 pt-2 pb-2">
        <div className="flex items-center gap-2 px-1">
          <h3 className="flex-1 text-sm font-semibold">Sin experto: los módulos de Knotty</h3>
          <Button variant="secondary" className="px-3 text-xs" onClick={() => setGroups(groupVariants(bench))}>
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
                {isFolded && <span className="text-xs text-graphite-2">{g.variants.length} variantes</span>}
              </button>
              {!isFolded &&
                g.variants.map((v) => (
                  <Row key={v.variant} selected={current === `${g.module}/${v.variant}`} verdict={v.verdict} onClick={() => openVariant(g.module, v)}>
                    <span className="flex-1">{v.variant}</span>
                    {v.notes.length > 0 && (
                      <span className="text-xs font-normal text-graphite-2">
                        {v.notes.length} {v.notes.length === 1 ? 'aviso' : 'avisos'}
                      </span>
                    )}
                  </Row>
                ))}
            </div>
          )
        })}
      </section>

      <section className="flex flex-col gap-1 border-t border-line px-3 py-3">
        <h3 className="px-1 text-sm font-semibold">Fichas</h3>
        <p className="px-1 pb-1 text-xs leading-snug text-graphite-2">Los muebles de referencia de Knotty. Ábrelos, mejóralos con el experto y exporta el plan.</p>
        {fichas.map((f) => (
          <Row key={f.reference.code} selected={current === `ficha/${f.reference.code}`} verdict={f.verdict} onClick={() => openFicha(f)}>
            <span className="flex-1">{f.reference.name}</span>
            <span className="font-mono text-[11px] font-normal text-graphite-2">
              {f.reference.code} v{f.reference.version}
            </span>
          </Row>
        ))}
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
        <p className="px-1 text-xs leading-snug text-graphite-2">{EXPLAINER}</p>
        <CaseList
          cases={bench.cases}
          selected={selected}
          results={results}
          running={running}
          onToggle={toggle}
          openAction={(_, r) => (
            <button type="button" className="flex items-center gap-1 underline" onClick={() => sandboxState(r.state!)}>
              <ArrowSquareOut /> Abrir en el estudio
            </button>
          )}
        />
      </section>
    </div>
  )
}
