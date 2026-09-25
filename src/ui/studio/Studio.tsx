import * as Dialog from '@radix-ui/react-dialog'
import * as Tabs from '@radix-ui/react-tabs'
import { Armchair, ArrowCounterClockwise, ArrowsIn, PencilSimpleLine, ArrowsOut, Bell, CaretDown, CaretUp, ChatCircleText, ClockCounterClockwise, GearSix, Plus, Ruler, Stack, Warning, X } from '@phosphor-icons/react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { analyze } from '../../domain/analysis'
import { differences } from '../../domain/design/diff'
import { currentDesign, type DesignState } from '../../domain/session/state'
import { activeLabel } from '../../ports/Preferences'
import { Chat } from '../chat/Chat'
import { SceneBoundary } from '../scene/SceneBoundary'
import { Scene } from '../scene/Scene'
import { useServices } from '../services'
import { Button, cm } from '../system/components'
import { Emblem } from '../system/Brand'
import { visibleDesign, useStore, type View } from '../store'
import { FurniturePanel } from './FurniturePanel'
import { HistoryPanel } from './HistoryPanel'
import { Materials } from './Materials'
import { PieceCard } from './Panels'
import { noticeBoard } from '../../application/notices'
import { currentPlan } from '../../application/useCases'
import { isBed } from '../../domain/modules/plan'
import { NoticePanel } from './NoticePanel'

const VIEWS: { id: View; name: string }[] = [
  { id: 'front', name: 'Frente' },
  { id: 'side', name: 'Lado' },
  { id: 'three-quarter', name: '3/4' },
  { id: 'top', name: 'Arriba' },
]

function useDesktop() {
  const query = '(min-width: 768px)'
  const [matches, setMatches] = useState(() => matchMedia(query).matches)
  useEffect(() => {
    const m = matchMedia(query)
    const change = () => setMatches(m.matches)
    m.addEventListener('change', change)
    return () => m.removeEventListener('change', change)
  }, [])
  return matches
}

function SceneBar() {
  const view = useStore((s) => s.view.name)
  const viewFrom = useStore((s) => s.viewFrom)
  const exploded = useStore((s) => s.exploded)
  const toggleExploded = useStore((s) => s.toggleExploded)
  const dimensions = useStore((s) => s.dimensions)
  const toggleDimensions = useStore((s) => s.toggleDimensions)
  const button = (active: boolean) => `grid min-h-9 min-w-9 place-items-center rounded-full px-3 text-xs font-medium transition ${active ? 'bg-graphite text-bone' : 'text-graphite hover:bg-kraft'}`
  return (
    <div className="pointer-events-auto flex flex-wrap items-center gap-2">
      <div className="flex items-center rounded-full border border-line bg-bone/90 p-1 shadow-sm backdrop-blur" role="group" aria-label="Vistas">
        {VIEWS.map((v) => (
          <button key={v.id} type="button" className={button(view === v.id)} onClick={() => viewFrom(v.id)} aria-pressed={view === v.id}>
            {v.name}
          </button>
        ))}
      </div>
      <div className="flex items-center rounded-full border border-line bg-bone/90 p-1 shadow-sm backdrop-blur">
        <button type="button" className={`${button(exploded)} gap-1.5 [grid-auto-flow:column]`} onClick={toggleExploded} aria-pressed={exploded}>
          {exploded ? <ArrowsIn weight="bold" /> : <ArrowsOut weight="bold" />} Armado
        </button>
        <button type="button" className={button(dimensions)} onClick={toggleDimensions} aria-pressed={dimensions} aria-label="Cotas">
          <Ruler weight="bold" />
        </button>
      </div>
    </div>
  )
}

