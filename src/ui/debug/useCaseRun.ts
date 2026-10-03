import { useRef, useState } from 'react'
import type { BenchResult, ModuleCheck } from '../../application/bench/bench'
import { useServices } from '../services'

/** Two at a time, as in the comparison script: enough to be quick without hitting a provider's limits. */
const PARALLEL = 2

/** Running the fixed cases against the connected expert, shared by the bench dialog and the workshop. */
export function useCaseRun() {
  const { bench, preferences } = useServices()
  const [selected, setSelected] = useState<Set<string>>(new Set(bench.cases.map((c) => c.id)))
  const [results, setResults] = useState<Record<string, BenchResult | 'running'>>({})
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

  const toggle = (id: string) => setSelected((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])))
  const toggleAll = () => setSelected(selected.size === bench.cases.length ? new Set() : new Set(bench.cases.map((c) => c.id)))

  const download = (modules: ModuleCheck[] | null) => {
    const done = Object.values(results).filter((r): r is BenchResult => r !== 'running')
    const bundle = { format: 'knotty-bench@1', exportedAt: new Date().toISOString(), commit: __APP_COMMIT__, expert, results: done, modules }
    const url = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `knotty-bench-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return { selected, results, running, expert, run, stop: () => controller.current?.abort(), toggle, toggleAll, download, hasResults: Object.keys(results).length > 0 }
}
