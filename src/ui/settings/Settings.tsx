import * as Dialog from '@radix-ui/react-dialog'
import { ArrowCounterClockwise, ArrowSquareOut, Check, Copy, Eye, EyeSlash, X } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { MIN_PASSPHRASE, PRESETS, SHELLM_URL, type LLMConfiguration, type Connection, type KeyStorage, type Provider } from '../../ports/Preferences'
import { Unlock } from './Keys'
import { useServices } from '../services'
import { Button, Title } from '../sistema/components'
import { DEBUG_VISIBILITY } from '../debug/DebugPanel'
import { useStore } from '../store'

const PROVIDERS: Provider[] = ['simulated', 'anthropic', 'openai', 'shellm']

const SAVED: { id: KeyStorage; name: string; detail: string }[] = [
  { id: 'encrypted', name: 'Cifradas en este navegador', detail: 'Con una frase que te pido al volver. Recomendado.' },
  { id: 'tab', name: 'Solo en esta pestaña', detail: 'Sobreviven a recargar; se borran al cerrarla.' },
  { id: 'memory', name: 'No guardarlas', detail: 'Se pierden al recargar.' },
]

type ModelsState = { kind: 'idle' | 'loading' } | { kind: 'ready'; models: string[] } | { kind: 'error'; message: string }

