import * as Dialog from '@radix-ui/react-dialog'
import { LockKey } from '@phosphor-icons/react'
import { useState } from 'react'
import { missing, PRESETS } from '../../ports/Preferences'
import { useServices } from '../services'
import { Button, Title } from '../sistema/components'
import { useStore } from '../store'

/** Opens the encrypted saved keys; forgetting them asks first because it cannot be undone. */
export function Unlock({ onOpen, autoFocus = false }: { onOpen?: () => void; autoFocus?: boolean }) {
  const unlock = useStore((s) => s.unlock)
  const forgetKeys = useStore((s) => s.forgetKeys)
  const [passphrase, setPassphrase] = useState('')
  const [error, setError] = useState('')
  const [opening, setOpening] = useState(false)
  const [forgetting, setForgetting] = useState(false)

  const setOpen = async () => {
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

  return (
    <form
      className="flex flex-col gap-3 rounded-2xl border border-linea bg-hueso p-4 text-sm"
      onSubmit={(e) => {
        e.preventDefault()
        void setOpen()
      }}
    >
      <p>Tienes llaves guardadas y cifradas en este navegador. Escribe tu frase para usarlas.</p>
      <div className="flex gap-2">
        <input
          type="password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          placeholder="Tu frase secreta"
          aria-label="Frase secreta"
          autoComplete="current-password"
          autoFocus={autoFocus}
          className={`min-h-11 flex-1 rounded-xl border bg-hueso px-3 outline-none focus:border-ambar ${error ? 'border-oxido' : 'border-linea'}`}
        />
        <Button type="submit" variant="secondary" disabled={!passphrase || opening}>
          {opening ? 'Abriendo…' : 'Desbloquear'}
        </Button>
      </div>
      {error && <p className="text-xs text-oxido">{error}</p>}
      {forgetting ? (
        <p className="flex flex-wrap items-center gap-2 text-xs">
          ¿Borrar las llaves guardadas? No se pueden recuperar.
          <button type="button" className="font-medium underline" onClick={() => setForgetting(false)}>
            No
          </button>
          <button type="button" className="font-medium text-oxido underline" onClick={forgetKeys}>
            Sí, borrarlas
          </button>
        </p>
      ) : (
        <button type="button" className="self-start text-xs font-medium text-oxido" onClick={() => setForgetting(true)}>
          Olvidé la frase: borrar las llaves guardadas
        </button>
      )}
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
  const openSettings = useStore((s) => s.openSettings)
  const config = preferences.load()
  const locked = vault === 'locked'
  const missingKey = missing(config)
  const visible = !closed && !settingsOpen && (locked || !!missingKey)
  const name = config.active === 'simulated' ? '' : PRESETS[config.active].label

  return (
    <Dialog.Root open={visible} onOpenChange={(open) => !open && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-grafito/30 backdrop-blur-[2px]" />
        <Dialog.Content className="animate-aparecer fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-lg flex-col gap-4 rounded-3xl border border-linea bg-hueso p-5 shadow-2xl sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2">
          <div className="flex items-start gap-3">
            <LockKey size={28} weight="duotone" className="mt-1 shrink-0 text-ambar" />
            <div>
              <Dialog.Title asChild>
                <Title className="text-xl">{locked ? 'Tus llaves están guardadas' : `Falta tu llave de ${name}`}</Title>
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-grafito-2">
                {locked
                  ? 'Están cifradas en este navegador; sin tu frase nadie puede leerlas, ni esta página.'
                  : 'Una llave que no guardas vive solo en la pestaña y se pierde al recargar. Sin ella, el experto no puede responder.'}
              </Dialog.Description>
            </div>
          </div>
          {locked ? (
            <Unlock onOpen={close} autoFocus />
          ) : (
            <p className="text-sm text-grafito-2">Ponla de nuevo en los ajustes del experto y elige guardarla cifrada para que no vuelva a pasar.</p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-linea pt-4">
            <button type="button" className="text-sm font-medium text-oxido" onClick={close}>
              Ahora no
            </button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={switchToSimulated}>
                Usar el modo simulado
              </Button>
              {!locked && (
                <Button
                  variant="primary"
                  onClick={() => {
                    close()
                    openSettings(true)
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
