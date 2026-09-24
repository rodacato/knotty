import * as Dialog from '@radix-ui/react-dialog'
import * as Tabs from '@radix-ui/react-tabs'
import { ArrowCounterClockwise, ArrowsIn, PencilSimpleLine, ArrowsOut, CaretDown, CaretUp, ChatCircleText, ClockCounterClockwise, GearSix, ListChecks, Plus, Ruler, Stack, X } from '@phosphor-icons/react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { analizar } from '../../domain/analisis'
import { diferencias } from '../../domain/diseno/diff'
import { verificarRequisitos } from '../../domain/requisitos/requisitos'
import { disenoActual, type EstadoDiseno } from '../../domain/sesion/estado'
import { etiquetaActiva } from '../../ports/Preferencias'
import { Chat } from '../chat/Chat'
import { Escena } from '../escena/Escena'
import { useServicios } from '../servicios'
import { Boton, cm } from '../sistema/componentes'
import { disenoVisible, useTienda, type Vista } from '../tienda'
import { Historial } from './Historial'
import { Materiales } from './Materiales'
import { FichaPieza } from './Paneles'
import { Revision } from './Revision'

const VISTAS: { id: Vista; nombre: string }[] = [
  { id: 'frente', nombre: 'Frente' },
  { id: 'lado', nombre: 'Lado' },
  { id: 'tres-cuartos', nombre: '3/4' },
  { id: 'arriba', nombre: 'Arriba' },
]

function useEscritorio() {
  const consulta = '(min-width: 768px)'
  const [si, setSi] = useState(() => matchMedia(consulta).matches)
  useEffect(() => {
    const m = matchMedia(consulta)
    const cambio = () => setSi(m.matches)
    m.addEventListener('change', cambio)
    return () => m.removeEventListener('change', cambio)
  }, [])
  return si
}

function BarraEscena() {
  const vista = useTienda((s) => s.vista.nombre)
  const verDesde = useTienda((s) => s.verDesde)
  const explosion = useTienda((s) => s.explosion)
  const alternarExplosion = useTienda((s) => s.alternarExplosion)
  const cotas = useTienda((s) => s.cotas)
  const alternarCotas = useTienda((s) => s.alternarCotas)
  const boton = (activo: boolean) => `grid min-h-9 min-w-9 place-items-center rounded-full px-3 text-xs font-medium transition ${activo ? 'bg-grafito text-hueso' : 'text-grafito hover:bg-kraft'}`
  return (
    <div className="pointer-events-auto flex flex-wrap items-center gap-2">
      <div className="flex items-center rounded-full border border-linea bg-hueso/90 p-1 shadow-sm backdrop-blur" role="group" aria-label="Vistas">
        {VISTAS.map((v) => (
          <button key={v.id} type="button" className={boton(vista === v.id)} onClick={() => verDesde(v.id)} aria-pressed={vista === v.id}>
            {v.nombre}
          </button>
        ))}
      </div>
      <div className="flex items-center rounded-full border border-linea bg-hueso/90 p-1 shadow-sm backdrop-blur">
        <button type="button" className={`${boton(explosion)} gap-1.5 [grid-auto-flow:column]`} onClick={alternarExplosion} aria-pressed={explosion}>
          {explosion ? <ArrowsIn weight="bold" /> : <ArrowsOut weight="bold" />} Armado
        </button>
        <button type="button" className={boton(cotas)} onClick={alternarCotas} aria-pressed={cotas} aria-label="Cotas">
          <Ruler weight="bold" />
        </button>
      </div>
    </div>
  )
}

