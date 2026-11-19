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
        <Button variant="ghost" className="gap-1 px-2 font-display text-base uppercase sm:px-3" aria-label={`El experto: ${activeLabel(config)}`}>
          <GearSix /> <span className="hidden sm:inline">{activeLabel(config)}</span>
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40" />
        <Dialog.Content className="fixed top-16 right-3 z-50 flex w-[400px] max-w-[calc(100vw-1.5rem)] flex-col gap-2.5 border-2 border-graphite bg-bone p-4">
          <Dialog.Title className="font-display text-xl font-semibold uppercase">El experto</Dialog.Title>
          <Dialog.Description className="sr-only">Cambia el proveedor y el modelo con el que se hacen las siguientes llamadas.</Dialog.Description>
          <div className="flex flex-col divide-y-2 divide-graphite border-2 border-graphite">
          {PROVIDERS.map((p) => {
            const selected = config.active === p
            const real = p !== 'simulated'
            return (
              <div key={p} className={`flex flex-col gap-1 p-3 ${selected ? 'bg-graphite text-bone' : 'bg-bone hover:bg-kraft'}`}>
                <button type="button" aria-pressed={selected} onClick={() => choose(p)} className="flex flex-col gap-1 text-left">
                  <span className="font-display text-base font-semibold uppercase">{PRESETS[p].label}</span>
                  <span className={`text-xs leading-snug ${selected ? 'text-bone/80' : 'text-graphite-2'}`}>{PRESETS[p].description}</span>
                </button>
                {real && selected && (
                  <select
                    aria-label={`Modelo de ${PRESETS[p].label}`}
                    value={config.connections[p].model}
                    onChange={(e) => setModel(p, e.target.value)}
                    className="min-h-11 border-2 border-bone bg-bone px-2 font-mono text-xs text-graphite"
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
          </div>
          {error && (
            <p role="alert" className="border-l-8 border-graphite pl-3 text-xs font-medium text-graphite">
              {error}
            </p>
          )}
          <p className="text-xs text-graphite-2">El cambio vale desde la siguiente llamada.</p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
