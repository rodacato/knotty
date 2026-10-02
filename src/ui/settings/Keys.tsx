import * as Dialog from '@radix-ui/react-dialog'
import { LockKey } from '@phosphor-icons/react'
import { useState } from 'react'
import { missing, PRESETS } from '../../ports/Preferences'
import { useServices } from '../services'
import { Button, Title } from '../system/components'
import { ForgetKeysPrompt, UnlockForm } from '../system/Unlock'
import { useStore } from '../store'

/** Forgetting the saved keys asks first because it cannot be undone. */
export function ForgetKeys() {
  const forgetKeys = useStore((s) => s.forgetKeys)
  return <ForgetKeysPrompt onForget={forgetKeys} />
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
  const forgetKeys = useStore((s) => s.forgetKeys)
  return (
    <UnlockForm
      passphrase={passphrase}
      onPassphrase={setPassphrase}
      error={error}
      opening={opening}
      onSubmit={() => canOpen && void open()}
      onForget={forgetKeys}
      autoFocus={autoFocus}
    />
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
