import * as Dialog from '@radix-ui/react-dialog'
import * as Tabs from '@radix-ui/react-tabs'
import { Armchair, ArrowCounterClockwise, ArrowsIn, PencilSimpleLine, ArrowsOut, Bell, CaretDown, CaretUp, ChatCircleText, CheckCircle, Crosshair, ClockCounterClockwise, Eye, EyeSlash, Flask, GearSix, Plus, Ruler, SignOut, Stack, Warning, X } from '@phosphor-icons/react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { analyze } from '../../domain/checks/analysis'
import { differences } from '../../domain/design/diff'
import { currentDesign, type DesignState } from '../../domain/session/state'
import { activeLabel } from '../../ports/Preferences'
import { Chat, STAGES } from '../chat/Chat'
import { SceneBoundary } from '../scene/SceneBoundary'
import { Scene } from '../scene/Scene'
import { useServices } from '../services'
import { Button, Pencil } from '../system/components'
import { Emblem } from '../system/Brand'
import { hiddenIn, visibleDesign, useStore, type View } from '../store'
import { FurniturePanel } from './FurniturePanel'
import { HistoryPanel } from './HistoryPanel'
import { Materials } from './Materials'
import { InvalidCanvas } from './InvalidCanvas'
import { previousUsableVersion } from '../../domain/session/history/history'
import { PieceSheet } from './PieceSheet'
import { StatusChip, type Status } from './StatusChip'
import { resolvedChipLabel, resolvedVisible } from './chipLabels'
import { named } from '../../application/named'
import { noticeBoard } from '../../application/notices'
import { currentPlan } from '../../application/useCases'
import { measuresSummary } from '../../domain/furniture/modules/common'
import { moduleOf } from '../../domain/furniture/modules/plan'
import { NoticePanel } from './NoticePanel'
import { Drawer } from '../lab/Drawer'
import { Findings, findingsCount } from '../lab/Findings'
import type { Workshop } from '../lab/workshop'

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
  const button = (active: boolean) => `grid min-h-11 min-w-11 place-items-center rounded-full px-2.5 text-xs font-medium transition ${active ? 'bg-graphite text-bone' : 'text-graphite hover:bg-kraft'}`
  return (
    <div className="pointer-events-auto flex items-center rounded-full border border-line bg-bone/90 p-1 shadow-sm backdrop-blur">
      <div className="flex items-center" role="group" aria-label="Vistas">
        {VIEWS.map((v) => (
          <button key={v.id} type="button" className={button(view === v.id)} onClick={() => viewFrom(v.id)} aria-pressed={view === v.id}>
            {v.name}
          </button>
        ))}
      </div>
      <span className="mx-1 h-5 w-px bg-line" aria-hidden />
      <button type="button" className={`${button(exploded)} gap-1.5 [grid-auto-flow:column]`} onClick={toggleExploded} aria-pressed={exploded}>
        {exploded ? <ArrowsIn weight="bold" /> : <ArrowsOut weight="bold" />} Armado
      </button>
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

function Header({ state, pending, overlay, onOpen, workshop }: { state: DesignState; pending: number; overlay: Overlay | null; onOpen: (o: Overlay) => void; workshop?: Workshop }) {
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
      {workshop ? (
        <>
          {workshop.actions}
          {workshop.expert}
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
      {workshop && (
        <Button variant="ghost" className="px-2 text-xs sm:px-3" onClick={workshop.onExit} aria-label="Salir del taller">
          <SignOut /> <span className="hidden sm:inline">Salir del taller</span>
        </Button>
      )}
    </header>
  )
}

export function Studio({ state, workshop }: { state: DesignState; workshop?: Workshop }) {
  const { catalog } = useServices()
  const showProposal = useStore((s) => s.showProposal)
  const viewedVersion = useStore((s) => s.viewedVersion)
  const viewVersion = useStore((s) => s.viewVersion)
  const backToVersion = useStore((s) => s.backToVersion)
  const desktop = useDesktop()
  const [tallPanel, setTallPanel] = useState(false)
  const [tab, setTab] = useState('chat')
  const [benchOpen, setBenchOpen] = useState(true)
  const [panelOpen, setPanelOpen] = useState(true)
  const [dismissedResolved, setDismissedResolved] = useState<number | null>(null)
  // Notices, history and the selected piece take the place of the tabs, so the 3D stays in sight (D14).
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
  const previousVersion = shownGeo ? null : previousUsableVersion(state.versions, state.current, (v) => analyze(v.design, catalog).valid)
  const shownProblems = shownAnalysis.valid ? [] : shownAnalysis.errors
  const problemPieces = [...new Set(shownProblems.flatMap((e) => Object.values(e.data ?? {}).filter((v): v is string => typeof v === 'string' && shownDesign.pieces.some((p) => p.id === v))))]
  const flagged = useStore((s) => s.flagged)
  const markedPieces = [...new Set([...problemPieces, ...flagged.filter((id) => shownDesign.pieces.some((p) => p.id === id))])]
  const selection = useStore((s) => s.selection)
  const showsPiece = !!shownGeo && shownDesign.pieces.some((p) => p.id === selection)
  const editable = viewedVersion === null && !proposal
  const thinking = useStore((s) => s.thinking)
  const stage = useStore((s) => s.stage)
  const cancel = useStore((s) => s.cancel)
  const hidden = hiddenIn(useStore((s) => s.hidden), shownDesign)
  const showAll = useStore((s) => s.showAll)
  const focusedId = useStore((s) => s.focus)
  const unfocus = useStore((s) => s.unfocus)
  const focusedPiece = focusedId && focusedId === selection ? shownDesign.pieces.find((p) => p.id === focusedId) : undefined

  // What changes what you are looking at comes first: an old version, the expert at work, a proposal or preview; then problems, pieces to confirm, what the last change resolved.
  const statuses: Status[] = [
    ...(viewedVersion !== null
      ? [
          {
            key: 'version',
            icon: <ClockCounterClockwise />,
            label: `Viendo v${viewedVersion}`,
            actions: (
              <>
                <button type="button" onClick={() => backToVersion(viewedVersion)} className="relative flex min-h-7 items-center gap-1 rounded-full bg-kraft px-2 before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] hover:bg-kraft-2">
                  <ArrowCounterClockwise /> Volver a esta
                </button>
                <button type="button" onClick={() => viewVersion(null)} aria-label="Dejar de ver" className="relative grid size-7 place-items-center rounded-full before:absolute before:-inset-2 before:content-[''] hover:bg-kraft">
                  <X />
                </button>
              </>
            ),
          },
        ]
      : []),
    ...(thinking && (tab !== 'chat' || overlay)
      ? [
          {
            key: 'thinking',
            icon: <Pencil className="h-3 w-8 text-amber" />,
            label: stage ? STAGES[stage.name] : 'Pensando…',
            actions: (
              <button type="button" onClick={cancel} aria-label="Cancelar" className="relative grid size-7 place-items-center rounded-full before:absolute before:-inset-2 before:content-[''] hover:bg-kraft">
                <X />
              </button>
            ),
          },
        ]
      : []),
    ...(focusedPiece
      ? [
          {
            key: 'focus',
            icon: <Crosshair />,
            label: `Enfocada: ${focusedPiece.name}`,
            actions: (
              <button type="button" onClick={unfocus} className="-my-1 flex min-h-11 items-center gap-1 rounded-full bg-kraft px-3 hover:bg-kraft-2">
                <ArrowsOut /> Ver todo el mueble
              </button>
            ),
          },
        ]
      : []),
    // Hidden pieces change what you see as much as a proposal does, and the way back has to stay in sight.
    ...(hidden.length > 0
      ? [
          {
            key: 'hidden',
            icon: <EyeSlash />,
            label: hidden.length === 1 ? '1 pieza oculta' : `${hidden.length} piezas ocultas`,
            actions: (
              <button type="button" onClick={showAll} className="-my-1 flex min-h-11 items-center gap-1 rounded-full bg-kraft px-3 hover:bg-kraft-2">
                <Eye /> Mostrar todo
              </button>
            ),
          },
        ]
      : []),
    ...(proposal
      ? [
          {
            key: 'proposal',
            icon: <Eye weight="bold" />,
            label: preview ? `Viendo la solución: ${preview.label}` : 'Viendo la propuesta sin aplicar',
            actions: preview ? undefined : (
              <button type="button" onClick={toChat} className="-my-1 flex min-h-11 items-center rounded-full bg-kraft px-3 hover:bg-kraft-2 focus-visible:outline-2 focus-visible:outline-amber">
                Ver propuesta
              </button>
            ),
          },
        ]
      : []),
    ...(shownGeo && shownProblems.length > 0
      ? [{ key: 'problems', icon: <Warning weight="bold" className="text-rust" />, label: shownProblems.length === 1 ? 'Un problema sin resolver' : `${shownProblems.length} problemas sin resolver`, onClick: () => setOverlay('notices') }]
      : []),
    ...(toConfirm.length > 0 && viewedVersion === null && !proposal
      ? [{ key: 'confirm', icon: <PencilSimpleLine />, label: toConfirm.length === 1 ? `${toConfirm[0].name} por confirmar` : `${toConfirm.length} piezas por confirmar`, onClick: () => select(toConfirm[0].id) }]
      : []),
    ...(resolvedVisible(board.resolved, dismissedResolved, state.current) && overlay !== 'notices'
      ? [
          {
            key: 'resolved',
            icon: <CheckCircle weight="fill" className="text-slate" />,
            label: resolvedChipLabel(board.resolved[0]),
            actions: (
              <button type="button" onClick={() => setDismissedResolved(state.current)} aria-label="Cerrar" className="relative grid size-7 place-items-center rounded-full before:absolute before:-inset-2 before:content-[''] hover:bg-kraft">
                <X />
              </button>
            ),
          },
        ]
      : []),
    // Last, because the chip shows only the first status: what changes what you see must not hide behind the workshop's reminder.
    ...(workshop ? [{ key: 'workshop', icon: <Flask />, label: 'Taller: nada de esto se guarda' }] : []),
  ]

  const scene = (
    <div className="relative h-full min-h-0 bg-[var(--scene-bg)]">
      {shownGeo ? (
        <div className="h-full" role="img" aria-label={`${shownDesign.name} en 3D: ${shownDesign.dimensions.height} × ${shownDesign.dimensions.width} × ${shownDesign.dimensions.depth} mm, ${shownDesign.pieces.length} piezas. La lista completa está en Materiales.`}>
          <SceneBoundary>
            <Scene design={shownDesign} geo={shownGeo} catalog={catalog} ghosts={changes.added} marked={changes.changed} problems={markedPieces} />
          </SceneBoundary>
        </div>
      ) : (
        <InvalidCanvas
          detail={named(shownDesign, shownProblems[0]?.message)}
          previous={previousVersion}
          onBack={() => previousVersion !== null && backToVersion(previousVersion)}
          onNotices={() => setOverlay('notices')}
        />
      )}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex flex-col items-start gap-2 md:inset-x-4 md:top-4">
        {shownGeo && <SceneBar />}
        <StatusChip statuses={statuses} />
      </div>
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
      {showsPiece && shownGeo && <PieceSheet key={selection} design={shownDesign} geo={shownGeo} catalog={catalog} editable={editable} />}
      <div className={`h-full min-h-0 ${showsPiece ? 'hidden' : ''}`}>
        {overlayPanel}
        <Tabs.Root value={tab} onValueChange={setTab} className={`h-full min-h-0 flex-col bg-bone/60 ${overlay ? 'hidden' : 'flex'}`}>
          <Tabs.List className={`flex items-center gap-0.5 overflow-x-auto border-b border-line px-2 [scrollbar-width:none] ${workshop && desktop ? 'pr-14' : ''}`} aria-label="Panel">
            {[
              { id: 'chat', name: 'Conversación', icon: <ChatCircleText /> },
              { id: 'furniture', name: 'Mueble', icon: <Armchair /> },
              { id: 'materials', name: 'Materiales', icon: <Stack /> },
              ...(workshop ? [{ id: 'findings', name: 'Hallazgos', icon: <Warning /> }] : []),
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
          {workshop && (
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
      <Header state={state} pending={board.pending.length} overlay={overlay} onOpen={toggleOverlay} workshop={workshop} />
      {desktop && workshop ? (
        <div className="flex min-h-0 flex-1">
          <Drawer side="left" open={benchOpen} onToggle={() => setBenchOpen((v) => !v)} label="el banco" width="w-[380px]" rail={workshop.benchRail}>
            {workshop.bench}
          </Drawer>
          <div className="min-w-0 flex-1">{scene}</div>
          <Drawer
            side="right"
            open={panelOpen}
            onToggle={() => setPanelOpen((v) => !v)}
            label="el panel"
            width="w-[420px]"
            rail={
              <>
                <Warning />
                <span className="numerals font-mono text-[11px] text-graphite-2">{findingsCount(currentAnalysis)}</span>
              </>
            }
          >
            {panel}
          </Drawer>
        </div>
      ) : desktop ? (
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
