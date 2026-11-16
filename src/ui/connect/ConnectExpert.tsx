import * as Dialog from '@radix-ui/react-dialog'
import { LockKey, X } from '@phosphor-icons/react'
import { useState, type ReactNode } from 'react'
import { MIN_PASSPHRASE, PRESETS, SHELLM_URL, type RealProvider } from '../../ports/Preferences'
import { useServices } from '../services'
import { ForgetKeys, useUnlockPassphrase } from '../settings/Keys'
import { SheLLM } from '../system/SheLLM'
import { PassphraseField, UNLOCK_TEXT } from '../system/Unlock'
import { useStore } from '../store'
import { Button, IconButton, Title } from '../system/components'
import { ErrorText, Field, Input } from '../system/Field'
import { RadioCard, RadioGroup } from '../system/RadioCard'
import { Reveal } from '../system/Reveal'
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
        <Dialog.Overlay className="fixed inset-0 z-40 bg-graphite/50" />
        <Dialog.Content className="fixed inset-0 z-50 flex flex-col bg-bone outline-none md:inset-0 md:m-auto md:h-fit md:max-h-[92dvh] md:w-[600px] md:border-2 md:border-graphite">
          <Body onClose={() => setOpen(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Shell({ title, description, footer, children, onClose }: { title: string; description?: string; footer: ReactNode; children: ReactNode; onClose: () => void }) {
  return (
    <>
      <header className="ink-band flex shrink-0 items-center justify-between gap-3 px-5 py-2 md:px-7">
        <Dialog.Title asChild>
          <Title className="text-3xl leading-tight uppercase">{title}</Title>
        </Dialog.Title>
        <Dialog.Close asChild>
          <IconButton size="lg" aria-label="Cerrar" onClick={onClose}>
            <X weight="bold" className="size-5" />
          </IconButton>
        </Dialog.Close>
      </header>
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 pt-5 pb-4 md:px-7">
        {description ? <Dialog.Description className="text-base text-graphite">{description}</Dialog.Description> : <Dialog.Description className="sr-only">{title}</Dialog.Description>}
        {children}
      </div>
      <div className="flex flex-col gap-1 border-t-2 border-graphite px-5 py-4 md:flex-row md:items-center md:gap-2 md:px-7">{footer}</div>
    </>
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
  const config = preferences.load()
  const provider = config.active === 'simulated' ? null : config.active
  const { passphrase, setPassphrase, error, opening, open, canOpen } = useUnlockPassphrase(() => {
    if (expertConnected(preferences.load())) onClose()
  })

  return (
    <form
      className="contents"
      onSubmit={(e) => {
        e.preventDefault()
        if (canOpen) void open()
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
          <div className="flex items-center gap-3 border-2 border-graphite px-4 py-3">
            <LockKey weight="bold" className="size-6 shrink-0" />
            <div className="flex flex-col">
              <span className="font-display text-lg leading-tight font-semibold uppercase">{PRESETS[provider].label}</span>
              <span className="text-[15px] text-graphite">Guardada y cifrada en este navegador.</span>
            </div>
          </div>
        )}
        <p className="text-base text-graphite-2">{UNLOCK_TEXT}</p>
        <PassphraseField
          label="Frase"
          placeholder="Frase secreta"
          value={passphrase}
          onChange={setPassphrase}
          error={error}
          autoFocus
          inputClassName="numerals"
        />
        <ForgetKeys />
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
  const debugVisible = useStore((s) => s.debugVisible)
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
            {debugVisible && (
              <Button
                variant="ghost"
                className="min-h-11 md:order-1 md:mr-auto"
                onClick={() => {
                  switchToSimulated()
                  onClose()
                }}
              >
                Usar el experto simulado
              </Button>
            )}
          </>
        }
      >
        <RadioGroup label="Experto" className="grid divide-y-2 divide-graphite border-2 border-graphite">
          {PROVIDERS.map((p) => (
            <RadioCard key={p} variant="segment" mark checked={provider === p} onChange={() => setProvider(p)} className="flex min-h-11 flex-col justify-center gap-0.5 px-4 py-3 pr-11 text-left">
              <span className="font-display text-lg leading-tight font-semibold uppercase">{PRESETS[p].label}</span>
              <span className="text-[15px] leading-snug">{PRESETS[p].description}</span>
            </RadioCard>
          ))}
        </RadioGroup>

        {provider === 'shellm' && <SheLLM host={effectiveHost} onHost={(h) => setHost(h.trim())} origin={location.origin} learnUrl={SHELLM_URL} />}

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
            end={<Reveal what="llave" shown={showKey} onToggle={() => setShowKey((v) => !v)} />}
          />
        </Field>

        {vaultOpen ? (
          <p className="text-[15px] text-graphite-2">Tus llaves ya están cifradas en este navegador; esta se guarda con tu frase.</p>
        ) : (
          <Field
            label={<span className="font-medium text-graphite">Frase para guardarla (opcional)</span>}
            help={
              <span className="text-[15px] text-graphite-2">
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
              end={<Reveal what="frase" shown={showPassphrase} onToggle={() => setShowPassphrase((v) => !v)} />}
            />
          </Field>
        )}

        <p className="text-[15px]">Usa llaves dedicadas, con tope de gasto, y rótalas al terminar.</p>
        {savedKeysWaiting && (
          <p className="border-l-8 border-graphite pl-3 text-[15px] font-medium text-graphite">
            Al conectar con una llave nueva se borran las guardadas.{' '}
            <button type="button" className="font-medium underline" onClick={onBack}>
              Volver a mis llaves
            </button>
          </p>
        )}
        {error && <ErrorText>{error}</ErrorText>}
      </Shell>
    </form>
  )
}
