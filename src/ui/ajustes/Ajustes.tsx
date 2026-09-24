import * as Dialog from '@radix-ui/react-dialog'
import { ArrowCounterClockwise, Eye, EyeSlash, X } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { PRESETS, type ConfiguracionLLM, type Proveedor } from '../../ports/Preferencias'
import { useServicios } from '../servicios'
import { Boton, Titulo } from '../sistema/componentes'
import { useTienda } from '../tienda'

const PROVEEDORES: Proveedor[] = ['simulado', 'anthropic', 'openai']

type EstadoModelos = { tipo: 'nada' | 'cargando' } | { tipo: 'listo'; modelos: string[] } | { tipo: 'error'; mensaje: string }

export function Ajustes() {
  const { preferencias } = useServicios()
  const abierto = useTienda((s) => s.ajustesAbiertos)
  const abrir = useTienda((s) => s.abrirAjustes)
  const [borrador, setBorrador] = useState<ConfiguracionLLM>(preferencias.cargar())
  const [verLlave, setVerLlave] = useState(false)
  const [modelos, setModelos] = useState<EstadoModelos>({ tipo: 'nada' })

  useEffect(() => {
    if (abierto) setBorrador(preferencias.cargar())
  }, [abierto, preferencias])
  useEffect(() => setModelos({ tipo: 'nada' }), [borrador.activo])

  const activo = borrador.activo
  const conexion = activo === 'simulado' ? null : borrador.conexiones[activo]
  const cambiar = (patch: Partial<{ modelo: string; apiKey: string }>) => {
    if (activo === 'simulado') return
    setBorrador((b) => ({ ...b, conexiones: { ...b.conexiones, [activo]: { ...b.conexiones[activo], ...patch } } }))
  }
  const cargarModelos = async () => {
    if (activo === 'simulado' || !conexion?.apiKey) return
    setModelos({ tipo: 'cargando' })
    try {
      setModelos({ tipo: 'listo', modelos: await preferencias.modelos(activo, conexion.apiKey) })
    } catch (e) {
      setModelos({ tipo: 'error', mensaje: e instanceof Error ? e.message : 'No se pudo cargar la lista.' })
    }
  }
  const guardar = () => {
    preferencias.guardar(borrador)
    abrir(false)
  }

  return (
    <Dialog.Root open={abierto} onOpenChange={abrir}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-grafito/30 backdrop-blur-[2px]" />
        <Dialog.Content className="animate-aparecer fixed inset-x-3 bottom-3 z-50 mx-auto flex max-h-[90dvh] max-w-lg flex-col gap-5 overflow-y-auto rounded-3xl border border-linea bg-hueso p-5 shadow-2xl sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2">
          <div className="flex items-center justify-between">
            <Dialog.Title asChild>
              <Titulo className="text-xl">El experto</Titulo>
            </Dialog.Title>
            <Dialog.Close className="grid size-9 place-items-center rounded-full hover:bg-kraft" aria-label="Cerrar">
              <X />
            </Dialog.Close>
          </div>
          <Dialog.Description className="-mt-3 text-sm text-grafito-2">
            Usa tu propia API key. Se queda solo en este dispositivo y se envía directo al proveedor.
          </Dialog.Description>

          <div role="radiogroup" className="grid gap-2">
            {PROVEEDORES.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={activo === p}
                onClick={() => setBorrador((b) => ({ ...b, activo: p }))}
                className={`flex flex-col items-start rounded-2xl border px-4 py-3 text-left transition ${activo === p ? 'border-ambar bg-ambar-suave' : 'border-linea hover:bg-kraft'}`}
              >
                <span className="font-medium">{PRESETS[p].etiqueta}</span>
                <span className="text-xs text-grafito-2">{PRESETS[p].descripcion}</span>
              </button>
            ))}
          </div>

          {conexion && activo !== 'simulado' && (
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">API key</span>
                <span className="flex items-center gap-2 rounded-xl border border-linea bg-hueso px-3 focus-within:border-ambar">
                  <input
                    type={verLlave ? 'text' : 'password'}
                    autoComplete="off"
                    spellCheck={false}
                    value={conexion.apiKey}
                    onChange={(e) => cambiar({ apiKey: e.target.value.trim() })}
                    placeholder={activo === 'anthropic' ? 'sk-ant-…' : 'sk-…'}
                    className="cifras min-h-11 flex-1 bg-transparent text-sm outline-none"
                  />
                  <button type="button" onClick={() => setVerLlave((v) => !v)} aria-label={verLlave ? 'Ocultar' : 'Mostrar'} className="text-grafito-2">
                    {verLlave ? <EyeSlash /> : <Eye />}
                  </button>
                </span>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="flex items-center justify-between text-sm font-medium">
                  Modelo
                  <button type="button" onClick={() => void cargarModelos()} disabled={!conexion.apiKey || modelos.tipo === 'cargando'} className="flex items-center gap-1 text-xs font-normal text-grafito-2 underline disabled:opacity-40">
                    <ArrowCounterClockwise /> {modelos.tipo === 'cargando' ? 'Cargando…' : 'Cargar lista'}
                  </button>
                </span>
                {modelos.tipo === 'listo' ? (
                  <select value={conexion.modelo} onChange={(e) => cambiar({ modelo: e.target.value })} className="cifras min-h-11 rounded-xl border border-linea bg-hueso px-3 text-sm">
                    {!modelos.modelos.includes(conexion.modelo) && <option value={conexion.modelo}>{conexion.modelo || 'Elige un modelo'}</option>}
                    {modelos.modelos.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={conexion.modelo}
                    onChange={(e) => cambiar({ modelo: e.target.value.trim() })}
                    placeholder={PRESETS[activo].modeloSugerido || 'Carga la lista o escribe el id'}
                    className="cifras min-h-11 rounded-xl border border-linea bg-hueso px-3 text-sm outline-none focus:border-ambar"
                  />
                )}
                {modelos.tipo === 'error' && <span className="text-xs text-oxido">{modelos.mensaje}</span>}
              </label>
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" checked={borrador.recordarEnPestana} onChange={(e) => setBorrador((b) => ({ ...b, recordarEnPestana: e.target.checked }))} className="mt-1 accent-ambar" />
                <span>
                  Recordar la llave en esta pestaña
                  <span className="block text-xs text-grafito-2">Sobrevive a recargar, se borra al cerrar la pestaña. Si no, vive solo en memoria.</span>
                </span>
              </label>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Dialog.Close asChild>
              <Boton variante="fantasma">Cancelar</Boton>
            </Dialog.Close>
            <Boton variante="primario" onClick={guardar}>
              Guardar
            </Boton>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
