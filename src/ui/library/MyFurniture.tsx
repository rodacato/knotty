import * as Dialog from '@radix-ui/react-dialog'
import { Cube, DownloadSimple, PencilSimple, Trash, X } from '@phosphor-icons/react'
import { useMemo, useState, type ReactNode } from 'react'
import { resolveGeometry } from '../../domain/design/resolve'
import { currentDesign } from '../../domain/session/state'
import { LIBRARY_PLACES, type SavedDesign } from '../../ports/DesignLibrary'
import { sizeLine } from '../capture/catalog'
import { Thumbnail } from '../capture/Thumbnail'
import { DownloadFirst } from '../files/DownloadFirst'
import { downloadDesign } from '../files/download'
import { useServices } from '../services'
import { LOSS_NOTE, lossOf, type SwapLoss } from '../spotlight/swap'
import { useStore } from '../store'
import { Button, IconButton } from '../system/components'
import { ErrorText, Field, Input } from '../system/Field'
import { askToPersist, savedOn } from './places'

type Doing = { place: number; what: 'save' | 'rename' | 'remove' } | { place: number; what: 'open'; loss: SwapLoss } | null

function Drawing({ saved }: { saved: SavedDesign | null }) {
  const { catalog } = useServices()
  const boxes = useMemo(() => {
    const geo = saved && resolveGeometry(saved.design, catalog)
    return geo && geo.ok ? geo.value.boxes : null
  }, [saved, catalog])
  return (
    <span className={`drawing-surface grid shrink-0 place-items-center overflow-hidden rounded-xl border border-line p-2 ${saved ? 'size-20' : 'size-12'}`}>
      {boxes ? <Thumbnail boxes={boxes} /> : <Cube className={`size-5 ${saved ? '' : 'text-graphite-2/50'}`} aria-hidden />}
    </span>
  )
}

function NameForm({ label, start, action, onDone, onCancel }: { label: string; start: string; action: string; onDone: (name: string) => void; onCancel: () => void }) {
  const [name, setName] = useState(start)
  const clean = name.trim()
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (clean) onDone(clean)
      }}
    >
      <Field label={label} className="min-w-40 flex-1">
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus onFocus={(e) => e.target.select()} />
      </Field>
      <Button variant="ghost" onClick={onCancel}>
        Cancelar
      </Button>
      <Button variant="primary" type="submit" className="px-4" disabled={!clean}>
        {action}
      </Button>
    </form>
  )
}

function Confirm({ note, children, onCancel }: { note: string; children: ReactNode; onCancel: () => void }) {
  return (
    <div className="flex flex-col gap-2" role="group" aria-label={note}>
      <p className="text-sm text-graphite">{note}</p>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Conservar
        </Button>
        {children}
      </div>
    </div>
  )
}

