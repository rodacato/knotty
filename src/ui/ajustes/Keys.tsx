import * as Dialog from '@radix-ui/react-dialog'
import { LockKey } from '@phosphor-icons/react'
import { useState } from 'react'
import { missing, PRESETS } from '../../ports/Preferences'
import { useServicios } from '../servicios'
import { Boton, Titulo } from '../sistema/componentes'
import { useTienda } from '../tienda'

/** Abre las llaves guardadas cifradas; olvidarlas pregunta antes porque no tiene vuelta. */
export function Desbloquear({ alAbrir, autoFocus = false }: { alAbrir?: () => void; autoFocus?: boolean }) {
  const desbloquear = useTienda((s) => s.desbloquear)
  const olvidarLlaves = useTienda((s) => s.olvidarLlaves)
  const [frase, setFrase] = useState('')
  const [error, setError] = useState('')
  const [abriendo, setAbriendo] = useState(false)
  const [olvidando, setOlvidando] = useState(false)

  const abrir = async () => {
    setAbriendo(true)
    setError('')
    try {
      await desbloquear(frase)
      alAbrir?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron abrir.')
    }
    setAbriendo(false)
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-2xl border border-linea bg-hueso p-4 text-sm"
      onSubmit={(e) => {
        e.preventDefault()
        void abrir()
      }}
    >
      <p>Tienes llaves guardadas y cifradas en este navegador. Escribe tu frase para usarlas.</p>
      <div className="flex gap-2">
        <input
          type="password"
          value={frase}
          onChange={(e) => setFrase(e.target.value)}
          placeholder="Tu frase secreta"
          aria-label="Frase secreta"
          autoComplete="current-password"
          autoFocus={autoFocus}
          className={`min-h-11 flex-1 rounded-xl border bg-hueso px-3 outline-none focus:border-ambar ${error ? 'border-oxido' : 'border-linea'}`}
        />
        <Boton type="submit" variante="secundario" disabled={!frase || abriendo}>
          {abriendo ? 'Abriendo…' : 'Desbloquear'}
        </Boton>
      </div>
      {error && <p className="text-xs text-oxido">{error}</p>}
      {olvidando ? (
        <p className="flex flex-wrap items-center gap-2 text-xs">
          ¿Borrar las llaves guardadas? No se pueden recuperar.
          <button type="button" className="font-medium underline" onClick={() => setOlvidando(false)}>
            No
          </button>
          <button type="button" className="font-medium text-oxido underline" onClick={olvidarLlaves}>
            Sí, borrarlas
          </button>
        </p>
      ) : (
        <button type="button" className="self-start text-xs font-medium text-oxido" onClick={() => setOlvidando(true)}>
          Olvidé la frase: borrar las llaves guardadas
        </button>
      )}
    </form>
  )
}

/** Al llegar, pide lo que el experto elegido necesita: la frase de las llaves guardadas, o una llave que se perdió al recargar. */
export function PuertaLlaves() {
  const { preferencias } = useServicios()
  const boveda = useTienda((s) => s.boveda)
  const cerrada = useTienda((s) => s.puertaCerrada)
  const ajustesAbiertos = useTienda((s) => s.ajustesAbiertos)
  const cerrar = useTienda((s) => s.cerrarPuerta)
  const usarSimulado = useTienda((s) => s.usarSimulado)
  const abrirAjustes = useTienda((s) => s.abrirAjustes)
  const config = preferencias.load()
  const bloqueada = boveda === 'bloqueada'
  const falta = missing(config)
  const visible = !cerrada && !ajustesAbiertos && (bloqueada || !!falta)
  const nombre = config.activo === 'simulado' ? '' : PRESETS[config.activo].label

  return (
    <Dialog.Root open={visible} onOpenChange={(abierto) => !abierto && cerrar()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-grafito/30 backdrop-blur-[2px]" />
        <Dialog.Content className="animate-aparecer fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-lg flex-col gap-4 rounded-3xl border border-linea bg-hueso p-5 shadow-2xl sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2">
          <div className="flex items-start gap-3">
            <LockKey size={28} weight="duotone" className="mt-1 shrink-0 text-ambar" />
            <div>
              <Dialog.Title asChild>
                <Titulo className="text-xl">{bloqueada ? 'Tus llaves están guardadas' : `Falta tu llave de ${nombre}`}</Titulo>
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-grafito-2">
                {bloqueada
                  ? 'Están cifradas en este navegador; sin tu frase nadie puede leerlas, ni esta página.'
                  : 'Una llave que no guardas vive solo en la pestaña y se pierde al recargar. Sin ella, el experto no puede responder.'}
              </Dialog.Description>
            </div>
          </div>
          {bloqueada ? (
            <Desbloquear alAbrir={cerrar} autoFocus />
          ) : (
            <p className="text-sm text-grafito-2">Ponla de nuevo en los ajustes del experto y elige guardarla cifrada para que no vuelva a pasar.</p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-linea pt-4">
            <button type="button" className="text-sm font-medium text-oxido" onClick={cerrar}>
              Ahora no
            </button>
            <div className="flex gap-2">
              <Boton variante="secundario" onClick={usarSimulado}>
                Usar el modo simulado
              </Boton>
              {!bloqueada && (
                <Boton
                  variante="primario"
                  onClick={() => {
                    cerrar()
                    abrirAjustes(true)
                  }}
                >
                  Poner la llave
                </Boton>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
