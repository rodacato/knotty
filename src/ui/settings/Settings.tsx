import * as Dialog from '@radix-ui/react-dialog'
import { ArrowCounterClockwise, Check, LockKey, X } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { MIN_PASSPHRASE, PRESETS, SHELLM_URL, type LLMConfiguration, type Connection, type KeyStorage, type Provider } from '../../ports/Preferences'
import { Unlock } from './Keys'
import { useServices } from '../services'
import { Button, Title } from '../system/components'
import { Field, Input, Select } from '../system/Field'
import { RadioCard, RadioGroup } from '../system/RadioCard'
import { Reveal } from '../system/Reveal'
import { SheLLM } from '../system/SheLLM'
import { useStore } from '../store'
import { useInstall } from '../install/useInstall'
import { TOOL_LEVEL_LABELS, TOOL_LEVELS, type ToolLevel } from '../../domain/materials/tools'

const OPTION_GROUP = 'grid divide-y-2 divide-graphite border-2 border-graphite'
const OPTION_ROW = 'flex min-h-11 flex-col justify-center gap-0.5 px-3 py-2 pr-11 text-left text-[15px] leading-snug'
const SECTION_RULE = 'border-t-[3px] border-graphite pt-4'
const SECTION_TITLE = 'text-xl leading-tight uppercase'
// Field names in condensed capitals, as in the Studio's panel (UI-92); kept here so the shared Field stays as it is.
const FIELD_NAME = 'font-display text-base font-semibold text-graphite uppercase'

const PROVIDERS: Provider[] = ['simulated', 'anthropic', 'openai', 'shellm']

const SAVED: { id: KeyStorage; name: string; detail: string }[] = [
  { id: 'encrypted', name: 'Cifradas en este navegador', detail: 'Con una frase que te pido al volver. Recomendado.' },
  { id: 'tab', name: 'Solo en esta pestaña', detail: 'Sobreviven a recargar; se borran al cerrarla.' },
  { id: 'memory', name: 'No guardarlas', detail: 'Se pierden al recargar.' },
]

type ModelsState = { kind: 'idle' | 'loading' } | { kind: 'ready'; models: string[] } | { kind: 'error'; message: string }

