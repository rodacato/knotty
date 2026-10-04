import { Copy, DownloadSimple, Trash } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import type { DebugEvent, DebugKind } from '../../ports/DebugLog'
import { useServices } from '../services'
import { useStore } from '../store'
import { Button } from '../system/components'

// «Entrañas de la madera»: everything the session did, to read and to export. It was a floating button and a dialog; now it is a drawer of the debug bar.

const KINDS: { id: DebugKind; label: string }[] = [
  { id: 'llm', label: 'Experto' },
  { id: 'action', label: 'Acciones' },
  { id: 'stage', label: 'Etapas' },
  { id: 'error', label: 'Errores' },
  { id: 'app', label: 'App' },
]
const COLOR: Record<DebugKind, string> = { llm: 'bg-amber-soft', action: 'bg-kraft', stage: 'bg-bone', error: 'bg-rust/15 text-rust', app: 'bg-slate/15' }
const time = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
const exportName = () => `knotty-debug-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`

/** Everything needed to understand or rebuild a session, without API keys. */
function exportBundle(events: DebugEvent[], preferences: ReturnType<ReturnType<typeof useServices>['preferences']['load']>, design: unknown) {
  const connection = preferences.active === 'simulated' ? null : preferences.connections[preferences.active]
  return {
    format: 'knotty-debug@1',
    exportedAt: new Date().toISOString(),
    commit: __APP_COMMIT__,
    userAgent: navigator.userAgent,
    expert: { provider: preferences.active, model: connection?.model ?? null, host: preferences.active === 'shellm' ? (connection?.host ?? null) : null },
    design,
    events,
  }
}

export function LogDrawer({ open }: { open: boolean }) {
  const { debug, preferences } = useServices()
  const state = useStore((s) => s.state)
  const [kinds, setKinds] = useState<Set<DebugKind>>(new Set(KINDS.map((k) => k.id)))
  const [, refresh] = useState(0)
  const [copied, setCopied] = useState(false)

  // While open, the list follows new events.
  useEffect(() => {
    if (!open) return
    const timer = setInterval(() => refresh((n) => n + 1), 1000)
    return () => clearInterval(timer)
  }, [open])

  const events = debug.events()
  const shown = [...events].reverse().filter((e) => kinds.has(e.kind))
  const bundle = () => JSON.stringify(exportBundle(events, preferences.load(), state), null, 2)

  const download = () => {
    const url = URL.createObjectURL(new Blob([bundle()], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = exportName()
    a.click()
    URL.revokeObjectURL(url)
  }
  const copy = async () => {
    await navigator.clipboard.writeText(bundle())
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-15 shrink-0 flex-col justify-center pr-14 pl-4">
        <h2 className="font-display text-lg leading-tight font-semibold">Entrañas de la madera</h2>
        <p className="text-xs text-graphite-2">Todo lo que pasó por dentro, anillo por anillo</p>
      </div>
      <div className="flex flex-wrap gap-1 px-3 pb-2">
        <Button variant="secondary" className="px-2 text-xs" onClick={download}>
          <DownloadSimple /> Exportar
        </Button>
        <Button variant="ghost" className="px-2 text-xs" onClick={() => void copy()}>
          <Copy /> {copied ? 'Copiado' : 'Copiar'}
        </Button>
        <Button
          variant="ghost"
          className="px-2 text-xs"
          onClick={() => {
            debug.clear()
            refresh((n) => n + 1)
          }}
        >
          <Trash /> Limpiar
        </Button>
      </div>
      <div className="flex flex-col gap-2 border-y border-line px-3 py-2">
        <div className="flex flex-wrap gap-1.5">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              aria-pressed={kinds.has(k.id)}
              onClick={() => setKinds((s) => (s.has(k.id) ? new Set([...s].filter((x) => x !== k.id)) : new Set([...s, k.id])))}
              className={`min-h-7 rounded-full border px-2.5 text-xs ${kinds.has(k.id) ? 'border-graphite bg-graphite text-bone' : 'border-line text-graphite-2'}`}
            >
              {k.label} <span className="numerals">{events.filter((e) => e.kind === k.id).length}</span>
            </button>
          ))}
        </div>
        <span className="text-[11px] text-graphite-2">
          {__APP_COMMIT__} · se oculta con el código Konami, Ctrl+Shift+D o en ajustes
        </span>
      </div>
      <ol className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
        {shown.map((e, i) => (
          <li key={`${e.at}-${i}`} className="px-3 py-2 text-sm">
            <details>
              <summary className="flex cursor-pointer list-none items-start gap-2">
                <span className={`shrink-0 rounded px-1.5 py-px text-[10px] font-medium uppercase ${COLOR[e.kind]}`}>{KINDS.find((k) => k.id === e.kind)?.label}</span>
                <span className="flex-1 leading-snug">{e.summary}</span>
                <span className="numerals shrink-0 text-[11px] text-graphite-2">{time.format(new Date(e.at))}</span>
              </summary>
              {e.data !== undefined && <pre className="mt-2 max-h-96 overflow-auto rounded-lg bg-graphite/5 p-2 text-[11px] leading-snug whitespace-pre-wrap">{JSON.stringify(e.data, null, 2)}</pre>}
            </details>
          </li>
        ))}
        {!shown.length && <li className="p-6 text-center text-sm text-graphite-2">Sin eventos.</li>}
      </ol>
    </div>
  )
}