export function Settings() {
  const { preferences, debug } = useServices()
  const [debugVisible, setDebugVisible] = useState(() => debug.visible())
  const open = useStore((s) => s.settingsOpen)
  const setOpen = useStore((s) => s.openSettings)
  const [draft, setDraft] = useState<LLMConfiguration>(preferences.load())
  const [showKey, setShowKey] = useState(false)
  const [models, setModels] = useState<ModelsState>({ kind: 'idle' })
  const [passphrase, setPassphrase] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const vault = useStore((s) => s.vault)
  const refreshVault = useStore((s) => s.refreshVault)

  useEffect(() => {
    if (!open) return
    setDraft(preferences.load())
    setPassphrase('')
    setError('')
  }, [open, preferences, vault])
  useEffect(() => setModels({ kind: 'idle' }), [draft.active])

  const active = draft.active
  const connection = active === 'simulated' ? null : draft.connections[active]
  const change = (patch: Partial<Connection>) => {
    if (active === 'simulated') return
    setDraft((b) => ({ ...b, connections: { ...b.connections, [active]: { ...b.connections[active], ...patch } } }))
  }
  const loadModels = async () => {
    if (active === 'simulated' || !connection || (PRESETS[active].needsKey && !connection.apiKey)) return
    setModels({ kind: 'loading' })
    try {
      setModels({ kind: 'ready', models: await preferences.listModels(active, connection) })
    } catch (e) {
      setModels({ kind: 'error', message: e instanceof Error ? e.message : 'No se pudo cargar la lista.' })
    }
  }
  const locked = vault === 'locked'
  const asksPassphrase = draft.keyStorage === 'encrypted' && vault === 'none'
  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await preferences.save(draft, passphrase)
      refreshVault()
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
    }
    setSaving(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-grafito/30 backdrop-blur-[2px]" />
        <Dialog.Content className="animate-aparecer fixed inset-x-3 bottom-3 z-50 mx-auto flex max-h-[90dvh] max-w-lg flex-col gap-5 overflow-y-auto rounded-3xl border border-linea bg-hueso p-5 shadow-2xl sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2">
          <div className="flex items-center justify-between">
            <Dialog.Title asChild>
              <Title className="text-xl">El experto</Title>
            </Dialog.Title>
            <Dialog.Close className="grid size-9 place-items-center rounded-full hover:bg-kraft" aria-label="Cerrar">
              <X />
            </Dialog.Close>
          </div>
          <Dialog.Description className="-mt-3 text-sm text-grafito-2">
            Usa tu propia API key. Se queda solo en este dispositivo y se envía directo al proveedor.
          </Dialog.Description>

          {locked && <Unlock />}

          <div role="radiogroup" className="grid gap-2">
            {PROVIDERS.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={active === p}
                aria-label={PRESETS[p].label}
                onClick={() => setDraft((b) => ({ ...b, active: p }))}
                className={`flex flex-col items-start rounded-2xl border px-4 py-3 text-left transition ${active === p ? 'border-ambar bg-ambar-suave' : 'border-linea hover:bg-kraft'}`}
              >
                <span className="font-medium">{PRESETS[p].label}</span>
                <span className="text-xs text-grafito-2">{PRESETS[p].description}</span>
              </button>
            ))}
          </div>

          {active === 'shellm' && connection && <SheLLM host={connection.host} onHost={(host) => change({ host: host.trim() })} />}

          {connection && active !== 'simulated' && (
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">API key{!PRESETS[active].needsKey && <span className="font-normal text-grafito-2"> (opcional)</span>}</span>
                <span className="flex items-center gap-2 rounded-xl border border-linea bg-hueso px-3 focus-within:border-ambar">
                  <input
                    type={showKey ? 'text' : 'password'}
                    autoComplete="off"
                    spellCheck={false}
                    value={connection.apiKey}
                    onChange={(e) => change({ apiKey: e.target.value.trim() })}
                    placeholder={active === 'anthropic' ? 'sk-ant-…' : active === 'shellm' ? 'Si tu SheLLM la pide' : 'sk-…'}
                    className="cifras min-h-11 flex-1 bg-transparent text-sm outline-none"
                  />
                  <button type="button" onClick={() => setShowKey((v) => !v)} aria-label={showKey ? 'Ocultar' : 'Mostrar'} className="text-grafito-2">
                    {showKey ? <EyeSlash /> : <Eye />}
                  </button>
                </span>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="flex items-center justify-between text-sm font-medium">
                  Modelo
                  <button type="button" onClick={() => void loadModels()} disabled={(PRESETS[active].needsKey && !connection.apiKey) || models.kind === 'loading'} className="flex items-center gap-1 text-xs font-normal text-grafito-2 underline disabled:opacity-40">
                    <ArrowCounterClockwise /> {models.kind === 'loading' ? 'Cargando…' : 'Cargar lista'}
                  </button>
                </span>
                {models.kind === 'ready' ? (
                  <select value={connection.model} onChange={(e) => change({ model: e.target.value })} className="cifras min-h-11 rounded-xl border border-linea bg-hueso px-3 text-sm">
                    {!models.models.includes(connection.model) && <option value={connection.model}>{connection.model || 'Elige un modelo'}</option>}
                    {models.models.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={connection.model}
                    onChange={(e) => change({ model: e.target.value.trim() })}
                    placeholder={PRESETS[active].suggestedModel || 'Carga la lista o escribe el id'}
                    className="cifras min-h-11 rounded-xl border border-linea bg-hueso px-3 text-sm outline-none focus:border-ambar"
                  />
                )}
                {models.kind === 'error' && <span className="text-xs text-oxido">{models.message}</span>}
              </label>
              <fieldset className="flex flex-col gap-2" disabled={locked}>
                <legend className="mb-1.5 text-sm font-medium">Dónde guardar las llaves</legend>
                {vault === 'open' && draft.keyStorage === 'encrypted' ? (
                  <p className="text-xs text-grafito-2">🔒 Tus llaves están cifradas en este navegador; cada cambio se vuelve a cifrar al guardar.</p>
                ) : locked ? (
                  <p className="text-xs text-oxido">Desbloquea arriba tus llaves guardadas antes de cambiarlas, o se perderán.</p>
                ) : null}
                <div className="grid gap-1.5">
                  {SAVED.map((g) => (
                    <label key={g.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2 text-sm transition ${draft.keyStorage === g.id ? 'border-ambar bg-ambar-suave' : 'border-linea hover:bg-kraft'}`}>
                      <input type="radio" name="guardado" checked={draft.keyStorage === g.id} onChange={() => setDraft((b) => ({ ...b, keyStorage: g.id }))} className="mt-1 accent-ambar" />
                      <span>
                        {g.name}
                        <span className="block text-xs text-grafito-2">{g.detail}</span>
                      </span>
                    </label>
                  ))}
                </div>
                {asksPassphrase && (
                  <input
                    type="password"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    placeholder={`Frase secreta (${MIN_PASSPHRASE} caracteres o más); te la pediré al volver`}
                    autoComplete="new-password"
                    aria-label="Frase para cifrar las llaves"
                    className="min-h-11 rounded-xl border border-linea bg-hueso px-3 text-sm outline-none focus:border-ambar"
                  />
                )}
                <p className="text-xs text-grafito-2">Usa llaves dedicadas, con tope de gasto, y rótalas al terminar.</p>
              </fieldset>
            </div>
          )}

          <label className="flex items-center gap-2 border-t border-linea pt-3 text-xs text-grafito-2">
            <input
              type="checkbox"
              checked={debugVisible}
              onChange={(e) => {
                debug.setVisible(e.target.checked)
                setDebugVisible(e.target.checked)
                dispatchEvent(new CustomEvent(DEBUG_VISIBILITY, { detail: e.target.checked }))
              }}
            />
            Mostrar las entrañas de la madera: la bitácora para mandar reportes de lo que pasó
          </label>

          {error && <p className="text-sm text-oxido">{error}</p>}
          <div className="flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="ghost">Cancelar</Button>
            </Dialog.Close>
            <Button variant="primary" onClick={() => void save()} disabled={saving || (asksPassphrase && passphrase.length < MIN_PASSPHRASE)}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** SheLLM runs on the person's machine: explains what it is and how to let this page talk to it. */
function SheLLM({ host, onHost }: { host: string; onHost: (h: string) => void }) {
  const [copied, setCopied] = useState(false)
  const origin = location.origin
  const line = `SHELLM_CORS_ORIGINS=${origin}`
  const copy = async () => {
    await navigator.clipboard.writeText(line)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-ambar/40 bg-ambar-suave p-4 text-sm">
      <p>
        <span className="font-medium">SheLLM</span> convierte tu suscripción de Claude Code o Codex en una API local, así el experto no gasta créditos de API.{' '}
        <a href={SHELLM_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium underline decoration-ambar underline-offset-2">
          Conoce SheLLM <ArrowSquareOut />
        </a>
      </p>
      <label className="flex flex-col gap-1.5">
        <span className="font-medium">Dirección</span>
        <input value={host} onChange={(e) => onHost(e.target.value)} placeholder="http://127.0.0.1:6100" className="cifras min-h-11 rounded-xl border border-linea bg-hueso px-3 text-sm outline-none focus:border-ambar" />
      </label>
      <div className="flex flex-col gap-1.5">
        <span>Para que esta página pueda hablarle, agrega su origen a la configuración de SheLLM:</span>
        <span className="flex items-center gap-2 rounded-xl bg-hueso px-3 py-2">
          <code className="cifras flex-1 truncate text-xs">{line}</code>
          <button type="button" onClick={() => void copy()} aria-label="Copiar" className="text-grafito-2 hover:text-grafito">
            {copied ? <Check /> : <Copy />}
          </button>
        </span>
      </div>
    </div>
  )
}
