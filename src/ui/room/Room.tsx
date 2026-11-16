import * as Dialog from '@radix-ui/react-dialog'
import { ArrowLeft, ArrowRight, ArrowCounterClockwise, ArrowClockwise, ArrowsClockwise, CaretDown, CaretUp, Check, Copy, Cube, Trash, Warning, X } from '@phosphor-icons/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { currentDesign } from '../../domain/session/state'
import { resolveGeometry } from '../../domain/design/resolve'
import { useServices } from '../services'
import { useStore } from '../store'
import { Button } from '../system/components'
import { Field, Input, Select } from '../system/Field'
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

/** A square cell of a ruled strip: the view switch, the panel tabs and the tools. The open one is solid ink. */
const cell = (active = false) =>
  `flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap px-3 font-display text-lg leading-none font-semibold uppercase transition disabled:opacity-40 ${active ? 'bg-graphite text-bone' : 'bg-bone text-graphite hover:bg-kraft'}`
const strip = 'flex divide-x-2 divide-graphite border-2 border-graphite'
const PANEL_TITLE = 'font-display text-2xl leading-tight font-semibold uppercase'
const NOTE = 'text-base text-graphite-2'

const codeOf = (item: Item) => (item.kind === 'furniture' ? (item.source.code ? `${item.source.code} v${item.source.version}` : 'Tu diseño del Studio') : 'Bloque de espacio ocupado')

