import * as Dialog from '@radix-ui/react-dialog'
import * as Tabs from '@radix-ui/react-tabs'
import { Armchair, ArrowsOut, Bell, CaretDown, CaretUp, ChatCircleText, ClockCounterClockwise, Cube, DoorOpen, GearSix, GridFour, Plus, Ruler, Stack, Warning, X, type Icon } from '@phosphor-icons/react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { currentDesign, type DesignState } from '../../domain/session/state'
import { activeLabel } from '../../ports/Preferences'
import { Chat } from '../chat/Chat'
import { SceneBoundary } from '../scene/SceneBoundary'
import { Scene } from '../scene/Scene'
import { useServices } from '../services'
import { Button } from '../system/components'
import { Emblem } from '../system/Brand'
import { draftOf, useStore, type SceneMode, type View } from '../store'
import type { CabinetPlan } from '../../domain/furniture/modules/cabinet'
import { CellSheet } from './CellSheet'
import { PartSheet } from './PartSheet'
import { partOfPiece } from '../../domain/furniture/modules/cabinetParts'
import { DraftBar } from './DraftBar'
import { FurniturePanel } from './FurniturePanel'
import { HistoryPanel } from './HistoryPanel'
import { Materials } from './Materials'
import { InvalidCanvas } from './InvalidCanvas'
import { PieceSheet } from './PieceSheet'
import { StatusChip } from './StatusChip'
import { useStatuses } from './statuses'
import { useStudioView } from './view'
import { named } from '../../application/named'
import { currentPlan } from '../../application/useCases'
import { measuresSummary } from '../../domain/furniture/modules/common'
import { moduleOf } from '../../domain/furniture/modules/plan'
import { NoticePanel } from './NoticePanel'
import { ExportFicha } from '../lab/ExportFicha'
import { Findings, findingsCount } from '../lab/Findings'
import { ModelSwitch } from '../lab/ModelSwitch'

const VIEWS: { id: View; name: string }[] = [
  { id: 'front', name: 'Frente' },
  { id: 'side', name: 'Lado' },
  { id: 'three-quarter', name: '3/4' },
  { id: 'top', name: 'Arriba' },
]