function ConfirmarNuevo({ children }: { children: ReactNode }) {
  const nuevoDiseno = useTienda((s) => s.nuevoDiseno)
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-grafito/30 backdrop-blur-[2px]" />
        <Dialog.Content className="animate-aparecer fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-sm flex-col gap-3 rounded-3xl border border-linea bg-hueso p-5 shadow-2xl sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2">
          <Dialog.Title className="font-titulo text-xl font-semibold">¿Empezar un diseño nuevo?</Dialog.Title>
          <Dialog.Description className="text-sm text-grafito-2">Se borran este diseño, su historial y la conversación. No se puede deshacer.</Dialog.Description>
          <div className="mt-2 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Boton variante="fantasma">Conservar</Boton>
            </Dialog.Close>
            <Boton variante="peligro" onClick={nuevoDiseno}>
              Empezar de cero
            </Boton>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Encabezado({ estado }: { estado: EstadoDiseno }) {
  const { preferencias } = useServicios()
  const abrirAjustes = useTienda((s) => s.abrirAjustes)
  const ajustesAbiertos = useTienda((s) => s.ajustesAbiertos)
  const diseno = disenoActual(estado)
  const { ancho, alto, fondo } = diseno.dimensiones
  const etiqueta = useMemo(() => etiquetaActiva(preferencias.cargar()), [preferencias, ajustesAbiertos])
  return (
    <header className="flex items-center gap-3 border-b border-linea bg-hueso/80 px-3 py-2 backdrop-blur md:px-5">
      <img src="./favicon.svg" alt="" className="size-8" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-titulo text-lg leading-tight font-semibold">{diseno.nombre}</p>
        <p className="cifras truncate text-[11px] text-grafito-2">
          {alto} × {ancho} × {fondo} mm · {cm(ancho)} de ancho
        </p>
      </div>
      <Boton variante="fantasma" className="min-h-9 px-3 text-xs" onClick={() => abrirAjustes(true)}>
        <GearSix /> <span className="hidden sm:inline">{etiqueta}</span>
      </Boton>
      <ConfirmarNuevo>
        <Boton variante="secundario" className="min-h-9 px-3 text-xs">
          <Plus weight="bold" /> <span className="hidden sm:inline">Nuevo diseño</span>
        </Boton>
      </ConfirmarNuevo>
    </header>
  )
}

export function Estudio({ estado }: { estado: EstadoDiseno }) {
  const { catalogo } = useServicios()
  const verPropuesta = useTienda((s) => s.verPropuesta)
  const versionVista = useTienda((s) => s.versionVista)
  const verVersion = useTienda((s) => s.verVersion)
  const volverAVersion = useTienda((s) => s.volverAVersion)
  const escritorio = useEscritorio()
  const [panelAlto, setPanelAlto] = useState(false)
  const [pestana, setPestana] = useState('chat')
  const ajustar = useTienda((s) => s.ajustar)
  const pedir = (texto: string) => {
    setPestana('chat')
    void ajustar(texto)
  }

  const actual = disenoActual(estado)
  // Los requisitos no bloquean el dibujo: si el diseño vigente no los cumple, se avisa en la revisión.
  const analisisActual = useMemo(() => analizar(actual, catalogo), [actual, catalogo])
  const incumplidos = useMemo(() => verificarRequisitos(actual, estado.requisitos), [actual, estado.requisitos])
  const mostrado = disenoVisible({ estado, versionVista, verPropuesta }) ?? actual
  const propuesta = versionVista === null && estado.propuesta && verPropuesta ? estado.propuesta.diseno : null
  const analisisMostrado = useMemo(() => (mostrado === actual ? analisisActual : analizar(mostrado, catalogo)), [mostrado, actual, catalogo, analisisActual])
  const cambios = useMemo(() => {
    if (!propuesta || !analisisActual.valido || !analisisMostrado.valido) return { agregadas: [], modificadas: [] }
    return diferencias(actual, analisisActual.geo.cajas, propuesta, analisisMostrado.geo.cajas)
  }, [propuesta, actual, analisisActual, analisisMostrado])

  const hallazgos = analisisActual.valido ? analisisActual.hallazgos : []
  const porConfirmar = actual.piezas.filter((p) => p.confianza === 'baja')
  const seleccionar = useTienda((s) => s.seleccionar)
  const criticos = hallazgos.filter((h) => h.severidad === 'critico').length + incumplidos.length

  const escena = (
    <div className="relative h-full min-h-0 bg-[var(--fondo-escena)]">
      {analisisMostrado.valido ? (
        <Escena diseno={mostrado} geo={analisisMostrado.geo} catalogo={catalogo} fantasmas={cambios.agregadas} marcadas={cambios.modificadas} />
      ) : (
        <div className="grid h-full place-items-center p-6 text-center text-sm text-oxido">Este diseño tiene errores: {analisisMostrado.errores[0]?.mensaje}</div>
      )}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex flex-col items-start gap-2 md:inset-x-4 md:top-4">
        <BarraEscena />
        {propuesta && <span className="animate-aparecer rounded-full bg-ambar px-3 py-1 text-xs font-medium text-grafito shadow">Viendo la propuesta sin aplicar</span>}
        {porConfirmar.length > 0 && versionVista === null && !propuesta && (
          <button
            type="button"
            onClick={() => seleccionar(porConfirmar[0].id)}
            className="animate-aparecer pointer-events-auto flex items-center gap-1.5 rounded-full border border-grafito/30 bg-[#f4ede1] px-3 py-1 text-xs font-medium text-grafito shadow-sm"
          >
            <PencilSimpleLine /> {porConfirmar.length === 1 ? `${porConfirmar[0].nombre} por confirmar` : `${porConfirmar.length} piezas por confirmar`}
          </button>
        )}
        {versionVista !== null && (
          <span className="animate-aparecer pointer-events-auto flex items-center gap-1 rounded-full bg-grafito py-1 pr-1 pl-3 text-xs font-medium text-hueso shadow">
            Viendo v{versionVista}
            <button type="button" onClick={() => volverAVersion(versionVista)} className="flex items-center gap-1 rounded-full bg-hueso/15 px-2 py-0.5 hover:bg-hueso/25">
              <ArrowCounterClockwise /> Volver a esta
            </button>
            <button type="button" onClick={() => verVersion(null)} aria-label="Dejar de ver" className="grid size-6 place-items-center rounded-full hover:bg-hueso/20">
              <X />
            </button>
          </span>
        )}
      </div>
      {analisisMostrado.valido && (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 flex justify-end md:top-auto md:right-4 md:bottom-4 md:left-auto">
          <FichaPieza diseno={mostrado} geo={analisisMostrado.geo} catalogo={catalogo} />
        </div>
      )}
    </div>
  )

  const panel = (
    <Tabs.Root value={pestana} onValueChange={setPestana} className="flex h-full min-h-0 flex-col bg-hueso/60">
      <Tabs.List className="flex items-center gap-0.5 overflow-x-auto border-b border-linea px-2 [scrollbar-width:none]" aria-label="Panel">
        {[
          { id: 'chat', nombre: 'Experto', icono: <ChatCircleText /> },
          { id: 'materiales', nombre: 'Materiales', icono: <Stack /> },
          { id: 'revision', nombre: 'Revisión', icono: <ListChecks /> },
          { id: 'historial', nombre: 'Historial', icono: <ClockCounterClockwise /> },
        ].map((t) => (
          <Tabs.Trigger
            key={t.id}
            value={t.id}
            className="relative flex min-h-11 items-center gap-1.5 px-2.5 text-sm text-grafito-2 transition data-[state=active]:font-medium data-[state=active]:text-grafito data-[state=active]:after:absolute data-[state=active]:after:inset-x-3 data-[state=active]:after:bottom-0 data-[state=active]:after:h-0.5 data-[state=active]:after:rounded-full data-[state=active]:after:bg-ambar"
          >
            <span className="hidden sm:inline-flex">{t.icono}</span>
            {t.nombre}
            {t.id === 'revision' && criticos > 0 && <span className="cifras grid size-5 place-items-center rounded-full bg-oxido text-[10px] text-white">{criticos}</span>}
          </Tabs.Trigger>
        ))}
        {!escritorio && (
          <button type="button" onClick={() => setPanelAlto((v) => !v)} className="ml-auto grid size-9 place-items-center rounded-full text-grafito-2 hover:bg-kraft" aria-label={panelAlto ? 'Agrandar el 3D' : 'Agrandar el panel'}>
            {panelAlto ? <CaretDown /> : <CaretUp />}
          </button>
        )}
      </Tabs.List>
      <Tabs.Content value="chat" className="min-h-0 flex-1">
        <Chat estado={estado} />
      </Tabs.Content>
      <Tabs.Content value="materiales" className="min-h-0 flex-1 overflow-y-auto">
        {analisisActual.valido && <Materiales diseno={actual} geo={analisisActual.geo} catalogo={catalogo} />}
      </Tabs.Content>
      <Tabs.Content value="revision" className="min-h-0 flex-1 overflow-y-auto">
        <Revision hallazgos={hallazgos} incumplidos={incumplidos.map((e) => e.mensaje)} diseno={actual} alPedir={pedir} />
      </Tabs.Content>
      <Tabs.Content value="historial" className="min-h-0 flex-1 overflow-y-auto">
        <Historial estado={estado} />
      </Tabs.Content>
    </Tabs.Root>
  )

  return (
    <div className="flex h-dvh flex-col">
      <Encabezado estado={estado} />
      {escritorio ? (
        <div className="grid min-h-0 flex-1 grid-cols-[1fr_minmax(360px,420px)]">
          {escena}
          <aside className="min-h-0 border-l border-linea">{panel}</aside>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 transition-[height] duration-300 ease-out" style={{ height: panelAlto ? '30%' : '52%' }}>
            {escena}
          </div>
          <div className="min-h-0 flex-1 border-t border-linea">{panel}</div>
        </div>
      )}
    </div>
  )
}
