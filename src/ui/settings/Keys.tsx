import * as Dialog from '@radix-ui/react-dialog'
import { LockKey } from '@phosphor-icons/react'
import { useState, type ReactNode } from 'react'
import { missing, PRESETS } from '../../ports/Preferences'
import { useServices } from '../services'
import { Button, Title } from '../system/components'
import { Field, Input } from '../system/Field'
import { Reveal } from '../system/Reveal'
import { useStore } from '../store'

export const UNLOCK_TEXT = 'Tienes llaves guardadas y cifradas en este navegador. Escribe tu frase para usarlas.'

/** The passphrase of the saved keys, with its eye and its error under the field. */
export function PassphraseField({
  value,
  onChange,
  error,
  label,
  hiddenLabel = false,
  placeholder,
  autoFocus = false,
  className = '',
  inputClassName = '',
}: {
  value: string
  onChange: (value: string) => void
  error: string
  label: ReactNode
  hiddenLabel?: boolean
  placeholder: string
  autoFocus?: boolean
  className?: string
  inputClassName?: string
}) {
  const [shown, setShown] = useState(false)
  return (
    <Field label={label} hiddenLabel={hiddenLabel} error={error} className={className}>
      <Input
        type={shown ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="current-password"
        autoFocus={autoFocus}
        invalid={!!error}
        className={inputClassName}
        end={<Reveal what="frase" shown={shown} onToggle={() => setShown((v) => !v)} />}
      />
    </Field>
  )
}

/** 16 px text lines get a 44 px hit area without changing the look. */
export const FORGET_HIT_AREA = "relative before:absolute before:-inset-y-3.5 before:inset-x-0 before:content-['']"

/** Forgetting the saved keys asks first because it cannot be undone. */
export function ForgetKeys() {
  const forgetKeys = useStore((s) => s.forgetKeys)
  const [asking, setAsking] = useState(false)
  return asking ? (
    <p className="flex flex-wrap items-center gap-2 text-xs">
      ¿Borrar las llaves guardadas? No se pueden recuperar.
      <button type="button" className={`font-medium underline ${FORGET_HIT_AREA}`} onClick={() => setAsking(false)}>
        No
      </button>
      <button type="button" className={`font-medium text-rust underline ${FORGET_HIT_AREA}`} onClick={forgetKeys}>
        Sí, borrarlas
      </button>
    </p>
  ) : (
    <button type="button" className={`self-start text-xs font-medium text-rust ${FORGET_HIT_AREA}`} onClick={() => setAsking(true)}>
      Olvidé la frase: borrar las llaves guardadas
    </button>
  )
}

/** Opens the encrypted saved keys. */
export function useUnlockPassphrase(onOpen?: () => void) {
  const unlock = useStore((s) => s.unlock)
  const [passphrase, setPassphrase] = useState('')
  const [error, setError] = useState('')
  const [opening, setOpening] = useState(false)

  const open = async () => {
    setOpening(true)
    setError('')
    try {
      await unlock(passphrase)
      onOpen?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron abrir.')
    }
    setOpening(false)
  }

  return { passphrase, setPassphrase, error, opening, open, canOpen: !!passphrase && !opening }
}

export function Unlock({ onOpen, autoFocus = false }: { onOpen?: () => void; autoFocus?: boolean }) {
  const { passphrase, setPassphrase, error, opening, open, canOpen } = useUnlockPassphrase(onOpen)

  return (
    <form
      className="flex flex-col gap-3 text-sm"
      onSubmit={(e) => {
        e.preventDefault()
        if (canOpen) void open()
      }}
    >
      <p>{UNLOCK_TEXT}</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <PassphraseField
          label="Frase secreta"
          hiddenLabel
          placeholder="Tu frase secreta"
          value={passphrase}
          onChange={setPassphrase}
          error={error}
          autoFocus={autoFocus}
          className="flex-1"
        />
        <Button type="submit" variant="primary" className="min-h-11" disabled={!passphrase || opening}>
          {opening ? 'Abriendo…' : 'Desbloquear'}
        </Button>
      </div>
      <ForgetKeys />
    </form>
  )
}

/** On arrival, asks for what the chosen expert needs: the passphrase of the saved keys, or a key lost on reload. */
export function KeysGate() {
  const { preferences } = useServices()
  const vault = useStore((s) => s.vault)
  const closed = useStore((s) => s.gateClosed)
  const settingsOpen = useStore((s) => s.settingsOpen)
  const close = useStore((s) => s.closeGate)
  const switchToSimulated = useStore((s) => s.switchToSimulated)
  const openConnect = useStore((s) => s.openConnect)
  const config = preferences.load()
  const locked = vault === 'locked'
  const missingKey = missing(config)
  const connectOpen = useStore((s) => s.connectOpen)
  const visible = !closed && !settingsOpen && !connectOpen && (locked || !!missingKey)
  const name = config.active === 'simulated' ? '' : PRESETS[config.active].label

  return (
    <Dialog.Root open={visible} onOpenChange={(open) => !open && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-graphite/30 backdrop-blur-[2px]" />
        <Dialog.Content className="animate-appear fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-lg flex-col gap-4 rounded-3xl border border-line bg-bone p-5 shadow-2xl sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2">
          <div className="flex items-start gap-3">
            <LockKey size={28} weight="duotone" className="mt-1 shrink-0 text-graphite" />
            <div>
              <Dialog.Title asChild>
                <Title className="text-xl">{locked ? 'Tus llaves están guardadas' : `Falta tu llave de ${name}`}</Title>
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-graphite">
                {locked
                  ? 'Están cifradas en este navegador; sin tu frase nadie puede leerlas, ni esta página.'
                  : 'Una llave que no guardas vive solo en la pestaña y se pierde al recargar. Sin ella, el experto no puede responder.'}
              </Dialog.Description>
            </div>
          </div>
          {locked ? (
            <Unlock onOpen={close} autoFocus />
          ) : (
            <p className="text-sm text-graphite">Ponla de nuevo en los ajustes del experto y elige guardarla cifrada para que no vuelva a pasar.</p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
            <Button variant="ghost" onClick={close}>
              Ahora no
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={switchToSimulated}>
                Usar el modo simulado
              </Button>
              {!locked && (
                <Button
                  variant="primary"
                  onClick={() => {
                    close()
                    openConnect(true)
                  }}
                >
                  Poner la llave
                </Button>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
