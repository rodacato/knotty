import * as Dialog from '@radix-ui/react-dialog'
import * as Tabs from '@radix-ui/react-tabs'
import { Armchair, ArrowCounterClockwise, ArrowsIn, PencilSimpleLine, ArrowsOut, Bell, CaretDown, CaretUp, ChatCircleText, ClockCounterClockwise, GearSix, Plus, Ruler, Stack, Warning, X } from '@phosphor-icons/react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { analizar } from '../../domain/analisis'
import { diferencias } from '../../domain/diseno/diff'
import { disenoActual, type EstadoDiseno } from '../../domain/sesion/estado'
import { etiquetaActiva } from '../../ports/Preferencias'
import { Chat } from '../chat/Chat'
import { BordeEscena } from '../escena/BordeEscena'
import { Escena } from '../escena/Escena'
import { useServicios } from '../servicios'
import { Boton, cm } from '../sistema/componentes'
import { Simbolo } from '../sistema/Marca'
import { disenoVisible, useTienda, type Vista } from '../tienda'
import { FurniturePanel } from './FurniturePanel'
import { HistoryPanel } from './HistoryPanel'
import { Materiales } from './Materiales'
import { FichaPieza } from './Paneles'
import { noticeBoard } from '../../application/notices'
import { currentPlan } from '../../application/casosDeUso'
import { isBed } from '../../domain/modules/plan'
import { NoticePanel } from './NoticePanel'

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

type Overlay = 'notices' | 'history'