export function Settings() {
  const { preferences } = useServices()
  const debugVisible = useStore((s) => s.debugVisible)
  const setDebugVisible = useStore((s) => s.setDebugVisible)
  const open = useStore((s) => s.settingsOpen)
  const setOpen = useStore((s) => s.openSettings)
  const [draft, setDraft] = useState<LLMConfiguration>(preferences.load())
  const [showKey, setShowKey] = useState(false)
  // The fetched list belongs to the provider it was fetched for; any other provider starts idle.
  const [fetched, setFetched] = useState<{ provider: Provider; models: ModelsState }>({ provider: draft.active, models: { kind: 'idle' } })
  const [passphrase, setPassphrase] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const vault = useStore((s) => s.vault)
  const refreshVault = useStore((s) => s.refreshVault)
  const catalogSettings = useStore((s) => s.catalogSettings)
  const saveCatalogSettings = useStore((s) => s.saveCatalogSettings)
  const [toolLevel, setToolLevel] = useState<ToolLevel>(catalogSettings.toolLevel)
  const install = useInstall()

  useEffect(() => {
    if (!open) return
    // oxlint-disable-next-line react/set-state-in-effect -- reloads saved preferences from storage each time the dialog opens or the vault changes
    setDraft(preferences.load())
    setToolLevel(useStore.getState().catalogSettings.toolLevel)
    setPassphrase('')
    setError('')
  }, [open, preferences, vault])

  const active = draft.active
  const models: ModelsState = fetched.provider === active ? fetched.models : { kind: 'idle' }
  const setModels = (m: ModelsState) => setFetched({ provider: active, models: m })
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
    if (toolLevel !== catalogSettings.toolLevel) saveCatalogSettings({ ...catalogSettings, toolLevel })
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
        <Dialog.Overlay className="scrim fixed inset-0 z-40 bg-graphite/50" />
        <Dialog.Content className="sheet fixed inset-x-3 bottom-3 z-50 mx-auto flex max-h-[90dvh] max-w-2xl flex-col overflow-hidden border-2 border-graphite bg-bone sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2">
          <header className="ink-band flex shrink-0 items-center justify-between gap-3 px-4 py-2 sm:px-6">
            <Dialog.Title className="font-display text-3xl leading-none font-semibold uppercase sm:text-4xl">Ajustes</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" className="size-11 shrink-0 px-0" aria-label="Cerrar">
                <X weight="bold" className="size-5" />
              </Button>
            </Dialog.Close>
          </header>
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
            <section className="flex flex-col gap-3">
              <div className="space-y-1">
                <Title className={SECTION_TITLE}>Experto</Title>
                <Dialog.Description className="text-[15px] text-graphite">
                  Usa tu propia API key. Se queda solo en este dispositivo y se envía directo al proveedor.
                </Dialog.Description>
              </div>

              {locked && <Unlock />}

              <RadioGroup label="Experto" className={OPTION_GROUP}>
                {PROVIDERS.map((p) => (
                  <RadioCard
                    key={p}
                    variant="segment"
                    mark
                    checked={active === p}
                    label={PRESETS[p].label}
                    onChange={() => {
                      if (p !== active) setModels({ kind: 'idle' })
                      setDraft((b) => ({ ...b, active: p }))
                    }}
                    className={OPTION_ROW}
                  >
                    <span className="font-semibold">{PRESETS[p].label}</span>
                    <span>{PRESETS[p].description}</span>
                  </RadioCard>
                ))}
              </RadioGroup>

              {active === 'shellm' && connection && <SheLLM host={connection.host} onHost={(host) => change({ host: host.trim() })} origin={location.origin} learnUrl={SHELLM_URL} />}

              {connection && active !== 'simulated' && (
                <div className="flex flex-col gap-4">
                  <Field label={<span className={FIELD_NAME}>API key{!PRESETS[active].needsKey && ' (opcional)'}</span>}>
                    <Input
                      type={showKey ? 'text' : 'password'}
                      autoComplete="off"
                      spellCheck={false}
                      value={connection.apiKey}
                      onChange={(e) => change({ apiKey: e.target.value.trim() })}
                      placeholder={active === 'anthropic' ? 'sk-ant-…' : active === 'shellm' ? 'Si tu SheLLM la pide' : 'sk-…'}
                      className="numerals"
                      end={
                        <Reveal what="llave" shown={showKey} onToggle={() => setShowKey((v) => !v)} />
                      }
                    />
                  </Field>
                  <Field
                    label={
                      <span className="flex items-center justify-between">
                        <span className={FIELD_NAME}>Modelo</span>
                        <button type="button" onClick={() => void loadModels()} disabled={(PRESETS[active].needsKey && !connection.apiKey) || models.kind === 'loading'} className="relative flex items-center gap-1 text-sm text-graphite underline before:absolute before:-inset-x-2 before:-inset-y-3 before:content-[''] disabled:opacity-40">
                          <ArrowCounterClockwise /> {models.kind === 'loading' ? 'Cargando…' : 'Cargar lista'}
                        </button>
                      </span>
                    }
                    error={models.kind === 'error' && models.message}
                  >
                    {models.kind === 'ready' ? (
                      <Select value={connection.model} onChange={(e) => change({ model: e.target.value })} className="numerals">
                        {!models.models.includes(connection.model) && <option value={connection.model}>{connection.model || 'Elige un modelo'}</option>}
                        {models.models.map((m) => (
                          <option key={m}>{m}</option>
                        ))}
                      </Select>
                    ) : (
                      <Input value={connection.model} onChange={(e) => change({ model: e.target.value.trim() })} placeholder={PRESETS[active].suggestedModel || 'Carga la lista o escribe el id'} className="numerals" />
                    )}
                  </Field>
                  <fieldset className="flex flex-col gap-2" disabled={locked}>
                    <legend className={`mb-2 ${FIELD_NAME}`}>Dónde guardar las llaves</legend>
                    {vault === 'open' && draft.keyStorage === 'encrypted' ? (
                      <p className="flex items-start gap-1.5 text-sm text-graphite">
                        <LockKey className="mt-0.5 shrink-0" /> Tus llaves están cifradas en este navegador; cada cambio se vuelve a cifrar al guardar.
                      </p>
                    ) : locked ? (
                      <p className="text-sm font-medium text-rust">Desbloquea arriba tus llaves guardadas antes de cambiarlas, o se perderán.</p>
                    ) : null}
                    <RadioGroup label="Dónde guardar las llaves" className={OPTION_GROUP}>
                      {SAVED.map((g) => (
                        <RadioCard
                          key={g.id}
                          variant="segment"
                          mark
                          checked={draft.keyStorage === g.id}
                          onChange={() => setDraft((b) => ({ ...b, keyStorage: g.id }))}
                          className={OPTION_ROW}
                        >
                          <span className="font-semibold">{g.name}</span>
                          <span>{g.detail}</span>
                        </RadioCard>
                      ))}
                    </RadioGroup>
                    {asksPassphrase && (
                      <Input
                        type="password"
                        value={passphrase}
                        onChange={(e) => setPassphrase(e.target.value)}
                        placeholder={`Frase secreta (${MIN_PASSPHRASE} caracteres o más); te la pediré al volver`}
                        autoComplete="new-password"
                        aria-label="Frase para cifrar las llaves"
                      />
                    )}
                    <p className="text-sm text-graphite">Usa llaves dedicadas, con tope de gasto, y rótalas al terminar.</p>
                  </fieldset>
                </div>
              )}
            </section>

            <section className={`flex flex-col gap-2 ${SECTION_RULE}`}>
              <Title className={SECTION_TITLE}>Tu herramienta</Title>
              <p className="text-[15px] text-graphite">Con esto te digo qué uniones y perfiles de canto puedes hacer tú y cuáles conviene pedir en la maderería.</p>
              <RadioGroup label="Tu herramienta" className={OPTION_GROUP}>
                {TOOL_LEVELS.map((level) => (
                  <RadioCard key={level} variant="segment" mark checked={toolLevel === level} onChange={() => setToolLevel(level)} className={OPTION_ROW}>
                    <span className="font-semibold">
                      {TOOL_LEVEL_LABELS[level].name} <span className="numerals font-normal">· nivel {level}</span>
                    </span>
                    <span>{TOOL_LEVEL_LABELS[level].tools}</span>
                  </RadioCard>
                ))}
              </RadioGroup>
            </section>

            {install && (
              <section className={`flex flex-col items-start gap-2 ${SECTION_RULE}`}>
                <Title className={SECTION_TITLE}>En este dispositivo</Title>
                <p className="text-[15px] text-graphite">Ábrelo como una app, también sin conexión.</p>
                <Button variant="ghost" className="border-2 border-graphite" onClick={install.onClick} aria-expanded={install.expanded}>{install.label}</Button>
                {install.hint && <p role="note" className="text-sm text-graphite">{install.hint}</p>}
              </section>
            )}

            <section className={`flex flex-col gap-2 ${SECTION_RULE}`}>
              <Title className={SECTION_TITLE}>Avanzado</Title>
              <label className="flex min-h-11 cursor-pointer items-start gap-3 text-[15px]">
                <span className="relative mt-0.5 grid size-5 shrink-0 place-items-center">
                  <input
                    type="checkbox"
                    className="peer size-5 appearance-none border-2 border-graphite bg-bone checked:bg-graphite"
                    checked={debugVisible}
                    onChange={(e) => setDebugVisible(e.target.checked)}
                  />
                  <Check aria-hidden weight="bold" className="pointer-events-none absolute size-3.5 text-bone opacity-0 peer-checked:opacity-100" />
                </span>
                <span>
                  Mostrar las herramientas de taller
                  <span className="block text-graphite">En el estudio: los hallazgos de Knotty, el cambio de modelo y «Exportar ficha».</span>
                </span>
              </label>
            </section>
          </div>

          <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t-[3px] border-graphite px-4 py-2 sm:px-6">
            {error && <p role="alert" className="mr-auto min-w-0 flex-1 basis-40 text-sm text-rust">{error}</p>}
            <Dialog.Close asChild>
              <Button variant="ghost" className="font-display text-base uppercase">Cancelar</Button>
            </Dialog.Close>
            <Button variant="action" onClick={() => void save()} disabled={saving || (asksPassphrase && passphrase.length < MIN_PASSPHRASE)}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
