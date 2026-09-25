import { ArrowSquareOut, CheckCircle, DownloadSimple, Flask, Play, Stop, WarningCircle, X, XCircle } from '@phosphor-icons/react'
import * as Dialog from '@radix-ui/react-dialog'
import { useRef, useState } from 'react'
import type { BenchResult, ModuleCheck } from '../../application/bench/bench'
import { useServices } from '../services'
import { Button } from '../sistema/components'
import { useStore } from '../store'

// A hidden test bench next to the log: the fixed cases against the connected expert, and every variant of the modules, graded by Knotty's own checks.

/** Two at a time, as in the comparison script: enough to be quick without hitting a provider's limits. */
const PARALLEL = 2

function Verdict({ r }: { r: BenchResult }) {
  if (!r.ok) return <XCircle className="text-oxido" weight="fill" aria-label="Falló" />
  if (r.verdict === 'viable' && r.reasonable) return <CheckCircle className="text-pizarra" weight="fill" aria-label="Viable" />
  return <WarningCircle className="text-ambar" weight="fill" aria-label="Con observaciones" />
}

const MODULE_LABEL: Record<ModuleCheck['module'], string> = { bed: 'cama', table: 'mesa', cabinet: 'gabinete' }

export function BenchPanel() {
  const { bench, preferences } = useServices()
  const openState = useStore((s) => s.openState)
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set(bench.cases.map((c) => c.id)))
  const [results, setResults] = useState<Record<string, BenchResult | 'running'>>({})
  const [modules, setModules] = useState<ModuleCheck[] | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const controller = useRef<AbortController | null>(null)
  const running = Object.values(results).some((r) => r === 'running')
  const prefs = preferences.load()
  const expert = prefs.active === 'simulated' ? 'Simulado' : `${prefs.active} · ${prefs.connections[prefs.active].model}`

  const run = async () => {
    const ctrl = new AbortController()
    controller.current = ctrl
    const queue = bench.cases.filter((c) => selected.has(c.id))
    setResults((r) => ({ ...r, ...Object.fromEntries(queue.map((c) => [c.id, 'running' as const])) }))
    const worker = async () => {
      for (let c = queue.shift(); c && !ctrl.signal.aborted; c = queue.shift()) {
        const r = await bench.runCase(c, ctrl.signal)
        setResults((all) => ({ ...all, [c.id]: r }))
      }
    }
    await Promise.all(Array.from({ length: PARALLEL }, worker))
    // Whatever did not start stays as it was before the run.
    setResults((all) => Object.fromEntries(Object.entries(all).filter(([, r]) => r !== 'running')))
  }

  const download = () => {
    const done = Object.values(results).filter((r): r is BenchResult => r !== 'running')
    const bundle = { format: 'knotty-bench@1', exportedAt: new Date().toISOString(), commit: __APP_COMMIT__, expert, results: done, modules }
    const url = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `knotty-banco-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const moduleFailures = modules?.filter((m) => !m.valid || m.findings.length) ?? []

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" className="fixed bottom-3 left-36 z-50 flex items-center gap-1.5 rounded-full bg-grafito px-3 py-1.5 text-xs font-medium text-hueso shadow-lg" aria-label="Abrir el banco de pruebas">
          <Flask className="size-4" /> Banco {running && <span className="cifras opacity-70">…</span>}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-grafito/30" />
        <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-full max-w-2xl flex-col bg-papel shadow-2xl">
          <div className="flex items-center gap-2 border-b border-linea p-3">
            <Dialog.Title className="flex-1">
              <span className="block font-titulo text-lg font-semibold">Banco de pruebas</span>
              <span className="block text-xs text-grafito-2">Casos fijos contra {expert}, calificados con las cuentas de Knotty</span>
            </Dialog.Title>
            <Dialog.Description className="sr-only">Corre los casos de prueba contra el experto conectado y revisa los módulos sin experto.</Dialog.Description>
            <Button variant="secondary" className="min-h-8 px-2 text-xs" onClick={download} disabled={!Object.keys(results).length && !modules}>
              <DownloadSimple /> Exportar
            </Button>
            <Dialog.Close asChild>
              <button type="button" aria-label="Cerrar" className="grid size-8 place-items-center rounded-full hover:bg-kraft">
                <X />
              </button>
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto">
            <section className="flex flex-col gap-2 border-b border-linea p-3">
              <div className="flex items-center gap-2">
                <h3 className="flex-1 text-sm font-semibold">Con el experto</h3>
                <button type="button" className="text-xs text-grafito-2 underline" onClick={() => setSelected(selected.size === bench.cases.length ? new Set() : new Set(bench.cases.map((c) => c.id)))}>
                  {selected.size === bench.cases.length ? 'Ninguno' : 'Todos'}
                </button>
                {running ? (
                  <Button variant="secondary" className="min-h-8 px-3 text-xs" onClick={() => controller.current?.abort()}>
                    <Stop weight="fill" /> Detener
                  </Button>
                ) : (
                  <Button variant="primary" className="min-h-8 px-3 text-xs" disabled={!selected.size} onClick={() => void run()}>
                    <Play weight="fill" /> Correr {selected.size}
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-grafito-2">Cada caso usa tu llave y cuesta lo que un diseño; no toca tu diseño actual. Las respuestas crudas quedan en la bitácora.</p>
              <ul className="flex flex-col divide-y divide-linea rounded-xl border border-linea bg-hueso">
                {bench.cases.map((c) => {
                  const r = results[c.id]
                  return (
                    <li key={c.id} className="flex flex-col gap-1 px-3 py-2 text-sm">
                      <label className="flex items-start gap-2">
                        <input type="checkbox" className="mt-1" checked={selected.has(c.id)} disabled={running} onChange={() => setSelected((s) => (s.has(c.id) ? new Set([...s].filter((x) => x !== c.id)) : new Set([...s, c.id])))} />
                        <span className="min-w-0 flex-1">
                          <span className="font-medium">{c.id}</span> <span className="text-grafito-2">· {c.notes}</span>
                        </span>
                        {r === 'running' ? <span className="text-xs text-grafito-2">corriendo…</span> : r ? <Verdict r={r} /> : null}
                      </label>
                      {r && r !== 'running' && (
                        <div className="ml-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-grafito-2">
                          {r.ok ? (
                            <>
                              <span className="cifras">{r.seconds.toFixed(0)} s</span>
                              <span>{r.path === 'ficha' ? 'por ficha' : 'pieza por pieza'}</span>
                              <span>
                                {r.calls} {r.calls === 1 ? 'llamada' : 'llamadas'}
                                {r.corrections.length ? ` (corrigió ${r.corrections.join(', ')})` : ''}
                              </span>
                              <span className="cifras">{r.measures} mm</span>
                              {!r.reasonable && <span className="text-oxido">medidas raras</span>}
                              <span>
                                {r.verdict}
                                {r.criticals ? ` · ${r.criticals} críticos (${r.rules.join(' ')})` : ''}
                              </span>
                              {r.state &&
                                (confirming === c.id ? (
                                  <button
                                    type="button"
                                    className="font-medium text-oxido underline"
                                    onClick={() => {
                                      openState(r.state!)
                                      setConfirming(null)
                                      setOpen(false)
                                    }}
                                  >
                                    Sí, reemplaza mi diseño
                                  </button>
                                ) : (
                                  <button type="button" className="flex items-center gap-1 underline" onClick={() => setConfirming(c.id)}>
                                    <ArrowSquareOut /> Abrir en el estudio
                                  </button>
                                ))}
                            </>
                          ) : (
                            <span className="text-oxido">
                              {r.error} ({r.seconds.toFixed(0)} s)
                            </span>
                          )}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>

            <section className="flex flex-col gap-2 p-3">
              <div className="flex items-center gap-2">
                <h3 className="flex-1 text-sm font-semibold">Sin experto: los módulos de Knotty</h3>
                <Button variant="secondary" className="min-h-8 px-3 text-xs" onClick={() => setModules(bench.runModules())}>
                  <Play weight="fill" /> Revisar
                </Button>
              </div>
              <p className="text-[11px] text-grafito-2">Arma cada variante de cama, mesa y gabinete y marca las que salen inválidas o con avisos: eso es un error de Knotty, no del experto.</p>
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
                        {MODULE_LABEL[m.module]} · {m.variant}
                      </span>
                      {!m.valid && <span className="text-oxido"> · inválida</span>}
                      <ul className="mt-1 list-disc pl-4 text-grafito-2">
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
