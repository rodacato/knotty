import * as Dialog from '@radix-ui/react-dialog'
import { ArrowLeft, ArrowRight, ArrowCounterClockwise, ArrowClockwise, CaretDown, CaretUp, Check, Copy, Cube, House, Plus, SquaresFour, Trash, Warning, X } from '@phosphor-icons/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { currentDesign } from '../../domain/session/state'
import { resolveGeometry } from '../../domain/design/resolve'
import { useServices } from '../services'
import { useStore } from '../store'
import { Button } from '../system/components'
import { SceneBoundary } from '../scene/SceneBoundary'
import { useMediaQuery } from '../scene/preferences'
import { cardsOf } from '../capture/cards'
import { Thumbnail } from '../capture/Thumbnail'
import { ANY, matches, ROOM_LABELS, sizeLine } from '../capture/catalog'
import { LOSS_NOTE, lossOf, type SwapLoss } from '../spotlight/swap'
import { DownloadFirst } from '../files/DownloadFirst'
import { issues, nameOf, openingProblem, sizeOf, type Item } from './layout'
import { useRoom } from './store'
import { baseSource, companions } from './sources'
import { PlacementForm, SpaceEditor } from './RoomForms'
import { RoomPlan } from './RoomPlan'
import { RoomScene } from './RoomScene'

const tab = (active: boolean) =>
  `flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full px-2 text-sm ${active ? 'bg-graphite text-bone' : 'text-graphite-2 hover:bg-kraft'}`

function Combination({ onReplace, replacing }: { onReplace: () => void; replacing: string | null }) {
  const { references, catalog } = useServices()
  const layout = useRoom((s) => s.layout)!
  const [query, setQuery] = useState(''),
    [all, setAll] = useState(false),
    [room, setRoom] = useState(ANY.room),
    [limit, setLimit] = useState(12)
  const bases = useMemo(() => references.home(), [references])
  const anchor = layout.items.find((i) => i.id === layout.anchorId && i.kind === 'furniture') ?? layout.items.find((i) => i.kind === 'furniture')
  const candidates = useMemo(
    () => (all || query || replacing ? bases.filter((b) => matches(b, { text: query, room })) : anchor?.kind === 'furniture' ? companions(bases, anchor.source).slice(0, 4) : bases.slice(0, 4)),
    [all, query, replacing, bases, room, anchor],
  )
  const cards = useMemo(() => cardsOf(candidates.slice(0, limit), catalog), [candidates, limit, catalog])
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-xl font-semibold">{replacing ? 'Prueba otra ficha aquí' : all || query ? 'Elige un compañero' : 'Combínalo con…'}</h2>
        <p className="hidden text-sm text-graphite-2 md:block">
          {replacing ? 'Conservamos el centro y el giro; revisa si sus nuevas medidas caben.' : 'Agrega una ficha y descubre cómo se ve junto a las demás.'}
        </p>
      </div>
      <label className={`${all || replacing || query ? 'flex' : 'hidden md:flex'} flex-col gap-1 text-xs text-graphite-2`}>
        Buscar fichas
        <input
          className="min-h-11 min-w-0 rounded-xl border border-line bg-bone px-3 text-base"
          value={query}
          placeholder="Nombre, cuarto, estilo o modelo"
          onChange={(e) => {
            setQuery(e.target.value)
            setLimit(12)
          }}
        />
      </label>
      {(all || replacing) && (
        <label className="flex flex-col gap-1 text-xs text-graphite-2">
          Cuarto
          <select
            className="min-h-11 rounded-xl border border-line bg-bone px-3 text-base"
            value={room}
            onChange={(e) => {
              setRoom(e.target.value as typeof room)
              setLimit(12)
            }}
          >
            <option value="all">Todas las fichas</option>
            {ROOM_LABELS.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
      )}
      {replacing && (
        <Button variant="ghost" className="min-h-11" onClick={onReplace}>
          Cancelar cambio de ficha
        </Button>
      )}
      <div className="flex flex-col gap-2">
        {cards.map(({ base, size, boxes }) => (
          <button
            key={base.code}
            type="button"
            className="flex min-h-20 items-center gap-3 rounded-xl border border-line bg-bone p-3 text-left hover:bg-kraft"
            aria-label={`${replacing ? 'Probar' : 'Agregar'} ${base.name}, ${base.code}`}
            onClick={() => {
              const source = baseSource(base, catalog)
              if (replacing) {
                useRoom.getState().replace(replacing, source)
                onReplace()
                useRoom.getState().setPanel('item')
              } else useRoom.getState().add(source)
            }}
          >
            <span className="drawing-surface grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg p-1">{boxes ? <Thumbnail boxes={boxes} /> : <Cube />}</span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-sm font-medium">{base.name}</span>
              <span className="numerals text-xs text-graphite-2">{size.text}</span>
              <span className="font-mono text-xs text-graphite-2">
                {base.code} v{base.version}
              </span>
            </span>
            <Plus className="shrink-0" aria-hidden />
          </button>
        ))}
      </div>
      {!cards.length && (
        <p role="status" className="text-sm text-graphite-2">
          No encontramos fichas con esa búsqueda. Prueba otro nombre o elige otro cuarto.
        </p>
      )}
      {!all && !replacing && (
        <Button variant="ghost" className="min-h-11 justify-center border border-line" onClick={() => setAll(true)}>
          Ver todas las fichas
        </Button>
      )}
      {candidates.length > limit && (
        <Button variant="ghost" className="min-h-11" onClick={() => setLimit((n) => n + 12)}>
          Ver más fichas
        </Button>
      )}
    </div>
  )
}