/** «Mis muebles»: the places where the person keeps designs, to save the open one in and to open one from. */
export function MyFurniture() {
  const { library, files } = useServices()
  const open = useStore((s) => s.libraryOpen)
  const setOpen = useStore((s) => s.openLibrary)
  const state = useStore((s) => s.state)
  const saveToPlace = useStore((s) => s.saveToPlace)
  const renamePlace = useStore((s) => s.renamePlace)
  const removePlace = useStore((s) => s.removePlace)
  const openPlace = useStore((s) => s.openPlace)
  const resumeDesign = useStore((s) => s.resumeDesign)
  useStore((s) => s.libraryChanges)
  const [doing, setDoing] = useState<Doing>(null)
  const [full, setFull] = useState(false)
  const places = library.places()
  const current = library.current()
  const openName = state ? currentDesign(state).name : null
  const done = () => setDoing(null)

  const save = async (place: number, name: string) => {
    done()
    const stored = await saveToPlace(place, name)
    setFull(!stored)
    if (stored && library.places().filter(Boolean).length > 1) askToPersist()
  }
  const show = (place: number) => {
    done()
    void openPlace(place)
  }
  const ask = (place: number) => {
    if (current.place === place && current.saved) {
      resumeDesign()
      setOpen(false)
      return
    }
    const loss = lossOf(useStore.getState())
    if (loss) setDoing({ place, what: 'open', loss })
    else show(place)
  }
  const download = async (place: number) => {
    const saved = await library.read(place)
    if (saved) await downloadDesign(files, saved)
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        done()
        setOpen(next)
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="scrim fixed inset-0 z-40 bg-graphite/30 backdrop-blur-[2px]" />
        <Dialog.Content className="sheet sheet-top fixed inset-x-3 top-3 z-50 mx-auto flex max-h-[calc(100dvh-1.5rem)] max-w-xl flex-col gap-4 overflow-y-auto rounded-3xl border border-line bg-bone p-5 shadow-2xl sm:top-[8vh] sm:max-h-[84dvh]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <Dialog.Title className="font-display text-2xl font-semibold">Mis muebles</Dialog.Title>
              <Dialog.Description className="text-sm text-graphite-2">
                Hasta {LIBRARY_PLACES} muebles, guardados solo en este navegador. Si borras sus datos o cambias de dispositivo se pierden: descarga los que quieras conservar.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <IconButton size="lg" aria-label="Cerrar">
                <X />
              </IconButton>
            </Dialog.Close>
          </div>
          {openName && (
            <p className="rounded-xl bg-kraft px-3 py-2 text-sm text-graphite" role="status">
              Abierto: <span className="font-medium">{openName}</span>
              {' · '}
              {current.place === null ? 'sin guardar en un lugar' : current.saved ? `guardado en el lugar ${current.place}` : `con cambios que el lugar ${current.place} no tiene`}
            </p>
          )}
          {full && <ErrorText className="text-sm">No hubo espacio en este navegador para guardarlo. Descárgalo, o borra un mueble y vuelve a intentar.</ErrorText>}
          <ol className="flex flex-col gap-2">
            {places.map((saved, i) => {
              const place = i + 1
              const mine = current.place === place
              const busy = doing?.place === place ? doing.what : null
              const size = saved && sizeLine(saved.design.dimensions)
              return (
                <li key={place} className={`flex flex-col gap-3 rounded-2xl border p-3 ${mine ? 'border-focus' : 'border-line'}`} aria-label={saved ? `Lugar ${place}: ${saved.name}` : `Lugar ${place}, vacío`}>
                  <div className="flex items-center gap-3">
                    <Drawing saved={saved} />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="font-mono text-[11px] text-graphite-2">Lugar {place}</span>
                      {saved && size ? (
                        <>
                          <span className="truncate font-medium text-graphite">{saved.name}</span>
                          <span className="numerals text-sm text-graphite-2" aria-label={size.spoken}>
                            {size.text}
                          </span>
                          <span className="text-xs text-graphite-2">Guardado el {savedOn(saved.savedAt)}</span>
                        </>
                      ) : (
                        <span className="text-graphite-2">Vacío</span>
                      )}
                    </div>
                    {!saved && state && !busy && (
                      <Button variant="ghost" className="shrink-0 px-4" onClick={() => setDoing({ place, what: 'save' })}>
                        Guardar aquí
                      </Button>
                    )}
                  </div>
                  {saved && !busy && (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center">
                        <IconButton size="lg" aria-label={`Renombrar ${saved.name}`} title="Renombrar" onClick={() => setDoing({ place, what: 'rename' })}>
                          <PencilSimple />
                        </IconButton>
                        <IconButton size="lg" aria-label={`Descargar ${saved.name}`} title="Descargar" onClick={() => void download(place)}>
                          <DownloadSimple />
                        </IconButton>
                        <IconButton size="lg" aria-label={`Borrar ${saved.name}`} title="Borrar" onClick={() => setDoing({ place, what: 'remove' })}>
                          <Trash />
                        </IconButton>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        {state && !(mine && current.saved) && (
                          <Button variant={mine ? 'primary' : 'ghost'} className="shrink-0 px-4" onClick={() => (mine ? void save(place, saved.name) : setDoing({ place, what: 'save' }))}>
                            {mine ? 'Guardar los cambios' : 'Guardar aquí'}
                          </Button>
                        )}
                        <Button variant="secondary" className="px-4" onClick={() => ask(place)}>
                          {mine && current.saved ? 'Seguir con este' : 'Abrir'}
                        </Button>
                      </div>
                    </div>
                  )}
                  {busy === 'save' && <NameForm label={saved ? `Se reemplaza «${saved.name}». Nombre del mueble` : 'Nombre del mueble'} start={openName ?? ''} action={saved ? 'Reemplazar' : 'Guardar'} onDone={(name) => void save(place, name)} onCancel={done} />}
                  {busy === 'rename' && saved && (
                    <NameForm
                      label="Nombre del mueble"
                      start={saved.name}
                      action="Renombrar"
                      onDone={(name) => {
                        renamePlace(place, name)
                        done()
                      }}
                      onCancel={done}
                    />
                  )}
                  {busy === 'remove' && saved && (
                    <Confirm note={`Se borra «${saved.name}» de este lugar, con su historial y su conversación. No se puede deshacer.`} onCancel={done}>
                      <Button
                        variant="danger"
                        onClick={() => {
                          removePlace(place)
                          done()
                        }}
                      >
                        Borrar
                      </Button>
                    </Confirm>
                  )}
                  {doing?.place === place && doing.what === 'open' && (
                    <Confirm note={LOSS_NOTE[doing.loss]} onCancel={done}>
                      {doing.loss === 'design' && <DownloadFirst then={() => show(place)}>Descargar y abrir</DownloadFirst>}
                      <Button variant="danger" onClick={() => show(place)}>
                        Abrir
                      </Button>
                    </Confirm>
                  )}
                </li>
              )
            })}
          </ol>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