function ConfirmNew({ children }: { children: ReactNode }) {
  const newDesign = useStore((s) => s.newDesign)
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-graphite/30 backdrop-blur-[2px]" />
        <Dialog.Content className="animate-appear fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-sm flex-col gap-3 rounded-3xl border border-line bg-bone p-5 shadow-2xl sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2">
          <Dialog.Title className="font-display text-xl font-semibold">¿Empezar un diseño nuevo?</Dialog.Title>
          <Dialog.Description className="text-sm text-graphite-2">Se borran este diseño, su historial y la conversación. No se puede deshacer.</Dialog.Description>
          <div className="mt-2 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="ghost">Conservar</Button>
            </Dialog.Close>
            <Button variant="danger" onClick={newDesign}>
              Empezar de cero
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

type Overlay = 'notices' | 'history'

function Header({ state, pending, overlay, onOpen }: { state: DesignState; pending: number; overlay: Overlay | null; onOpen: (o: Overlay) => void }) {
  const { preferences } = useServices()
  const openSettings = useStore((s) => s.openSettings)
  const settingsOpen = useStore((s) => s.settingsOpen)
  const design = currentDesign(state)
  const { width, height, depth } = design.dimensions
  const plan = currentPlan(state).plan
  // A bed reads as its width by its length and its mattress; along x runs its length.
  const bed = plan && isBed(plan) && !currentPlan(state).diverged ? plan : null
  // oxlint-disable-next-line react-hooks/exhaustive-deps -- settingsOpen is the recompute trigger: preferences live in storage, outside React
  const label = useMemo(() => activeLabel(preferences.load()), [preferences, settingsOpen])
  return (
    <header className="flex items-center gap-1 border-b border-line bg-bone/80 px-2 py-2 backdrop-blur sm:gap-3 sm:px-3 md:px-5">
      <Emblem className="size-7 shrink-0 sm:size-8" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-lg leading-tight font-semibold">{design.name}</p>
        <p className="numerals truncate text-[11px] text-graphite-2">
          {bed ? `${cm(depth)} × ${cm(width)} · colchón ${bed.mattress}` : `${height} × ${width} × ${depth} mm · ${cm(width)} de ancho`}
        </p>
      </div>
      <Button variant="ghost" className={`min-h-9 gap-1 px-2 text-xs ${overlay === 'history' ? 'bg-kraft' : ''}`} onClick={() => onOpen('history')} aria-pressed={overlay === 'history'} aria-label={`Versión ${state.current}: ver el historial`} title="Historial">
        <ClockCounterClockwise /> <span className="numerals">v{state.current}</span>
      </Button>
      <Button variant="ghost" className={`relative min-h-9 px-2 ${overlay === 'notices' ? 'bg-kraft' : ''}`} onClick={() => onOpen('notices')} aria-pressed={overlay === 'notices'} aria-label={pending ? `${pending} ${pending === 1 ? 'aviso' : 'avisos'} por decidir` : 'Avisos'} title="Avisos">
        <Bell weight={pending ? 'fill' : 'regular'} className={pending ? 'text-amber' : ''} />
        {pending > 0 && <span className="numerals absolute -top-0.5 -right-0.5 grid min-w-5 place-items-center rounded-full bg-rust px-1 text-[10px] text-white">{pending}</span>}
      </Button>
      <Button variant="ghost" className="min-h-9 px-2 text-xs sm:px-3" onClick={() => openSettings(true)} aria-label={`El experto: ${label}`}>
        <GearSix /> <span className="hidden sm:inline">{label}</span>
      </Button>
      <ConfirmNew>
        <Button variant="secondary" className="min-h-9 px-2.5 text-xs sm:px-3" aria-label="Nuevo diseño">
          <Plus weight="bold" /> <span className="hidden sm:inline">Nuevo diseño</span>
        </Button>
      </ConfirmNew>
    </header>
  )
}

export function Studio({ state }: { state: DesignState }) {
  const { catalog } = useServices()
  const showProposal = useStore((s) => s.showProposal)
  const viewedVersion = useStore((s) => s.viewedVersion)
  const viewVersion = useStore((s) => s.viewVersion)
  const backToVersion = useStore((s) => s.backToVersion)
  const desktop = useDesktop()
  const [tallPanel, setTallPanel] = useState(false)
  const [tab, setTab] = useState('chat')
  // Notices and history take the place of the tabs, so the 3D stays in sight to preview what they offer.
  const [overlay, setOverlay] = useState<Overlay | null>(null)
  const toggleOverlay = (o: Overlay) => setOverlay((v) => (v === o ? null : o))
  const toChat = () => {
    setOverlay(null)
    setTab('chat')
  }
  const adjust = useStore((s) => s.adjust)
  const selectPiece = useStore((s) => s.select)
  const request = (text: string) => {
    toChat()
    void adjust(text)
  }

  const current = currentDesign(state)
  const currentAnalysis = useMemo(() => analyze(current, catalog), [current, catalog])
  const preview = useStore((s) => s.preview)
  const previewFix = useStore((s) => s.previewFix)
  // A preview belongs to the version it was built on and to the open notices: a new version or closing them clears it.
  useEffect(() => previewFix(null), [state.current, overlay, previewFix])
  const shownDesign = preview?.design ?? visibleDesign({ state, viewedVersion, showProposal }) ?? current
  const proposal = preview?.design ?? (viewedVersion === null && state.proposal && showProposal ? state.proposal.design : null)
  const board = useMemo(() => noticeBoard(state, catalog, currentAnalysis), [state, catalog, currentAnalysis])
  const shownAnalysis = useMemo(() => (shownDesign === current ? currentAnalysis : analyze(shownDesign, catalog)), [shownDesign, current, catalog, currentAnalysis])
  const changes = useMemo(() => {
    if (!proposal || !currentAnalysis.valid || !shownAnalysis.valid) return { added: [], changed: [] }
    return differences(current, currentAnalysis.geo.boxes, proposal, shownAnalysis.geo.boxes)
  }, [proposal, current, currentAnalysis, shownAnalysis])

  useEffect(() => {
    const onType = (e: KeyboardEvent) => {
      if (e.key === 'Escape') selectPiece(null)
    }
    window.addEventListener('keydown', onType)
    return () => window.removeEventListener('keydown', onType)
  }, [selectPiece])

  const toConfirm = current.pieces.filter((p) => p.confidence === 'low')
  const select = useStore((s) => s.select)

  const shownGeo = shownAnalysis.geo
  const shownProblems = shownAnalysis.valid ? [] : shownAnalysis.errors
  const problemPieces = [...new Set(shownProblems.flatMap((e) => Object.values(e.data ?? {}).filter((v): v is string => typeof v === 'string' && shownDesign.pieces.some((p) => p.id === v))))]

  const scene = (
    <div className="relative h-full min-h-0 bg-[var(--scene-bg)]">
      {shownGeo ? (
        <div className="h-full" role="img" aria-label={`${shownDesign.name} en 3D: ${shownDesign.dimensions.height} × ${shownDesign.dimensions.width} × ${shownDesign.dimensions.depth} mm, ${shownDesign.pieces.length} piezas. La lista completa está en Materiales.`}>
          <SceneBoundary>
            <Scene design={shownDesign} geo={shownGeo} catalog={catalog} ghosts={changes.added} marked={changes.changed} problems={problemPieces} />
          </SceneBoundary>
        </div>
      ) : (
        <div className="grid h-full place-items-center p-6 text-center text-sm text-rust">Este diseño tiene errores: {shownProblems[0]?.message}</div>
      )}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex flex-col items-start gap-2 md:inset-x-4 md:top-4">
        <SceneBar />
        {proposal && <span className="animate-appear rounded-full bg-amber px-3 py-1 text-xs font-medium text-graphite shadow">{preview ? `Viendo la solución: ${preview.label}` : 'Viendo la propuesta sin aplicar'}</span>}
        {shownGeo && shownProblems.length > 0 && (
          <button
            type="button"
            onClick={() => setOverlay('notices')}
            className="animate-appear pointer-events-auto flex items-center gap-1.5 rounded-full bg-rust px-3 py-1 text-xs font-medium text-white shadow"
          >
            <Warning weight="bold" /> {shownProblems.length === 1 ? 'Un problema sin resolver' : `${shownProblems.length} problemas sin resolver`}
          </button>
        )}
        {toConfirm.length > 0 && viewedVersion === null && !proposal && (
          <button
            type="button"
            onClick={() => select(toConfirm[0].id)}
            className="animate-appear pointer-events-auto flex items-center gap-1.5 rounded-full border border-graphite/30 bg-paper px-3 py-1 text-xs font-medium text-graphite shadow-sm"
          >
            <PencilSimpleLine /> {toConfirm.length === 1 ? `${toConfirm[0].name} por confirmar` : `${toConfirm.length} piezas por confirmar`}
          </button>
        )}
        {viewedVersion !== null && (
          <span className="animate-appear pointer-events-auto flex items-center gap-1 rounded-full bg-graphite py-1 pr-1 pl-3 text-xs font-medium text-bone shadow">
            Viendo v{viewedVersion}
            <button type="button" onClick={() => backToVersion(viewedVersion)} className="flex items-center gap-1 rounded-full bg-bone/15 px-2 py-0.5 hover:bg-bone/25">
              <ArrowCounterClockwise /> Volver a esta
            </button>
            <button type="button" onClick={() => viewVersion(null)} aria-label="Dejar de ver" className="grid size-6 place-items-center rounded-full hover:bg-bone/20">
              <X />
            </button>
          </span>
        )}
      </div>
      {shownGeo && (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 flex justify-end md:top-auto md:right-4 md:bottom-4 md:left-auto">
          <PieceCard design={shownDesign} geo={shownGeo} catalog={catalog} editable={viewedVersion === null && !proposal} />
        </div>
      )}
    </div>
  )

  const overlayPanel = overlay && (
    <section className="flex h-full min-h-0 flex-col bg-bone/60" aria-label={overlay === 'notices' ? 'Avisos' : 'Historial'}>
      <div className="flex min-h-11 items-center gap-2 border-b border-line px-4">
        {overlay === 'notices' ? <Bell className="text-amber" weight="duotone" /> : <ClockCounterClockwise className="text-amber" />}
        <h2 className="flex-1 text-sm font-medium">{overlay === 'notices' ? `Avisos${board.pending.length ? ` · ${board.pending.length} por decidir` : ''}` : 'Historial'}</h2>
        <button type="button" onClick={() => setOverlay(null)} aria-label="Cerrar" className="grid size-9 place-items-center rounded-full text-graphite-2 hover:bg-kraft">
          <X />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{overlay === 'notices' ? <NoticePanel state={state} board={board} onAnswer={toChat} /> : <HistoryPanel state={state} />}</div>
    </section>
  )

  const panel = (
    <>
      {overlayPanel}
      <Tabs.Root value={tab} onValueChange={setTab} className={`h-full min-h-0 flex-col bg-bone/60 ${overlay ? 'hidden' : 'flex'}`}>
        <Tabs.List className="flex items-center gap-0.5 overflow-x-auto border-b border-line px-2 [scrollbar-width:none]" aria-label="Panel">
          {[
            { id: 'chat', name: 'Conversación', icon: <ChatCircleText /> },
            { id: 'furniture', name: 'Mueble', icon: <Armchair /> },
            { id: 'materials', name: 'Materiales', icon: <Stack /> },
          ].map((t) => (
            <Tabs.Trigger
              key={t.id}
              value={t.id}
              className="relative flex min-h-11 items-center gap-1.5 px-2.5 text-sm text-graphite-2 transition data-[state=active]:font-medium data-[state=active]:text-graphite data-[state=active]:after:absolute data-[state=active]:after:inset-x-3 data-[state=active]:after:bottom-0 data-[state=active]:after:h-0.5 data-[state=active]:after:rounded-full data-[state=active]:after:bg-amber"
            >
              <span className="hidden sm:inline-flex">{t.icon}</span>
              {t.name}
              {t.id === 'chat' && state.tray.length > 0 && <span className="numerals grid size-5 place-items-center rounded-full bg-amber text-[10px] text-graphite" title="En la bandeja">{state.tray.length}</span>}
            </Tabs.Trigger>
          ))}
          {!desktop && (
            <button type="button" onClick={() => setTallPanel((v) => !v)} className="ml-auto grid size-9 place-items-center rounded-full text-graphite-2 hover:bg-kraft" aria-label={tallPanel ? 'Agrandar el 3D' : 'Agrandar el panel'}>
              {tallPanel ? <CaretDown /> : <CaretUp />}
            </button>
          )}
        </Tabs.List>
        <Tabs.Content value="chat" className="min-h-0 flex-1">
          <Chat state={state} />
        </Tabs.Content>
        <Tabs.Content value="furniture" className="min-h-0 flex-1 overflow-y-auto">
          <FurniturePanel state={state} geo={currentAnalysis.geo ?? null} />
        </Tabs.Content>
        <Tabs.Content value="materials" className="min-h-0 flex-1 overflow-y-auto">
          {currentAnalysis.valid ? (
            <Materials state={state} design={current} geo={currentAnalysis.geo} catalog={catalog} onRequest={request} />
          ) : (
            <p className="p-4 text-sm text-graphite-2">Primero hay que resolver los problemas del diseño; están en los avisos, en la campana de arriba.</p>
          )}
        </Tabs.Content>
      </Tabs.Root>
    </>
  )

  return (
    <div className="flex h-dvh flex-col">
      <Header state={state} pending={board.pending.length} overlay={overlay} onOpen={toggleOverlay} />
      {desktop ? (
        <div className="grid min-h-0 flex-1 grid-cols-[1fr_minmax(360px,420px)]">
          {scene}
          <aside className="min-h-0 border-l border-line">{panel}</aside>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 transition-[height] duration-300 ease-out" style={{ height: tallPanel ? '30%' : '52%' }}>
            {scene}
          </div>
          <div className="min-h-0 flex-1 border-t border-line">{panel}</div>
        </div>
      )}
    </div>
  )
}
