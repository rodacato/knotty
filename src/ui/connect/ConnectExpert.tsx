import * as Dialog from '@radix-ui/react-dialog'
import { Check, Eye, EyeSlash, LockKey, X } from '@phosphor-icons/react'
import { useState, type ReactNode } from 'react'
import { MIN_PASSPHRASE, PRESETS, type RealProvider } from '../../ports/Preferences'
import { useServices } from '../services'
import { UNLOCK_TEXT } from '../settings/Keys'
import { SheLLM } from '../settings/Settings'
import { useStore } from '../store'
import { Button, Title } from '../system/components'
import { Field, Input } from '../system/Field'
import { expertConnected } from '../shell/expertStatus'
import { connectBlocker, planConnect } from './plan'

const PROVIDERS: RealProvider[] = ['anthropic', 'openai', 'shellm']
const KEY_PLACEHOLDER: Record<RealProvider, string> = {
  anthropic: 'sk-ant-…',
  openai: 'sk-…',
  shellm: 'Si tu SheLLM la pide',
}

/** "Conecta tu experto": a dialog on desktop, a full-screen sheet on a phone. */
export function ConnectExpert() {
  const open = useStore((s) => s.connectOpen)
  const setOpen = useStore((s) => s.openConnect)
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-graphite/55 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed inset-0 z-50 flex flex-col bg-bone outline-none md:inset-0 md:m-auto md:h-fit md:max-h-[92dvh] md:w-[600px] md:rounded-3xl md:border md:border-line md:shadow-2xl">
          <Body onClose={() => setOpen(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Shell({ title, description, footer, children, onClose }: { title: string; description?: string; footer: ReactNode; children: ReactNode; onClose: () => void }) {
  return (
    <>
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 pt-5 pb-4 md:px-7 md:pt-7">
        <div className="flex items-start justify-between gap-3">
          <Dialog.Title asChild>
            <Title className="text-3xl leading-tight">{title}</Title>
          </Dialog.Title>
          <Dialog.Close className="relative grid size-11 shrink-0 place-items-center rounded-full hover:bg-kraft" aria-label="Cerrar" onClick={onClose}>
            <X className="size-5" />
          </Dialog.Close>
        </div>
        {description ? (
          <Dialog.Description className="-mt-2 text-base text-graphite-2">{description}</Dialog.Description>
        ) : (
          <Dialog.Description className="sr-only">{title}</Dialog.Description>
        )}
        {children}
      </div>
      <div className="flex flex-col gap-1 border-t border-line px-5 py-4 md:flex-row md:items-center md:gap-2 md:border-0 md:px-7 md:pt-2 md:pb-7">{footer}</div>
    </>
  )
}

function Reveal({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} aria-label={shown ? 'Ocultar' : 'Mostrar'} className="grid size-9 shrink-0 place-items-center text-graphite-2">
      {shown ? <EyeSlash className="size-5" /> : <Eye className="size-5" />}
    </button>
  )
}

function Body({ onClose }: { onClose: () => void }) {
  const vault = useStore((s) => s.vault)
  const [startsNew, setStartsNew] = useState(false)
  return vault === 'locked' && !startsNew ? (
    <Saved onClose={onClose} onNew={() => setStartsNew(true)} />
  ) : (
    <NewConnection onClose={onClose} savedKeysWaiting={vault === 'locked'} onBack={() => setStartsNew(false)} />
  )
}

function Saved({ onClose, onNew }: { onClose: () => void; onNew: () => void }) {
  const { preferences } = useServices()
  const unlock = useStore((s) => s.unlock)
  const [passphrase, setPassphrase] = useState('')
  const [shown, setShown] = useState(false)
  const [error, setError] = useState('')
  const [opening, setOpening] = useState(false)
  const config = preferences.load()
  const provider = config.active === 'simulated' ? null : config.active

  const open = async () => {
    setOpening(true)
    setError('')
    try {
      await unlock(passphrase)
      if (expertConnected(preferences.load())) onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron abrir.')
    }
    setOpening(false)
  }

  return (
    <form
      className="contents"
      onSubmit={(e) => {
        e.preventDefault()
        if (passphrase && !opening) void open()
      }}
    >
      <Shell
        title="Tus llaves están guardadas"
        onClose={onClose}
        footer={
          <>
            <Button type="submit" variant="primary" className="min-h-12 md:order-3 md:min-h-11" disabled={!passphrase || opening}>
              {opening ? 'Abriendo…' : 'Desbloquear'}
            </Button>
            <Button variant="ghost" className="max-md:hidden min-h-11 md:order-2" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="ghost" className="min-h-11 md:order-1 md:mr-auto" onClick={onNew}>
              Usar una llave nueva
            </Button>
          </>
        }
      >
        {provider && (
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-kraft px-4 py-3">
            <LockKey className="size-6 shrink-0" />
            <div className="flex flex-col">
              <span className="text-base font-medium">{PRESETS[provider].label}</span>
              <span className="text-sm text-graphite">Guardada y cifrada en este navegador.</span>
            </div>
          </div>
        )}
        <p className="text-base text-graphite-2">{UNLOCK_TEXT}</p>
        <Field label="Frase" error={error}>
          <Input
            type={shown ? 'text' : 'password'}
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Frase secreta"
            autoComplete="current-password"
            autoFocus
            invalid={!!error}
            className="numerals"
            end={<Reveal shown={shown} onToggle={() => setShown((v) => !v)} />}
          />
        </Field>
      </Shell>
    </form>
  )
}

function NewConnection({ onClose, savedKeysWaiting, onBack }: { onClose: () => void; savedKeysWaiting: boolean; onBack: () => void }) {
  const { preferences } = useServices()
  const vault = useStore((s) => s.vault)
  const refreshVault = useStore((s) => s.refreshVault)
  const forgetKeys = useStore((s) => s.forgetKeys)
  const switchToSimulated = useStore((s) => s.switchToSimulated)
  const base = preferences.load()
  const [provider, setProvider] = useState<RealProvider>(base.active === 'simulated' ? 'anthropic' : base.active)
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [host, setHost] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [showPassphrase, setShowPassphrase] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const saved = base.connections[provider]
  const effectiveModel = model || saved.model
  const effectiveHost = host || saved.host
  const input = {
    provider,
    apiKey,
    model: effectiveModel,
    host: effectiveHost,
    passphrase,
    vault,
    base,
  }
  const blocker = connectBlocker(input)
  const keyOptional = !PRESETS[provider].needsKey
  const vaultOpen = vault === 'open'

  const connect = async () => {
    if (blocker) return
    setSaving(true)
    setError('')
    try {
      const plan = planConnect(input)
      if (plan.forgetFirst) forgetKeys()
      await preferences.save(plan.config, plan.passphrase)
      refreshVault()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
    }
    setSaving(false)
  }

  return (
    <form
      className="contents"
      onSubmit={(e) => {
        e.preventDefault()
        void connect()
      }}
    >
      <Shell
        title="Conecta tu experto"
        description="Lee tus fotos y tu descripción y arma el diseño. Las bases no lo necesitan."
        onClose={onClose}
        footer={
          <>
            <Button type="submit" variant="primary" className="min-h-12 md:order-3 md:min-h-11" disabled={!!blocker || saving}>
              {saving ? 'Conectando…' : (blocker ?? 'Conectar')}
            </Button>
            <Button variant="ghost" className="max-md:hidden min-h-11 md:order-2" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              variant="ghost"
              className="min-h-11 md:order-1 md:mr-auto"
              onClick={() => {
                switchToSimulated()
                onClose()
              }}
            >
              Probar con los ejemplos simulados
            </Button>
          </>
        }
      >
        <div role="radiogroup" aria-label="Experto" className="grid gap-2">
          {PROVIDERS.map((p) => {
            const selected = provider === p
            return (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setProvider(p)}
                className={`flex min-h-11 flex-col gap-0.5 rounded-2xl border px-4 py-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber ${selected ? 'border-amber bg-amber-soft' : 'border-line hover:bg-kraft'}`}
              >
                <span className="flex items-center gap-2.5 text-lg font-medium">
                  <span
                    aria-hidden
                    className={`grid size-6 shrink-0 place-items-center rounded-full border-2 ${selected ? 'border-graphite bg-graphite text-bone' : 'border-graphite-2'}`}
                  >
                    {selected && <Check weight="bold" className="size-3.5" />}
                  </span>
                  {PRESETS[p].label}
                </span>
                <span className="pl-[34px] text-sm text-graphite-2">{PRESETS[p].description}</span>
              </button>
            )
          })}
        </div>

        {provider === 'shellm' && <SheLLM host={effectiveHost} onHost={(h) => setHost(h.trim())} />}

        {provider === 'openai' && !PRESETS.openai.suggestedModel && (
          <Field label="Modelo">
            <Input value={model} onChange={(e) => setModel(e.target.value.trim())} placeholder="Id de un modelo con visión" spellCheck={false} className="numerals" />
          </Field>
        )}

        <Field label={<span className="font-medium text-graphite">Llave de tu experto (API key){keyOptional && ' (opcional)'}</span>}>
          <Input
            type={showKey ? 'text' : 'password'}
            autoComplete="off"
            spellCheck={false}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value.trim())}
            placeholder={KEY_PLACEHOLDER[provider]}
            className="numerals"
            end={<Reveal shown={showKey} onToggle={() => setShowKey((v) => !v)} />}
          />
        </Field>

        {vaultOpen ? (
          <p className="text-sm text-graphite-2">Tus llaves ya están cifradas en este navegador; esta se guarda con tu frase.</p>
        ) : (
          <Field
            label={<span className="font-medium text-graphite">Frase para guardarla (opcional)</span>}
            help={
              <span className="text-sm text-graphite-2">
                Con frase, la llave queda guardada y cifrada en este navegador para la próxima vez. Sin ella, solo dura mientras esta pestaña esté abierta.
              </span>
            }
          >
            <Input
              type={showPassphrase ? 'text' : 'password'}
              autoComplete="new-password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder={`Frase secreta (${MIN_PASSPHRASE} caracteres o más)`}
              className="numerals"
              end={<Reveal shown={showPassphrase} onToggle={() => setShowPassphrase((v) => !v)} />}
            />
          </Field>
        )}

        <p className="text-sm">Usa llaves dedicadas, con tope de gasto, y rótalas al terminar.</p>
        {savedKeysWaiting && (
          <p className="text-sm text-rust">
            Al conectar con una llave nueva se borran las guardadas.{' '}
            <button type="button" className="font-medium underline" onClick={onBack}>
              Volver a mis llaves
            </button>
          </p>
        )}
        {error && <p className="text-sm text-rust">{error}</p>}
      </Shell>
    </form>
  )
}
