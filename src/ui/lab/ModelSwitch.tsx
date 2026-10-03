import { GearSix } from '@phosphor-icons/react'
import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useState } from 'react'
import { activeLabel, missing, PRESETS, type LLMConfiguration, type Provider, type RealProvider } from '../../ports/Preferences'
import { useServices } from '../services'
import { Button } from '../system/components'

// The expert is read from the saved configuration on every call, so changing it here applies to the next one.

const PROVIDERS: Provider[] = ['simulated', 'anthropic', 'openai', 'shellm']

export function ModelSwitch() {
  const { preferences } = useServices()
  const [config, setConfig] = useState<LLMConfiguration>(() => preferences.load())
  const [open, setOpen] = useState(false)
  const [listed, setListed] = useState<{ provider: Provider; models: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const provider = config.active
    if (!open || provider === 'simulated') return
    let stale = false
    preferences.listModels(provider, config.connections[provider]).then(
      (models) => !stale && setListed({ provider, models }),
      () => !stale && setListed({ provider, models: [] }),
    )
    return () => {
      stale = true
    }
  }, [open, config.active, config.connections, preferences])
  const models = listed?.provider === config.active ? listed.models : []

  const save = async (next: LLMConfiguration) => {
    setError(null)
    try {
      await preferences.save(next)
      setConfig(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
    }
  }
  const choose = (provider: Provider) => {
    const next = { ...config, active: provider }
    if (!missing(next)) void save(next)
    else setError(missing(next))
  }
  const setModel = (provider: RealProvider, model: string) => void save({ ...config, connections: { ...config.connections, [provider]: { ...config.connections[provider], model } } })

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (v) setConfig(preferences.load())
      }}
    >
      <Dialog.Trigger asChild>
        <Button variant="secondary" className="gap-1 px-2 text-xs sm:px-3" aria-label={`El experto: ${activeLabel(config)}`}>
          <GearSix /> <span className="hidden sm:inline">{activeLabel(config)}</span>
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40" />
        <Dialog.Content className="fixed top-16 right-3 z-50 flex w-[400px] max-w-[calc(100vw-1.5rem)] flex-col gap-2.5 rounded-2xl border border-line bg-paper p-4 shadow-2xl">
          <Dialog.Title className="font-display text-lg font-semibold">El experto</Dialog.Title>
          <Dialog.Description className="sr-only">Cambia el proveedor y el modelo con el que se hacen las siguientes llamadas.</Dialog.Description>
          {PROVIDERS.map((p) => {
            const selected = config.active === p
            const real = p !== 'simulated'
            return (
              <div key={p} className={`flex flex-col gap-1 rounded-xl border p-3 ${selected ? 'border-amber bg-amber-soft' : 'border-line bg-bone'}`}>
                <button type="button" aria-pressed={selected} onClick={() => choose(p)} className="flex flex-col gap-1 text-left">
                  <span className="text-sm font-semibold">{PRESETS[p].label}</span>
                  <span className="text-xs leading-snug text-graphite-2">{PRESETS[p].description}</span>
                </button>
                {real && selected && (
                  <select
                    aria-label={`Modelo de ${PRESETS[p].label}`}
                    value={config.connections[p].model}
                    onChange={(e) => setModel(p, e.target.value)}
                    className="min-h-11 rounded-lg border border-line bg-bone px-2 font-mono text-xs"
                  >
                    {[...new Set([config.connections[p].model, ...models].filter(Boolean))].map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )
          })}
          {error && (
            <p role="alert" className="text-xs text-rust">
              {error}
            </p>
          )}
          <p className="text-xs text-graphite-2">El cambio vale desde la siguiente llamada.</p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