function Combination() {
  const { references, catalog } = useServices()
  const layout = useRoom((s) => s.layout)!
  const [query, setQuery] = useState(''),
    [all, setAll] = useState(false),
    [room, setRoom] = useState(ANY.room),
    [limit, setLimit] = useState(12)
  const bases = useMemo(() => references.home(), [references])
  const anchor = layout.items.find((i) => i.id === layout.anchorId && i.kind === 'furniture') ?? layout.items.find((i) => i.kind === 'furniture')
  const candidates = useMemo(
    () => (all || query ? bases.filter((b) => matches(b, { text: query, room })) : anchor?.kind === 'furniture' ? companions(bases, anchor.source).slice(0, 4) : bases.slice(0, 4)),
    [all, query, bases, room, anchor],
  )
  const cards = useMemo(() => cardsOf(candidates.slice(0, limit), catalog), [candidates, limit, catalog])
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className={PANEL_TITLE}>{all || query ? 'Elige un compañero' : 'Combínalo con…'}</h2>
        <p className="text-base text-graphite">Agrega una ficha y descubre cómo se ve junto a las demás.</p>
      </div>
      <Field label={<span className="font-display text-base font-semibold text-graphite uppercase">Buscar fichas</span>} className={all || query ? '' : 'max-md:hidden'}>
        <Input
          value={query}
          placeholder="Nombre, cuarto, estilo o modelo"
          onChange={(e) => {
            setQuery(e.target.value)
            setLimit(12)
          }}
        />
      </Field>
      {all && (
        <Field label={<span className="font-display text-base font-semibold text-graphite uppercase">Cuarto</span>}>
          <Select
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
          </Select>
        </Field>
      )}
      {cards.length > 0 && (
        <ul className="flex flex-col border-y-2 border-graphite">
          {cards.map(({ base, size, boxes }) => (
            <li key={base.code} className="border-t border-graphite first:border-t-0">
              <button
                type="button"
                className="flex min-h-20 w-full items-center gap-3 py-2 text-left hover:bg-kraft"
                aria-label={`Agregar ${base.name}, ${base.code}`}
                onClick={() => useRoom.getState().add(baseSource(base, catalog))}
              >
                <span className="drawing-surface grid size-16 shrink-0 place-items-center overflow-hidden p-1">{boxes ? <Thumbnail boxes={boxes} /> : <Cube />}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-display text-lg leading-tight font-semibold uppercase">{base.name}</span>
                  <span className="numerals font-mono text-base">{size.text}</span>
                  <span className="font-mono text-base">
                    {base.code} v{base.version}
                  </span>
                </span>
                <span className="shrink-0 border-2 border-graphite px-3 py-2 font-display text-base leading-none font-semibold uppercase" aria-hidden>
                  Agregar
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!cards.length && (
        <p role="status" className={NOTE}>
          No encontramos fichas con esa búsqueda. Prueba otro nombre o elige otro cuarto.
        </p>
      )}
      {!all && (
        <Button variant="secondary" onClick={() => setAll(true)}>
          Ver todas las fichas
        </Button>
      )}
      {candidates.length > limit && (
        <Button variant="secondary" onClick={() => setLimit((n) => n + 12)}>
          Ver más fichas
        </Button>
      )}
    </div>
  )
}

function ItemEditor({ item }: { item: Item }) {
  const { catalog } = useServices()
  const layout = useRoom((s) => s.layout)!
  const itemIssues = issues(layout).filter((i) => i.item === item.id)
  const design = item.kind === 'furniture' ? item.source.design : null
  const result = useMemo(() => (design ? resolveGeometry(design, catalog) : null), [design, catalog])
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className={PANEL_TITLE}>{nameOf(item)}</h2>
        <p className="numerals font-mono text-base">{sizeLine(sizeOf(item)).text}</p>
        <p className="font-mono text-base">{codeOf(item)}</p>
      </div>
      {itemIssues.length > 0 && (
        <div role="status" className="flex flex-col gap-1 border-l-8 border-graphite py-1 pl-3 text-base">
          <p className="flex items-center gap-2 font-semibold text-graphite">
            <Warning weight="bold" /> Revisa su colocación
          </p>
          {itemIssues.map((i, n) => (
            <p key={n}>{i.message}</p>
          ))}
        </div>
      )}
      {result && !result.ok && (
        <p role="alert" className="text-base font-medium text-graphite">
          No se pudo dibujar esta ficha: {result.errors[0]?.message}. Su espacio sigue visible en el plano.
        </p>
      )}
      <PlacementForm key={item.id} item={item} />
      <p className={NOTE}>Las medidas y la construcción del mueble se ajustan en el Studio.</p>
    </div>
  )
}

/** What is done to the chosen piece, at the foot of the view it is chosen in, 3D or plan (UI-89). */
function ItemTools({ item }: { item: Item }) {
  return (
    <div className={`${strip} shrink-0`} role="group" aria-label={`Qué hacer con ${nameOf(item)}`} data-room-tools>
      <button type="button" className={cell()} onClick={() => useRoom.getState().turn(item.id)}>
        <ArrowsClockwise weight="bold" aria-hidden /> Girar
      </button>
      <button type="button" className={cell()} onClick={() => useRoom.getState().duplicate(item.id)}>
        <Copy weight="bold" aria-hidden /> Duplicar
      </button>
      <button type="button" className={cell()} onClick={() => useRoom.getState().remove(item.id)} title="Quitar (Supr)">
        <Trash weight="bold" aria-hidden /> Quitar
      </button>
    </div>
  )
}

/** The pieces in the room as a cut ticket: one ruled row each; choosing a row chooses the piece. Their numbers are the ones in the view. */
function Ticket({ items, selected, bad, onChoose }: { items: Item[]; selected: string | null; bad: Set<string>; onChoose: (id: string) => void }) {
  return (
    <section aria-label="Tu combinación" className="max-h-[8.5rem] shrink-0 overflow-y-auto border-2 border-graphite md:max-h-[9.5rem]">
      <ul className="divide-y-2 divide-graphite">
        {items.map((i, index) => {
          const chosen = i.id === selected
          return (
            <li key={i.id}>
              <button
                type="button"
                className={`grid min-h-12 w-full grid-cols-[2.5rem_minmax(0,1fr)_2rem] items-stretch text-left md:min-h-14 md:grid-cols-[4.5rem_minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1.3fr)_3.5rem] ${chosen ? 'ink-band' : 'hover:bg-kraft'}`}
                aria-pressed={chosen}
                onClick={() => onChoose(i.id)}
              >
                <span className="numerals grid place-items-center border-r-2 border-graphite font-mono text-2xl font-semibold">{index + 1}</span>
                <span className="flex min-w-0 flex-col justify-center gap-0.5 px-2 py-1.5 md:border-r-2 md:border-graphite md:px-5">
                  <span className="font-display text-lg leading-tight font-semibold uppercase md:text-2xl">{nameOf(i)}</span>
                  <span className="flex flex-wrap gap-x-2 font-mono text-[15px] md:hidden">
                    <span className="numerals">{sizeLine(sizeOf(i)).text}</span>
                    <span aria-hidden>|</span>
                    <span>{codeOf(i)}</span>
                  </span>
                  {bad.has(i.id) && (
                    <span className="flex items-center gap-1.5 text-base font-semibold">
                      <Warning weight="bold" aria-hidden /> Revisar colocación
                    </span>
                  )}
                </span>
                <span className="numerals hidden items-center border-r-2 border-graphite px-5 font-mono text-lg md:flex">{sizeLine(sizeOf(i)).text}</span>
                <span className="hidden items-center px-5 font-mono text-lg md:flex">{codeOf(i)}</span>
                <span className="grid place-items-center">{chosen && <Check weight="bold" className="size-6" aria-hidden />}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
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
  const [confirming, setConfirming] = useState<SwapLoss | null>(null)
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
  }, [panel, editedItem])
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
      const chosen = useRoom.getState().selected
      if (chosen && (e.key === 'Delete' || e.key === 'Backspace') && !(e.target as HTMLElement).closest('[data-room-opening]')) {
        e.preventDefault()
        useRoom.getState().remove(chosen)
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
  const toReview = bad.size + openingErrors.length
  const choose = (id: string) => {
    useRoom.getState().select(id)
    setCollapsed(false)
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
          <header className="ink-band flex shrink-0 items-stretch gap-2 px-1 py-1 md:gap-5 md:px-4 md:py-2">
            <Dialog.Close asChild>
              <button
                type="button"
                className="grid min-h-11 min-w-11 place-items-center border-2 border-graphite font-display text-lg font-semibold text-graphite uppercase hover:bg-kraft md:border-y-0 md:border-l-0 md:border-line md:pr-5 md:pl-2"
                aria-label="Volver al mueble"
              >
                <ArrowLeft weight="bold" className="md:hidden" />
                <span className="max-md:hidden">Volver al mueble</span>
              </button>
            </Dialog.Close>
            <div className="flex min-w-0 flex-1 flex-col justify-center max-md:items-center">
              <Dialog.Title className="font-display text-2xl leading-none font-semibold uppercase md:text-4xl">
                Tu espacio<span className="hidden min-[380px]:inline"> con Knotty</span>
              </Dialog.Title>
              <Dialog.Description id="room-description" className="text-base text-graphite-2 max-md:sr-only">
                Prueba combinaciones antes de construir. Este espacio dura hasta recargar la página.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="secondary" className="min-w-11 px-0 text-lg md:my-1 md:px-5" aria-label="Cerrar el espacio">
                <X weight="bold" className="md:hidden" />
                <span className="max-md:hidden">Cerrar el espacio</span>
              </Button>
            </Dialog.Close>
          </header>
          {/* On a phone the room is one column that scrolls, with the Studio button held at its foot; on a desktop each region keeps its own height. */}
          <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-1.5 max-md:pb-0 md:gap-3 md:overflow-hidden md:p-3">
            {!tight && <Ticket items={layout.items} selected={selected} bad={bad} onChoose={choose} />}
            <div className="flex flex-col border-2 border-graphite md:grid md:min-h-0 md:flex-1 md:grid-cols-[minmax(0,1fr)_400px]">
              <section className="flex flex-col gap-2 p-1.5 md:min-h-0 md:border-r-2 md:border-graphite md:p-4" aria-label="Vista del cuarto" data-room-canvas>
                <div className="flex shrink-0 items-start justify-between gap-2">
                  <div className={`${strip} w-full max-w-sm`} role="group" aria-label="Vista del espacio">
                    <button
                      type="button"
                      className={cell(view === 'scene')}
                      aria-pressed={view === 'scene'}
                      onClick={() => {
                        useRoom.getState().setView('scene')
                        setCollapsed(false)
                      }}
                    >
                      Ver en 3D
                    </button>
                    <button
                      type="button"
                      className={cell(view === 'plan')}
                      aria-pressed={view === 'plan'}
                      onClick={() => {
                        useRoom.getState().setView('plan')
                        setCollapsed(true)
                      }}
                    >
                      Acomodar
                    </button>
                  </div>
                  <div className={strip}>
                    <button type="button" className={`${cell()} min-w-11 px-0`} disabled={!past.length} aria-label="Deshacer en el espacio" onClick={() => useRoom.getState().undo()}>
                      <ArrowCounterClockwise weight="bold" />
                    </button>
                    <button type="button" className={`${cell()} min-w-11 px-0`} disabled={!future.length} aria-label="Rehacer en el espacio" onClick={() => useRoom.getState().redo()}>
                      <ArrowClockwise weight="bold" />
                    </button>
                  </div>
                </div>
                <p className="numerals shrink-0 font-mono text-base">
                  {layout.room.width / 10} × {layout.room.depth / 10} cm<span className="sm:hidden"> · ejemplo</span>
                  <span className="hidden sm:inline"> · espacio de prueba</span>
                </p>
                <div className={`relative shrink-0 ${tight ? 'h-[55dvh]' : 'h-[36dvh]'} md:h-auto md:min-h-0 md:flex-1`}>
                  <div className="absolute inset-0">
                    {view === 'plan' ? (
                      <RoomPlan layout={layout} bad={bad} />
                    ) : (
                      <SceneBoundary
                        fallback={
                          <div className="grid h-full place-items-center p-6 text-center">
                            <div className="flex max-w-xs flex-col gap-3">
                              <p className="text-base">No se pudo mostrar el cuarto en 3D.</p>
                              <Button variant="secondary" onClick={() => useRoom.getState().setView('plan')}>
                                Usar el plano 2D
                              </Button>
                            </div>
                          </div>
                        }
                      >
                        <RoomScene layout={layout} bad={bad} />
                      </SceneBoundary>
                    )}
                  </div>
                </div>
                {view === 'plan' && !tight && <p className="shrink-0 text-center text-base">Arrastra un mueble, una puerta o una ventana. La línea gruesa es el frente del mueble.</p>}
                {toReview > 0 && (
                  <button
                    type="button"
                    data-room-warning
                    className="flex min-h-11 w-fit shrink-0 items-center gap-2 border-l-8 border-graphite pr-3 pl-3 text-base font-semibold text-graphite hover:bg-kraft"
                    onClick={() => {
                      if (found[0]) useRoom.getState().select(found[0].item)
                      else useRoom.getState().setPanel('space')
                    }}
                  >
                    <Warning weight="bold" /> {toReview} {toReview === 1 ? 'elemento por revisar' : 'elementos por revisar'}
                  </button>
                )}
                {selectedItem && <ItemTools item={selectedItem} />}
              </section>
              <aside className="flex flex-col border-t-2 border-graphite md:min-h-0 md:border-t-0" aria-label="Explorar muebles y espacio">
                <nav className={`${strip} m-1.5 shrink-0 md:m-4 md:mb-0`} aria-label="Herramientas del espacio">
                  {(
                    [
                      ['combine', 'Combinar'],
                      ['item', 'Mueble'],
                      ['space', 'Mi espacio'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={`${cell(panel === id)} px-1`}
                      aria-pressed={panel === id}
                      aria-expanded={panel === id && !compact}
                      aria-controls="room-panel room-actions"
                      onClick={() => {
                        setCollapsed(narrow && panel === id ? !collapsed : false)
                        useRoom.getState().setPanel(id)
                      }}
                    >
                      {label}
                      {narrow && panel === id && (compact ? <CaretUp weight="bold" aria-hidden /> : <CaretDown weight="bold" aria-hidden />)}
                    </button>
                  ))}
                </nav>
                <div id="room-panel" ref={panelBody} hidden={compact} className="px-3 py-3 md:min-h-0 md:flex-1 md:overflow-y-auto md:px-4 md:py-4">
                  {panel === 'combine' && <Combination />}
                  {panel === 'item' && (selectedItem ? <ItemEditor item={selectedItem} /> : <p className={NOTE}>Elige un mueble en la vista o agrega una ficha para probarla.</p>)}
                  {panel === 'space' && (
                    <>
                      <SpaceEditor layout={layout} />
                      {openingErrors.length > 0 && (
                        <div role="status" className="mt-4 flex flex-col gap-1 border-l-8 border-graphite pl-3 text-base font-medium text-graphite">
                          {openingErrors.map((e, i) => (
                            <p key={i} className="flex items-start gap-2">
                              <Warning weight="bold" className="mt-1 shrink-0 text-rust" aria-hidden /> {e}
                            </p>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  <p className="mt-4 text-center text-base text-graphite-2 md:hidden">Muebles cerrados · Detalles en Mi espacio.</p>
                </div>
                <footer
                  id="room-actions"
                  hidden={compact}
                  className={`${compact ? 'hidden' : 'flex'} sticky bottom-0 shrink-0 flex-col gap-2 border-t-2 border-graphite bg-bone px-1.5 py-1.5 md:static md:px-4 md:py-3`}
                >
                  {selectedItem?.kind === 'furniture' && (
                    <Button variant="primary" className="w-full text-xl" disabled={!isCurrent && !selectedItem.source.example} onClick={requestBuild}>
                      {isCurrent ? 'Volver al Studio' : 'Ajustar este mueble en el Studio'}
                      <ArrowRight weight="bold" />
                    </Button>
                  )}
                  {selectedItem?.kind === 'furniture' && !isCurrent && !selectedItem.source.example && (
                    <p className={NOTE}>Este diseño tiene cambios fuera de la ficha y quedó como referencia. Sólo puedes retomarlo si antes descargaste su sesión del Studio.</p>
                  )}
                  <p className="text-center text-base text-graphite-2 max-md:hidden">Muebles cerrados · Detalles en Mi espacio.</p>
                </footer>
              </aside>
            </div>
          </div>
          <Dialog.Root open={!!confirming} onOpenChange={(show) => !show && setConfirming(null)}>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-graphite/40" />
              <Dialog.Content className="fixed inset-x-4 top-1/2 z-50 mx-auto flex max-w-md -translate-y-1/2 flex-col border-2 border-graphite bg-bone text-graphite">
                <Dialog.Title className="ink-band px-4 py-3 font-display text-2xl leading-tight font-semibold uppercase">¿Abrir este mueble en el Studio?</Dialog.Title>
                <Dialog.Description className="px-4 py-4 text-base">{confirming && LOSS_NOTE[confirming]}</Dialog.Description>
                <div className="flex flex-wrap justify-end gap-2 border-t-2 border-graphite px-4 py-3">
                  <Dialog.Close asChild>
                    <Button variant="secondary">Conservar el actual</Button>
                  </Dialog.Close>
                  {confirming === 'design' && <DownloadFirst then={build}>Descargar y abrir</DownloadFirst>}
                  <Button variant="danger" onClick={build}>
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