const MODES: { id: SceneMode; name: string; Icon: Icon }[] = [
  { id: 'closed', name: 'Cerrado', Icon: Cube },
  { id: 'open', name: 'Abierto', Icon: DoorOpen },
  { id: 'interior', name: 'Interior', Icon: GridFour },
  { id: 'exploded', name: 'Armado', Icon: ArrowsOut },
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

/** Only a cabinet with its plan has cells to edit; another piece of furniture has no interior view. */
function SceneBar({ interior }: { interior: boolean }) {
  const view = useStore((s) => s.view.name)
  const viewFrom = useStore((s) => s.viewFrom)
  const mode = useStore((s) => s.mode)
  const setMode = useStore((s) => s.setMode)
  const dimensions = useStore((s) => s.dimensions)
  const toggleDimensions = useStore((s) => s.toggleDimensions)
  const button = (active: boolean) => `grid min-h-11 min-w-11 place-items-center rounded-full px-2.5 text-xs font-medium transition ${active ? 'bg-graphite text-bone' : 'text-graphite hover:bg-kraft'}`
  return (
    <div className="pointer-events-auto flex max-w-full items-center overflow-x-auto rounded-full border border-line bg-bone/90 p-1 shadow-sm backdrop-blur [scrollbar-width:none]">
      <div className="flex items-center" role="group" aria-label="Vistas">
        {VIEWS.map((v) => (
          <button key={v.id} type="button" className={button(view === v.id)} onClick={() => viewFrom(v.id)} aria-pressed={view === v.id}>
            {v.name}
          </button>
        ))}
      </div>
      <span className="mx-1 h-5 w-px bg-line" aria-hidden />
      <div className="flex items-center" role="group" aria-label="Estado del mueble">
        {MODES.filter(({ id }) => id !== 'interior' || interior).map(({ id, name, Icon }) => (
          <button key={id} type="button" className={`${button(mode === id)} gap-1.5 [grid-auto-flow:column]`} onClick={() => setMode(id)} aria-pressed={mode === id} aria-label={name} title={name}>
            <Icon weight="bold" /> <span className="hidden sm:inline">{name}</span>
          </button>
        ))}
      </div>
      <span className="mx-1 h-5 w-px bg-line" aria-hidden />
      <button type="button" className={`${button(dimensions)} gap-1.5 [grid-auto-flow:column]`} onClick={toggleDimensions} aria-pressed={dimensions} aria-label="Cotas" title="Cotas">
        <Ruler weight="bold" /> <span className="hidden sm:inline">Cotas</span>
      </button>
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
          <Dialog.Description className="text-sm text-graphite">Se borran este diseño, su historial y la conversación. No se puede deshacer.</Dialog.Description>
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
  const debugVisible = useStore((s) => s.debugVisible)
  const sandboxed = useStore((s) => s.sandboxed)
  const { preferences } = useServices()
  const openSettings = useStore((s) => s.openSettings)
  const settingsOpen = useStore((s) => s.settingsOpen)
  const design = currentDesign(state)
  const { plan, diverged } = currentPlan(state)
  const summary = plan && !diverged ? moduleOf(plan).summary(plan, design.dimensions) : measuresSummary(design.dimensions)
  // oxlint-disable-next-line react-hooks/exhaustive-deps -- settingsOpen is the recompute trigger: preferences live in storage, outside React
  const label = useMemo(() => activeLabel(preferences.load()), [preferences, settingsOpen])
  return (
    <header className="flex items-center gap-1 border-b border-line bg-bone/80 px-2 py-2 backdrop-blur sm:gap-3 sm:px-3 md:px-5">
      <Emblem className="size-7 shrink-0 sm:size-8" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-lg leading-tight font-semibold">{design.name}</p>
        <p className="numerals truncate text-xs text-graphite-2">
          {summary}
        </p>
      </div>
      <Button variant="ghost" className={`gap-1 px-2 text-xs ${overlay === 'history' ? 'bg-kraft' : ''}`} onClick={() => onOpen('history')} aria-pressed={overlay === 'history'} aria-label={`Versión ${state.current}: ver el historial`} title="Historial">
        <ClockCounterClockwise /> <span className="numerals">v{state.current}</span>
      </Button>
      <Button variant="ghost" className={`relative px-2 ${overlay === 'notices' ? 'bg-kraft' : ''}`} onClick={() => onOpen('notices')} aria-pressed={overlay === 'notices'} aria-label={pending ? `${pending} ${pending === 1 ? 'aviso' : 'avisos'} por decidir` : 'Avisos'} title="Avisos">
        <Bell weight={pending ? 'fill' : 'regular'} className={pending ? 'text-rust' : ''} />
        {pending > 0 && <span className="numerals absolute -top-0.5 -right-0.5 grid min-w-5 place-items-center rounded-full bg-rust px-1 text-xs text-on-rust">{pending}</span>}
      </Button>
      {debugVisible ? (
        <>
          {sandboxed && <ExportFicha />}
          <ModelSwitch />
        </>
      ) : (
        <Button variant="ghost" className="px-2 text-xs sm:px-3" onClick={() => openSettings(true)} aria-label={`El experto: ${label}`}>
          <GearSix /> <span className="hidden sm:inline">{label}</span>
        </Button>
      )}
      <ConfirmNew>
        <Button variant="ghost" className="px-2 text-xs sm:px-3" aria-label="Nuevo diseño">
          <Plus weight="bold" /> <span className="hidden sm:inline">Nuevo diseño</span>
        </Button>
      </ConfirmNew>
    </header>
  )
}

export function Studio({ state }: { state: DesignState }) {
  const { catalog } = useServices()
  const view = useStudioView(state)
  const { current, currentAnalysis, shown, geo, board, selection } = view
  const backToVersion = useStore((s) => s.backToVersion)
  const adjust = useStore((s) => s.adjust)
  const selectPiece = useStore((s) => s.select)
  const previewFix = useStore((s) => s.previewFix)
  const debugVisible = useStore((s) => s.debugVisible)
  const mode = useStore((s) => s.mode)
  const chosenCell = useStore((s) => s.cell)
  const chosenPart = useStore((s) => s.part)
  const draft = useStore(draftOf)
  const desktop = useDesktop()
  // The plan whose cells the interior view edits: the draft's, or the one applied; none on an old version or when the expert left the plan behind.
  const source = currentPlan(state)
  const editing = draft?.plan ?? source.plan
  const interiorPlan = !source.diverged && view.viewedVersion === null && editing?.kind === 'cabinet' ? (editing as CabinetPlan) : null
  const inside = mode === 'interior' && !!interiorPlan
  const partOpen = !inside && interiorPlan && chosenPart ? chosenPart : null
  const partPieces = partOpen ? shown.pieces.filter((p) => partOfPiece(p) === partOpen.id).map((p) => p.id) : []
  const [tallPanel, setTallPanel] = useState(false)
  const [tab, setTab] = useState('chat')
  const [dismissedResolved, setDismissedResolved] = useState<number | null>(null)
  // Notices, history and the selected piece take the place of the tabs, so the 3D stays in sight (D14).
  const [overlay, setOverlay] = useState<Overlay | null>(null)
  const toggleOverlay = (o: Overlay) => setOverlay((v) => (v === o ? null : o))
  const toChat = () => {
    setOverlay(null)
    setTab('chat')
  }
  const request = (text: string) => {
    toChat()
    void adjust(text)
  }

  // A preview belongs to the version it was built on and to the open notices: a new version or closing them clears it.
  useEffect(() => previewFix(null), [state.current, overlay, previewFix])

  useEffect(() => {
    const onType = (e: KeyboardEvent) => {
      if (e.key === 'Escape') selectPiece(null)
    }
    window.addEventListener('keydown', onType)
    return () => window.removeEventListener('keydown', onType)
  }, [selectPiece])

  const statuses = useStatuses(state, view, {
    chatInSight: tab === 'chat' && !overlay,
    noticesOpen: overlay === 'notices',
    dismissedResolved,
    onDismissResolved: () => setDismissedResolved(state.current),
    onNotices: () => setOverlay('notices'),
    onProposal: toChat,
  })

  const scene = (
    <div className="relative h-full min-h-0 bg-[var(--scene-bg)]">
      {geo ? (
        <div className="h-full" role="img" aria-label={`${shown.name} en 3D: ${shown.dimensions.height} × ${shown.dimensions.width} × ${shown.dimensions.depth} mm, ${shown.pieces.length} piezas. La lista completa está en Materiales.`}>
          <SceneBoundary>
            <Scene design={shown} geo={geo} catalog={catalog} ghosts={inside ? [] : view.changes.added} marked={inside ? [] : partOpen ? partPieces : view.changes.changed} problems={view.marked} cabinet={interiorPlan} />
          </SceneBoundary>
        </div>
      ) : (
        <InvalidCanvas
          detail={named(shown, view.problems[0]?.message)}
          previous={view.previousVersion}
          onBack={() => view.previousVersion !== null && backToVersion(view.previousVersion)}
          onNotices={() => setOverlay('notices')}
        />
      )}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex flex-col items-start gap-2 md:inset-x-4 md:top-4">
        {geo && <SceneBar interior={!!interiorPlan} />}
        {!inside && !partOpen && <StatusChip statuses={statuses} />}
      </div>
      {(inside || partOpen) && source.plan && (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 flex justify-center md:inset-x-4 md:bottom-4">
          <DraftBar applied={source.plan} />
        </div>
      )}
    </div>
  )

  const overlayPanel = overlay && (
    <section className="flex h-full min-h-0 flex-col bg-bone/60" aria-label={overlay === 'notices' ? 'Avisos' : 'Historial'}>
      <div className="flex min-h-11 items-center gap-2 border-b border-line px-4">
        {overlay === 'notices' ? <Bell className="text-graphite" weight="duotone" /> : <ClockCounterClockwise className="text-graphite" />}
        <h2 className="flex-1 text-sm font-medium">{overlay === 'notices' ? `Avisos${board.pending.length ? ` · ${board.pending.length} por decidir` : ''}` : 'Historial'}</h2>
        <button type="button" onClick={() => setOverlay(null)} aria-label="Cerrar" className="relative grid size-9 place-items-center rounded-full text-graphite-2 before:absolute before:-inset-1 before:content-[''] hover:bg-kraft">
          <X />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{overlay === 'notices' ? <NoticePanel key={state.current} state={state} board={board} onAnswer={toChat} /> : <HistoryPanel state={state} />}</div>
    </section>
  )

  const panel = (
    <>
      {inside && chosenCell && geo && <CellSheet plan={interiorPlan} path={chosenCell} geo={geo} />}
      {partOpen && interiorPlan && <PartSheet key={partOpen.id} plan={interiorPlan} design={current} part={partOpen} />}
      {!inside && !partOpen && view.showsPiece && geo && <PieceSheet key={selection} design={shown} geo={geo} catalog={catalog} editable={view.editable} />}
      <div className={`h-full min-h-0 ${(inside && chosenCell) || partOpen || (!inside && view.showsPiece) ? 'hidden' : ''}`}>
        {overlayPanel}
        <Tabs.Root value={tab} onValueChange={setTab} className={`h-full min-h-0 flex-col bg-bone/60 ${overlay ? 'hidden' : 'flex'}`}>
          <Tabs.List className={`flex items-center gap-0.5 overflow-x-auto border-b border-line px-2 [scrollbar-width:none] `} aria-label="Panel">
            {[
              { id: 'chat', name: 'Conversación', icon: <ChatCircleText /> },
              { id: 'furniture', name: 'Mueble', icon: <Armchair /> },
              { id: 'materials', name: 'Materiales', icon: <Stack /> },
              ...(debugVisible ? [{ id: 'findings', name: 'Hallazgos', icon: <Warning /> }] : []),
            ].map((t) => (
              <Tabs.Trigger
                key={t.id}
                value={t.id}
                className="relative flex min-h-11 items-center gap-1.5 px-2.5 text-sm text-graphite-2 transition data-[state=active]:font-medium data-[state=active]:text-graphite data-[state=active]:after:absolute data-[state=active]:after:inset-x-3 data-[state=active]:after:bottom-0 data-[state=active]:after:h-0.5 data-[state=active]:after:rounded-full data-[state=active]:after:bg-amber"
              >
                <span className="hidden sm:inline-flex">{t.icon}</span>
                {t.name}
                {t.id === 'findings' && findingsCount(currentAnalysis) > 0 && <span className="numerals font-mono text-xs text-graphite-2">{findingsCount(currentAnalysis)}</span>}
                {t.id === 'chat' && state.tray.length > 0 && <span className="numerals grid size-5 place-items-center rounded-full bg-graphite text-xs text-bone" title="En la bandeja">{state.tray.length}</span>}
              </Tabs.Trigger>
            ))}
            {!desktop && (
              <button type="button" onClick={() => setTallPanel((v) => !v)} className="relative ml-auto grid size-9 place-items-center rounded-full text-graphite-2 before:absolute before:-inset-1 before:content-[''] hover:bg-kraft" aria-label={tallPanel ? 'Agrandar el 3D' : 'Agrandar el panel'}>
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
              <div className="flex flex-col items-start gap-3 p-4">
                <p className="text-sm text-graphite">Primero hay que resolver los problemas del diseño; están en los avisos, en la campana de arriba.</p>
                <Button className="min-h-11" onClick={() => setOverlay('notices')}>
                  Ver los avisos
                </Button>
              </div>
            )}
          </Tabs.Content>
          {debugVisible && (
            <Tabs.Content value="findings" className="min-h-0 flex-1 overflow-y-auto">
              <Findings design={current} analysis={currentAnalysis} />
            </Tabs.Content>
          )}
        </Tabs.Root>
      </div>
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
          <div className="min-h-0" style={{ height: tallPanel ? '30%' : '52%' }}>
            {scene}
          </div>
          <div className="min-h-0 flex-1 border-t border-line">{panel}</div>
        </div>
      )}
    </div>
  )
}
