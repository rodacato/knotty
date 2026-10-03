import { ArrowSquareOut, DownloadSimple, Flask, Play, Stop, X } from '@phosphor-icons/react'
import * as Dialog from '@radix-ui/react-dialog'
import { useState } from 'react'
import type { ModuleCheck } from '../../application/bench/bench'
import { moduleName, moduleNames } from '../../domain/furniture/modules/plan'
import { useServices } from '../services'
import { Button } from '../system/components'
import { useStore } from '../store'
import { CaseList } from './CaseList'
import { useCaseRun } from './useCaseRun'

// A hidden test bench next to the log: the fixed cases against the connected expert, and every variant of the modules, graded by Knotty's own checks.

export function BenchPanel() {
  const { bench } = useServices()
  const openState = useStore((s) => s.openState)
  const [open, setOpen] = useState(false)
  const [modules, setModules] = useState<ModuleCheck[] | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const { selected, results, running, expert, run, stop, toggle, toggleAll, download, hasResults } = useCaseRun()

  const moduleFailures = modules?.filter((m) => !m.valid || m.findings.length) ?? []

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" className="fixed bottom-3 left-36 z-50 flex items-center gap-1.5 rounded-full bg-graphite px-3 py-1.5 text-xs font-medium text-bone shadow-lg" aria-label="Abrir el banco de pruebas">
          <Flask className="size-4" /> Banco {running && <span className="numerals opacity-70">…</span>}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-graphite/30" />
        <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-full max-w-2xl flex-col bg-paper shadow-2xl">
          <div className="flex items-center gap-2 border-b border-line p-3">
            <Dialog.Title className="flex-1">
              <span className="block font-display text-lg font-semibold">Banco de pruebas</span>
              <span className="block text-xs text-graphite-2">Casos fijos contra {expert}, calificados con las cuentas de Knotty</span>
            </Dialog.Title>
            <Dialog.Description className="sr-only">Corre los casos de prueba contra el experto conectado y revisa los módulos sin experto.</Dialog.Description>
            <Button variant="secondary" className="min-h-8 px-2 text-xs" onClick={() => download(modules)} disabled={!hasResults && !modules}>
              <DownloadSimple /> Exportar
            </Button>
            <Dialog.Close asChild>
              <button type="button" aria-label="Cerrar" className="grid size-8 place-items-center rounded-full hover:bg-kraft">
                <X />
              </button>
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto">
            <section className="flex flex-col gap-2 border-b border-line p-3">
              <div className="flex items-center gap-2">
                <h3 className="flex-1 text-sm font-semibold">Con el experto</h3>
                <button type="button" className="text-xs text-graphite-2 underline" onClick={toggleAll}>
                  {selected.size === bench.cases.length ? 'Ninguno' : 'Todos'}
                </button>
                {running ? (
                  <Button variant="secondary" className="min-h-8 px-3 text-xs" onClick={stop}>
                    <Stop weight="fill" /> Detener
                  </Button>
                ) : (
                  <Button variant="primary" className="min-h-8 px-3 text-xs" disabled={!selected.size} onClick={() => void run()}>
                    <Play weight="fill" /> Correr {selected.size}
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-graphite-2">Le manda al modelo conectado pedidos fijos, como los que escribiría una persona, y califica el diseño que devuelve con las cuentas de Knotty. Toca «Ver qué pasó» en un caso para ver qué se le pidió, qué hizo y qué se comprobó. Cada caso usa tu llave y cuesta lo que un diseño; no toca tu diseño actual. Las respuestas crudas quedan en la bitácora.</p>
              <CaseList
                cases={bench.cases}
                selected={selected}
                results={results}
                running={running}
                onToggle={toggle}
                openAction={(id, r) =>
                  confirming === id ? (
                    <button
                      type="button"
                      className="font-medium text-rust underline"
                      onClick={() => {
                        openState(r.state!)
                        setConfirming(null)
                        setOpen(false)
                      }}
                    >
                      Sí, reemplaza mi diseño
                    </button>
                  ) : (
                    <button type="button" className="flex items-center gap-1 underline" onClick={() => setConfirming(id)}>
                      <ArrowSquareOut /> Abrir en el estudio
                    </button>
                  )
                }
              />
            </section>

            <section className="flex flex-col gap-2 p-3">
              <div className="flex items-center gap-2">
                <h3 className="flex-1 text-sm font-semibold">Sin experto: los módulos de Knotty</h3>
                <Button variant="secondary" className="min-h-8 px-3 text-xs" onClick={() => setModules(bench.runModules())}>
                  <Play weight="fill" /> Revisar
                </Button>
              </div>
              <p className="text-[11px] text-graphite-2">Arma cada variante de {moduleNames()} y marca las que salen inválidas o con avisos: eso es un error de Knotty, no del experto.</p>
              {modules && (
                <p className="text-sm">
                  {modules.length} variantes: {modules.length - moduleFailures.length} limpias
                  {moduleFailures.length ? `, ${moduleFailures.length} con algo` : ''}.
                </p>
              )}
              {moduleFailures.length > 0 && (
                <ul className="flex flex-col gap-1.5">
                  {moduleFailures.map((m) => (
                    <li key={`${m.module}-${m.variant}`} className="rounded-lg bg-kraft/60 p-2 text-xs">
                      <span className="font-medium">
                        {moduleName(m.module)} · {m.variant}
                      </span>
                      {!m.valid && <span className="text-rust"> · inválida</span>}
                      <ul className="mt-1 list-disc pl-4 text-graphite-2">
                        {m.findings.slice(0, 3).map((f) => (
                          <li key={f}>{f}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