function Encabezado({ estado, pending, overlay, onOpen }: { estado: EstadoDiseno; pending: number; overlay: Overlay | null; onOpen: (o: Overlay) => void }) {
  const { preferencias } = useServicios()
  const abrirAjustes = useTienda((s) => s.abrirAjustes)
  const ajustesAbiertos = useTienda((s) => s.ajustesAbiertos)
  const diseno = disenoActual(estado)
  const { ancho, alto, fondo } = diseno.dimensiones
  const plan = currentPlan(estado).plan
  // A bed reads as its width by its length and its mattress; along x runs its length.
  const bed = plan && isBed(plan) && !currentPlan(estado).diverged ? plan : null
  const etiqueta = useMemo(() => etiquetaActiva(preferencias.cargar()), [preferencias, ajustesAbiertos])
  return (
    <header className="flex items-center gap-1 border-b border-linea bg-hueso/80 px-2 py-2 backdrop-blur sm:gap-3 sm:px-3 md:px-5">
      <Simbolo className="size-7 shrink-0 sm:size-8" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-titulo text-lg leading-tight font-semibold">{diseno.nombre}</p>
        <p className="cifras truncate text-[11px] text-grafito-2">
          {bed ? `${cm(fondo)} × ${cm(ancho)} · colchón ${bed.mattress}` : `${alto} × ${ancho} × ${fondo} mm · ${cm(ancho)} de ancho`}
        </p>
      </div>
      <Boton variante="fantasma" className={`min-h-9 gap-1 px-2 text-xs ${overlay === 'history' ? 'bg-kraft' : ''}`} onClick={() => onOpen('history')} aria-pressed={overlay === 'history'} aria-label={`Versión ${estado.actual}: ver el historial`} title="Historial">
        <ClockCounterClockwise /> <span className="cifras">v{estado.actual}</span>
      </Boton>
      <Boton variante="fantasma" className={`relative min-h-9 px-2 ${overlay === 'notices' ? 'bg-kraft' : ''}`} onClick={() => onOpen('notices')} aria-pressed={overlay === 'notices'} aria-label={pending ? `${pending} ${pending === 1 ? 'aviso' : 'avisos'} por decidir` : 'Avisos'} title="Avisos">
        <Bell weight={pending ? 'fill' : 'regular'} className={pending ? 'text-ambar' : ''} />
        {pending > 0 && <span className="cifras absolute -top-0.5 -right-0.5 grid min-w-5 place-items-center rounded-full bg-oxido px-1 text-[10px] text-white">{pending}</span>}
      </Boton>
      <Boton variante="fantasma" className="min-h-9 px-2 text-xs sm:px-3" onClick={() => abrirAjustes(true)} aria-label={`El experto: ${etiqueta}`}>
        <GearSix /> <span className="hidden sm:inline">{etiqueta}</span>
      </Boton>
      <ConfirmarNuevo>
        <Boton variante="secundario" className="min-h-9 px-2.5 text-xs sm:px-3" aria-label="Nuevo diseño">
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
  // Notices and history take the place of the tabs, so the 3D stays in sight to preview what they offer.
  const [overlay, setOverlay] = useState<Overlay | null>(null)
  const toggleOverlay = (o: Overlay) => setOverlay((v) => (v === o ? null : o))
  const toChat = () => {
    setOverlay(null)
    setPestana('chat')
  }
  const ajustar = useTienda((s) => s.ajustar)
  const seleccionarPieza = useTienda((s) => s.seleccionar)
  const pedir = (texto: string) => {
    toChat()
    void ajustar(texto)
  }

  const actual = disenoActual(estado)
  const analisisActual = useMemo(() => analizar(actual, catalogo), [actual, catalogo])
  const preview = useTienda((s) => s.preview)
  const previewFix = useTienda((s) => s.previewFix)
  // A preview belongs to the version it was built on and to the open notices: a new version or closing them clears it.
  useEffect(() => previewFix(null), [estado.actual, overlay, previewFix])
  const mostrado = preview?.design ?? disenoVisible({ estado, versionVista, verPropuesta }) ?? actual
  const propuesta = preview?.design ?? (versionVista === null && estado.propuesta && verPropuesta ? estado.propuesta.diseno : null)
  const board = useMemo(() => noticeBoard(estado, catalogo), [estado, catalogo])
  const analisisMostrado = useMemo(() => (mostrado === actual ? analisisActual : analizar(mostrado, catalogo)), [mostrado, actual, catalogo, analisisActual])
  const cambios = useMemo(() => {
    if (!propuesta || !analisisActual.valido || !analisisMostrado.valido) return { agregadas: [], modificadas: [] }
    return diferencias(actual, analisisActual.geo.boxes, propuesta, analisisMostrado.geo.boxes)
  }, [propuesta, actual, analisisActual, analisisMostrado])

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') seleccionarPieza(null)
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [seleccionarPieza])

  const porConfirmar = actual.piezas.filter((p) => p.confianza === 'baja')
  const seleccionar = useTienda((s) => s.seleccionar)

  const geoMostrada = analisisMostrado.geo
  const problemasMostrados = analisisMostrado.valido ? [] : analisisMostrado.errores
  const piezasConProblema = [...new Set(problemasMostrados.flatMap((e) => Object.values(e.data ?? {}).filter((v): v is string => typeof v === 'string' && mostrado.piezas.some((p) => p.id === v))))]

  const escena = (
    <div className="relative h-full min-h-0 bg-[var(--fondo-escena)]">
      {geoMostrada ? (
        <div className="h-full" role="img" aria-label={`${mostrado.nombre} en 3D: ${mostrado.dimensiones.alto} × ${mostrado.dimensiones.ancho} × ${mostrado.dimensiones.fondo} mm, ${mostrado.piezas.length} piezas. La lista completa está en Materiales.`}>
          <BordeEscena>
            <Escena diseno={mostrado} geo={geoMostrada} catalogo={catalogo} fantasmas={cambios.agregadas} marcadas={cambios.modificadas} problemas={piezasConProblema} />
          </BordeEscena>
        </div>
      ) : (
        <div className="grid h-full place-items-center p-6 text-center text-sm text-oxido">Este diseño tiene errores: {problemasMostrados[0]?.message}</div>
      )}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex flex-col items-start gap-2 md:inset-x-4 md:top-4">
        <BarraEscena />
        {propuesta && <span className="animate-aparecer rounded-full bg-ambar px-3 py-1 text-xs font-medium text-grafito shadow">{preview ? `Viendo la solución: ${preview.label}` : 'Viendo la propuesta sin aplicar'}</span>}
        {geoMostrada && problemasMostrados.length > 0 && (
          <button
            type="button"
            onClick={() => setOverlay('notices')}
            className="animate-aparecer pointer-events-auto flex items-center gap-1.5 rounded-full bg-oxido px-3 py-1 text-xs font-medium text-white shadow"
          >
            <Warning weight="bold" /> {problemasMostrados.length === 1 ? 'Un problema sin resolver' : `${problemasMostrados.length} problemas sin resolver`}
          </button>
        )}
        {porConfirmar.length > 0 && versionVista === null && !propuesta && (
          <button
            type="button"
            onClick={() => seleccionar(porConfirmar[0].id)}
            className="animate-aparecer pointer-events-auto flex items-center gap-1.5 rounded-full border border-grafito/30 bg-papel px-3 py-1 text-xs font-medium text-grafito shadow-sm"
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
      {geoMostrada && (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 flex justify-end md:top-auto md:right-4 md:bottom-4 md:left-auto">
          <FichaPieza diseno={mostrado} geo={geoMostrada} catalogo={catalogo} editable={versionVista === null && !propuesta} />
        </div>
      )}
    </div>
  )

  const overlayPanel = overlay && (
    <section className="flex h-full min-h-0 flex-col bg-hueso/60" aria-label={overlay === 'notices' ? 'Avisos' : 'Historial'}>
      <div className="flex min-h-11 items-center gap-2 border-b border-linea px-4">
        {overlay === 'notices' ? <Bell className="text-ambar" weight="duotone" /> : <ClockCounterClockwise className="text-ambar" />}
        <h2 className="flex-1 text-sm font-medium">{overlay === 'notices' ? `Avisos${board.pending.length ? ` · ${board.pending.length} por decidir` : ''}` : 'Historial'}</h2>
        <button type="button" onClick={() => setOverlay(null)} aria-label="Cerrar" className="grid size-9 place-items-center rounded-full text-grafito-2 hover:bg-kraft">
          <X />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{overlay === 'notices' ? <NoticePanel estado={estado} onAnswer={toChat} /> : <HistoryPanel estado={estado} />}</div>
    </section>
  )

  const panel = (
    <>
      {overlayPanel}
      <Tabs.Root value={pestana} onValueChange={setPestana} className={`h-full min-h-0 flex-col bg-hueso/60 ${overlay ? 'hidden' : 'flex'}`}>
        <Tabs.List className="flex items-center gap-0.5 overflow-x-auto border-b border-linea px-2 [scrollbar-width:none]" aria-label="Panel">
          {[
            { id: 'chat', nombre: 'Conversación', icono: <ChatCircleText /> },
            { id: 'mueble', nombre: 'Mueble', icono: <Armchair /> },
            { id: 'materiales', nombre: 'Materiales', icono: <Stack /> },
          ].map((t) => (
            <Tabs.Trigger
              key={t.id}
              value={t.id}
              className="relative flex min-h-11 items-center gap-1.5 px-2.5 text-sm text-grafito-2 transition data-[state=active]:font-medium data-[state=active]:text-grafito data-[state=active]:after:absolute data-[state=active]:after:inset-x-3 data-[state=active]:after:bottom-0 data-[state=active]:after:h-0.5 data-[state=active]:after:rounded-full data-[state=active]:after:bg-ambar"
            >
              <span className="hidden sm:inline-flex">{t.icono}</span>
              {t.nombre}
              {t.id === 'chat' && estado.tray.length > 0 && <span className="cifras grid size-5 place-items-center rounded-full bg-ambar text-[10px] text-grafito" title="En la bandeja">{estado.tray.length}</span>}
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
        <Tabs.Content value="mueble" className="min-h-0 flex-1 overflow-y-auto">
          <FurniturePanel estado={estado} geo={analisisActual.geo ?? null} />
        </Tabs.Content>
        <Tabs.Content value="materiales" className="min-h-0 flex-1 overflow-y-auto">
          {analisisActual.valido ? (
            <Materiales estado={estado} diseno={actual} geo={analisisActual.geo} catalogo={catalogo} alPedir={pedir} />
          ) : (
            <p className="p-4 text-sm text-grafito-2">Primero hay que resolver los problemas del diseño; están en los avisos, en la campana de arriba.</p>
          )}
        </Tabs.Content>
      </Tabs.Root>
    </>
  )

  return (
    <div className="flex h-dvh flex-col">
      <Encabezado estado={estado} pending={board.pending.length} overlay={overlay} onOpen={toggleOverlay} />
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