function ItemEditor({ item, onReplace }: { item: Item; onReplace: () => void }) {
  const { catalog } = useServices()
  const layout = useRoom((s) => s.layout)!
  const itemIssues = issues(layout).filter((i) => i.item === item.id)
  const design = item.kind === 'furniture' ? item.source.design : null
  const result = useMemo(() => (design ? resolveGeometry(design, catalog) : null), [design, catalog])
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-xl font-semibold">{nameOf(item)}</h2>
        <p className="numerals text-sm text-graphite-2">{sizeLine(sizeOf(item)).text}</p>
        <p className="font-mono text-xs text-graphite-2">
          {item.kind === 'furniture' ? (item.source.code ? `${item.source.code} v${item.source.version}` : 'Tu diseño del Studio') : 'Bloque de espacio ocupado'}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" className="min-h-11 border border-line" onClick={() => useRoom.getState().turn(item.id)}>
          <ArrowClockwise /> Girar 90°
        </Button>
        <Button variant="ghost" className="min-h-11 border border-line" onClick={() => useRoom.getState().duplicate(item.id)}>
          <Copy /> Duplicar
        </Button>
        <Button variant="ghost" className="min-h-11 border border-line" onClick={() => useRoom.getState().remove(item.id)}>
          <Trash /> Quitar
        </Button>
      </div>
      {itemIssues.length > 0 && (
        <div role="status" className="flex flex-col gap-1 rounded-xl border border-rust/50 p-3 text-sm">
          <p className="flex items-center gap-2 font-medium text-rust">
            <Warning /> Revisa su colocación
          </p>
          {itemIssues.map((i, n) => (
            <p key={n}>{i.message}</p>
          ))}
        </div>
      )}
      {result && !result.ok && (
        <p role="alert" className="text-sm text-rust">
          No se pudo dibujar esta ficha: {result.errors[0]?.message}. Su espacio sigue visible en el plano.
        </p>
      )}
      <PlacementForm key={`${item.id}:${item.x}:${item.z}:${item.elevation}:${item.turn}`} item={item} />
      {item.kind === 'furniture' && (
        <Button variant="ghost" className="min-h-11 justify-center border border-line" onClick={onReplace}>
          Probar otra ficha aquí
        </Button>
      )}
      <p className="text-xs text-graphite-2">Las medidas y la construcción del mueble se ajustan en el Studio.</p>
    </div>
  )
}

