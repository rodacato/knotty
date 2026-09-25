import { Copy, DownloadSimple, Trash, X } from '@phosphor-icons/react'
import * as Dialog from '@radix-ui/react-dialog'
import { useCallback, useEffect, useState } from 'react'
import type { DebugEvent, DebugKind } from '../../ports/DebugLog'
import { useServices } from '../services'
import { Button } from '../system/components'
import { Knot } from '../system/Brand'
import { useStore } from '../store'
import { captureGlobalErrors, instrumentStore } from './instrument'
import { BenchPanel } from './BenchPanel'
import { KonamiTrail } from './KonamiTrail'

// A development tool: hidden until asked for (Konami code, Ctrl+Shift+D, settings or ?debug), it shows and exports everything the session did.
// The test bench comes with it.

/** Other parts of the app (the settings switch) show or hide the panel through this event. */
export const DEBUG_VISIBILITY = 'knotty:debug-visibility'

const KINDS: { id: DebugKind; label: string }[] = [
  { id: 'llm', label: 'Experto' },
  { id: 'action', label: 'Acciones' },
  { id: 'stage', label: 'Etapas' },
  { id: 'error', label: 'Errores' },
  { id: 'app', label: 'App' },
]
const COLOR: Record<DebugKind, string> = { llm: 'bg-amber-soft', action: 'bg-kraft', stage: 'bg-bone', error: 'bg-rust/15 text-rust', app: 'bg-slate/15' }
const time = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

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

export function DebugPanel() {
  const { debug, preferences } = useServices()
  const state = useStore((s) => s.state)
  const [visible, setVisible] = useState(() => debug.visible() || new URLSearchParams(location.search).has('debug'))
  const [open, setOpen] = useState(false)
  const [kinds, setKinds] = useState<Set<DebugKind>>(new Set(KINDS.map((k) => k.id)))
  const [, refresh] = useState(0)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const stopStore = instrumentStore(debug)
    const stopErrors = captureGlobalErrors(debug)
    return () => {
      stopStore()
      stopErrors()
    }
  }, [debug])

  useEffect(() => {
    const toggle = () =>
      setVisible((v) => {
        debug.setVisible(!v)
        return !v
      })
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        toggle()
      }
    }
    const onToggle = (e: Event) => setVisible((e as CustomEvent<boolean>).detail)
    addEventListener('keydown', onKey)
    addEventListener(DEBUG_VISIBILITY, onToggle)
    return () => {
      removeEventListener('keydown', onKey)
      removeEventListener(DEBUG_VISIBILITY, onToggle)
    }
  }, [debug])

  // The Konami code goes straight to the insides: shown and open.
  const openFromKonami = useCallback(() => {
    debug.setVisible(true)
    setVisible(true)
    setOpen(true)
  }, [debug])

  // While open, the list follows new events.
  useEffect(() => {
    if (!open) return
    const timer = setInterval(() => refresh((n) => n + 1), 1000)
    return () => clearInterval(timer)
  }, [open])

  const trail = <KonamiTrail onComplete={openFromKonami} />
  if (!visible) return trail
  const events = debug.events()
  const shown = [...events].reverse().filter((e) => kinds.has(e.kind))
  const bundle = () => JSON.stringify(exportBundle(events, preferences.load(), state), null, 2)

  const download = () => {
    const url = URL.createObjectURL(new Blob([bundle()], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `knotty-bitacora-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  const copy = async () => {
    await navigator.clipboard.writeText(bundle())
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <>
    {trail}
    <BenchPanel />
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" className="fixed bottom-3 left-3 z-50 flex items-center gap-1.5 rounded-full bg-graphite px-3 py-1.5 text-xs font-medium text-bone shadow-lg" aria-label="Abrir las entrañas de la madera: la bitácora de depuración">
          <Knot className="size-4" /> Entrañas <span className="numerals opacity-70">{events.length}</span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-graphite/30" />
        <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-full max-w-xl flex-col bg-paper shadow-2xl">
          <div className="flex items-center gap-2 border-b border-line p-3">
            <Dialog.Title className="flex-1">
              <span className="block font-display text-lg font-semibold">Entrañas de la madera</span>
              <span className="block text-xs text-graphite-2">Todo lo que pasó por dentro, anillo por anillo</span>
            </Dialog.Title>
            <Dialog.Description className="sr-only">Todo lo que pasó en esta sesión, para exportarlo y revisarlo.</Dialog.Description>
            <Button variant="secondary" className="min-h-8 px-2 text-xs" onClick={download}>
              <DownloadSimple /> Exportar
            </Button>
            <Button variant="ghost" className="min-h-8 px-2 text-xs" onClick={() => void copy()}>
              <Copy /> {copied ? 'Copiado' : 'Copiar'}
            </Button>
            <Button
              variant="ghost"
              className="min-h-8 px-2 text-xs"
              onClick={() => {
                debug.clear()
                refresh((n) => n + 1)
              }}
            >
              <Trash /> Limpiar
            </Button>
            <Dialog.Close asChild>
              <button type="button" aria-label="Cerrar" className="grid size-8 place-items-center rounded-full hover:bg-kraft">
                <X />
              </button>
            </Dialog.Close>
          </div>
          <div className="flex flex-wrap gap-1.5 border-b border-line px-3 py-2">
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                aria-pressed={kinds.has(k.id)}
                onClick={() => setKinds((s) => (s.has(k.id) ? new Set([...s].filter((x) => x !== k.id)) : new Set([...s, k.id])))}
                className={`rounded-full border px-2.5 py-0.5 text-xs ${kinds.has(k.id) ? 'border-graphite bg-graphite text-bone' : 'border-line text-graphite-2'}`}
              >
                {k.label} <span className="numerals">{events.filter((e) => e.kind === k.id).length}</span>
              </button>
            ))}
            <span className="ml-auto self-center text-[11px] text-graphite-2">
              {__APP_COMMIT__} · se oculta con el código Konami, Ctrl+Shift+D o en ajustes
            </span>
          </div>
          <ol className="flex-1 divide-y divide-line overflow-y-auto">
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
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
    </>
  )
}