export function Room() {
  const panelBody = useRef<HTMLDivElement>(null)
  const open = useStore((s) => s.roomOpen),
    setOpen = useStore((s) => s.setRoomOpen)
  const { layout, selected, panel, view, past, future } = useRoom()
  const narrow = useMediaQuery('(max-width: 767px)')
  const [collapsed, setCollapsed] = useState(view === 'plan')
  const compact = narrow && collapsed
  const tight = narrow && !collapsed && view === 'plan'
  const [replacing, setReplacing] = useState<string | null>(null),
    [confirming, setConfirming] = useState<SwapLoss | null>(null)
  const selectedItem = layout?.items.find((i) => i.id === selected)
  const found = useMemo(() => (layout ? issues(layout) : []), [layout])
  const bad = useMemo(() => new Set(found.map((i) => i.item)), [found])
  const openingErrors =
    layout?.openings.flatMap((o) => {
      const problem = openingProblem(layout.room, o, layout.openings)
      return problem ? [problem] : []
    }) ?? []
  const current = useStore((s) => s.state)
  const isCurrent = selectedItem?.kind === 'furniture' && !!current && selectedItem.source.design === currentDesign(current)
  const editedItem = panel === 'item' ? selected : null
  useEffect(() => {
    if (panelBody.current) panelBody.current.scrollTop = 0
  }, [panel, editedItem, replacing])
  useEffect(() => {
    if (open && !layout) setOpen(false)
  }, [open, layout, setOpen])
  useEffect(() => {
    if (!open) return
    const keys = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        e.stopImmediatePropagation()
        return
      }
      if ((e.target as HTMLElement).closest('input,select,textarea,[contenteditable]')) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        e.stopImmediatePropagation()
        if (e.shiftKey) useRoom.getState().redo()
        else useRoom.getState().undo()
      }
    }
    window.addEventListener('keydown', keys, true)
    return () => window.removeEventListener('keydown', keys, true)
  }, [open])
  if (!layout) return null
  const build = () => {
    if (selectedItem?.kind !== 'furniture') return
    const s = useStore.getState()
    useRoom.getState().edit(selectedItem.id)
    if (isCurrent) s.resumeDesign()
    else if (selectedItem.source.example) s.fromExample(selectedItem.source.example)
    setConfirming(null)
    setOpen(false)
  }
  const requestBuild = () => {
    const s = useStore.getState(),
      loss = isCurrent ? null : lossOf(s)
    if (loss) setConfirming(loss)
    else build()
  }
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-bone" />
        <Dialog.Content
          aria-describedby="room-description"
          onCloseAutoFocus={(e) => {
            e.preventDefault()
            useRoom.getState().returnFocus?.focus()
          }}
          className="fixed inset-0 z-40 flex h-dvh min-h-0 flex-col bg-bone text-graphite outline-none"
          data-room
        >
          <header className="flex shrink-0 items-center gap-3 border-b border-line px-3 py-2 md:px-6 md:py-3">
            <Dialog.Close asChild>
              <Button variant="ghost" className="min-h-11 px-2" aria-label="Volver al mueble">
                <ArrowLeft />
                <span className="hidden sm:inline">Volver al mueble</span>
              </Button>
            </Dialog.Close>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="font-display text-xl font-semibold md:text-2xl">
                Tu espacio<span className="hidden min-[380px]:inline"> con Knotty</span>
              </Dialog.Title>
              <Dialog.Description id="room-description" className="text-xs text-graphite-2 md:text-sm">
                Prueba combinaciones antes de construir. Este espacio dura hasta recargar la página.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" className="min-h-11 min-w-11 px-2" aria-label="Cerrar el espacio">
                <X />
              </Button>
            </Dialog.Close>
          </header>
          <div className="flex min-h-0 flex-1 flex-col md:grid md:grid-cols-[minmax(0,1fr)_360px]">
            <section className="relative min-h-0 flex-1 bg-kraft" aria-label="Vista del cuarto" data-room-canvas>
              {view === 'plan' ? (
                <RoomPlan layout={layout} bad={bad} below={!tight ? 'chips' : bad.size || openingErrors.length ? 'warning' : 'nothing'} />
              ) : (
                <SceneBoundary
                  fallback={
                    <div className="grid h-full place-items-center p-6 text-center">
                      <div className="flex max-w-xs flex-col gap-3">
                        <p>No se pudo mostrar el cuarto en 3D.</p>
                        <Button variant="ghost" className="min-h-11 justify-center border border-line" onClick={() => useRoom.getState().setView('plan')}>
                          Usar el plano 2D
                        </Button>
                      </div>
                    </div>
                  }
                >
                  <RoomScene layout={layout} bad={bad} />
                </SceneBoundary>
              )}
              <div className="absolute inset-x-3 top-3 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 md:inset-x-5 md:top-5 md:flex md:justify-between">
                <div className="contents md:flex md:flex-col md:items-start md:gap-2">
                  <div className="col-span-2 flex w-fit rounded-full border border-line bg-bone/95 p-1" role="group" aria-label="Vista del espacio">
                    <button
                      type="button"
                      className={tab(view === 'scene')}
                      aria-pressed={view === 'scene'}
                      onClick={() => {
                        useRoom.getState().setView('scene')
                        setCollapsed(false)
                      }}
                    >
                      <Cube /> Ver en 3D
                    </button>
                    <button
                      type="button"
                      className={tab(view === 'plan')}
                      aria-pressed={view === 'plan'}
                      onClick={() => {
                        useRoom.getState().setView('plan')
                        setCollapsed(true)
                      }}
                    >
                      <SquaresFour /> Acomodar
                    </button>
                  </div>
                  <span className="numerals col-start-1 row-start-2 w-fit rounded-xl bg-bone/95 px-3 py-1 text-xs text-graphite-2">
                    {layout.room.width / 10} × {layout.room.depth / 10} cm<span className="sm:hidden"> · ejemplo</span>
                    <span className="hidden sm:inline"> · espacio de prueba</span>
                    {view === 'plan' && <span className="block">Arrastra un mueble. La línea gruesa es su frente.</span>}
                  </span>
                </div>
                <div className="col-start-2 row-start-2 flex rounded-full border border-line bg-bone/95 p-1">
                  <Button variant="ghost" className="min-h-11 min-w-11 rounded-full px-2" disabled={!past.length} aria-label="Deshacer en el espacio" onClick={() => useRoom.getState().undo()}>
                    <ArrowCounterClockwise />
                  </Button>
                  <Button variant="ghost" className="min-h-11 min-w-11 rounded-full px-2" disabled={!future.length} aria-label="Rehacer en el espacio" onClick={() => useRoom.getState().redo()}>
                    <ArrowClockwise />
                  </Button>
                </div>
              </div>
              <div className="absolute inset-x-3 bottom-3 flex flex-col gap-2 md:inset-x-5 md:bottom-5">
                {(bad.size > 0 || openingErrors.length > 0) && (
                  <button
                    type="button"
                    data-room-warning
                    className="flex min-h-11 w-fit items-center gap-2 rounded-full border border-rust/50 bg-bone/95 px-3 text-sm text-rust"
                    onClick={() => {
                      if (found[0]) useRoom.getState().select(found[0].item)
                      else useRoom.getState().setPanel('space')
                    }}
                  >
                    <Warning /> {bad.size + openingErrors.length} {bad.size + openingErrors.length === 1 ? 'elemento por revisar' : 'elementos por revisar'}
                  </button>
                )}
                <div className={`${tight ? 'hidden' : 'flex'} gap-2 overflow-x-auto pb-1`} aria-label="Tu combinación">
                  {layout.items.map((i, index) => (
                    <button
                      key={i.id}
                      type="button"
                      className={`flex min-h-11 shrink-0 items-center gap-2 rounded-full border bg-bone/95 px-3 text-xs ${i.id === selected ? 'border-amber text-graphite' : 'border-line text-graphite-2'}`}
                      aria-pressed={i.id === selected}
                      onClick={() => {
                        useRoom.getState().select(i.id)
                        setCollapsed(false)
                      }}
                    >
                      <span className="numerals">{index + 1}</span>
                      {i.id === selected && <Check aria-hidden />}
                      {nameOf(i)}
                      {bad.has(i.id) && <Warning aria-label="Revisar colocación" />}
                    </button>
                  ))}
                </div>
              </div>
            </section>
            <aside className={`flex ${compact ? '' : tight ? 'h-[32dvh]' : 'h-[38dvh]'} min-h-0 shrink-0 flex-col border-t border-line bg-bone md:h-auto md:border-t-0 md:border-l`} aria-label="Explorar muebles y espacio">
              <nav className="flex shrink-0 gap-1 border-b border-line p-2" aria-label="Herramientas del espacio">
                {(
                  [
                    ['combine', 'Combinar', Plus],
                    ['item', 'Mueble', Cube],
                    ['space', 'Mi espacio', House],
                  ] as const
                ).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    type="button"
                    className={tab(panel === id)}
                    aria-pressed={panel === id}
                    aria-expanded={panel === id && !compact}
                    aria-controls="room-panel room-actions"
                    onClick={() => {
                      setCollapsed(narrow && panel === id ? !collapsed : false)
                      useRoom.getState().setPanel(id)
                    }}
                  >
                    <Icon className="max-[359px]:hidden" />
                    {label}
                    {narrow && panel === id && (compact ? <CaretUp aria-hidden /> : <CaretDown aria-hidden />)}
                  </button>
                ))}
              </nav>
              <div id="room-panel" ref={panelBody} hidden={compact} className="min-h-0 flex-1 overflow-y-auto p-4 md:p-5">
                {panel === 'combine' && <Combination replacing={replacing} onReplace={() => setReplacing(null)} />}
                {panel === 'item' &&
                  (selectedItem ? (
                    <ItemEditor
                      item={selectedItem}
                      onReplace={() => {
                        setReplacing(selectedItem.id)
                        useRoom.getState().setPanel('combine')
                      }}
                    />
                  ) : (
                    <p className="text-sm text-graphite-2">Elige un mueble en la vista o agrega una ficha para probarla.</p>
                  ))}
                {panel === 'space' && (
                  <>
                    <SpaceEditor layout={layout} />
                    {openingErrors.length > 0 && (
                      <div role="status" className="mt-4 text-sm text-rust">
                        {openingErrors.map((e, i) => (
                          <p key={i}>{e}</p>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
              <footer id="room-actions" hidden={compact} className={`${compact ? 'hidden' : 'flex'} shrink-0 flex-col gap-2 border-t border-line px-4 py-3 md:px-5`}>
                {selectedItem?.kind === 'furniture' && (
                  <Button variant="primary" className="min-h-11 w-full justify-center" disabled={!isCurrent && !selectedItem.source.example} onClick={requestBuild}>
                    {isCurrent ? 'Volver al Studio' : 'Ajustar este mueble en el Studio'}
                    <ArrowRight />
                  </Button>
                )}
                {selectedItem?.kind === 'furniture' && !isCurrent && !selectedItem.source.example && (
                  <p className="text-xs text-graphite-2">Este diseño tiene cambios fuera de la ficha y quedó como referencia. Sólo puedes retomarlo si antes descargaste su sesión del Studio.</p>
                )}
                <p className="text-xs text-graphite-2">Muebles cerrados · Detalles en Mi espacio.</p>
              </footer>
            </aside>
          </div>
          <Dialog.Root open={!!confirming} onOpenChange={(show) => !show && setConfirming(null)}>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-graphite/30" />
              <Dialog.Content className="fixed inset-x-4 top-1/2 z-50 mx-auto flex max-w-sm -translate-y-1/2 flex-col gap-4 rounded-3xl border border-line bg-bone p-5 text-graphite">
                <Dialog.Title className="font-display text-xl font-semibold">¿Abrir este mueble en el Studio?</Dialog.Title>
                <Dialog.Description className="text-sm">{confirming && LOSS_NOTE[confirming]}</Dialog.Description>
                <div className="flex flex-wrap justify-end gap-2">
                  <Dialog.Close asChild>
                    <Button variant="ghost" className="min-h-11">
                      Conservar el actual
                    </Button>
                  </Dialog.Close>
                  {confirming === 'design' && <DownloadFirst then={build}>Descargar y abrir</DownloadFirst>}
                  <Button variant="danger" className="min-h-11" onClick={build}>
                    Abrir este mueble
                  </Button>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
