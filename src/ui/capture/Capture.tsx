import { ArrowClockwise, ArrowLeft, ArrowRight, Camera, Image, Key, NotePencil, PlugsConnected, Plus, Trash, Warning } from '@phosphor-icons/react'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import type { DesignKind } from '../../domain/design/kind'
import { VIEWS, viewLabel, type View } from '../../domain/furniture/reading/reading'
import { missing } from '../../ports/Preferences'
import { AppFooter } from '../shell/AppFooter'
import { AppHeader } from '../shell/AppHeader'
import { expertConnected } from '../shell/expertStatus'
import { useServices } from '../services'
import { Button, Pencil } from '../system/components'
import { Field, Input, Select, TextArea } from '../system/Field'
import { KindSelect } from '../system/KindSelect'
import { useStore } from '../store'
import { TraceLog } from '../system/TraceLog'
import { designBlocker, spaceError, spaceFromMm, spaceToMm, type SpaceKey } from './form'

const MAX_PHOTOS = 5

const SPACE_SIDES: { key: SpaceKey; name: string; example: string }[] = [
  { key: 'width', name: 'Ancho', example: 'Ej. 90' },
  { key: 'depth', name: 'Fondo', example: 'Ej. 40' },
  { key: 'height', name: 'Alto', example: 'Ej. 180' },
]

interface TakenPhoto {
  id: string
  base64: string
  thumbnail: string
  /** Optional: what the person wants to say about this photo. */
  note?: string
  /** The model's label, or the person's correction; null while it is read or when it could not be. */
  view: View | null
  reading: boolean
}

function PhotoTile({ photo, index, onRemove, onNote, onView }: { photo: TakenPhoto; index: number; onRemove: () => void; onNote: (note: string) => void; onView: (view: View) => void }) {
  const [writing, setWriting] = useState(false)
  const name = photo.view ? viewLabel(photo.view) : `${index + 1}`
  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative aspect-[8/7] overflow-hidden rounded-xl">
        <img src={photo.thumbnail} alt={`Foto ${name}`} className="absolute inset-0 h-full w-full object-cover" />
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Quitar foto ${name}`}
          className="absolute top-2 right-2 grid size-9 place-items-center rounded-full bg-bone/90 text-graphite shadow before:absolute before:-inset-1 before:content-['']"
        >
          <Trash />
        </button>
        <div className="absolute bottom-2 left-2">
          {photo.reading ? (
            <span className="flex min-h-8 items-center gap-1.5 rounded-full bg-bone/90 px-2.5 text-xs text-graphite">
              <Pencil className="h-4 w-8 text-amber" /> Mirando la foto…
            </span>
          ) : (
            <Select
              size="sm"
              value={photo.view ?? ''}
              onChange={(e) => onView(e.target.value as View)}
              aria-label={`Vista de la foto ${index + 1}`}
              className="text-sm font-medium"
            >
              {!photo.view && <option value="">¿Qué vista?</option>}
              {VIEWS.map((v) => (
                <option key={v} value={v}>
                  {viewLabel(v)}
                </option>
              ))}
            </Select>
          )}
        </div>
      </div>
      {writing || photo.note?.trim() ? (
        <TextArea
          autoFocus={writing}
          value={photo.note ?? ''}
          onChange={(e) => onNote(e.target.value)}
          onBlur={() => !photo.note?.trim() && setWriting(false)}
          rows={2}
          placeholder="Descríbela: «la de abajo es puerta», «las repisas se mueven»"
          aria-label={`Nota sobre la foto ${name}`}
          className="resize-none"
        />
      ) : (
        <button type="button" onClick={() => setWriting(true)} className="flex min-h-11 items-center gap-1.5 self-start rounded-lg px-1.5 text-sm text-graphite">
          <NotePencil className="shrink-0" /> Agregar una nota
        </button>
      )}
    </div>
  )
}

const LABEL = 'text-base font-medium text-graphite'

function Block({
  label,
  help,
  helpBelow,
  htmlFor,
  children,
  className = '',
}: {
  label: string
  help?: ReactNode
  helpBelow?: ReactNode
  htmlFor?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={htmlFor} className={LABEL}>
        {label}
      </label>
      {help && <p className="text-sm text-graphite-2">{help}</p>}
      {children}
      {helpBelow && <p className="text-sm text-graphite">{helpBelow}</p>}
    </div>
  )
}

export function Capture() {
  const { images, preferences, useCases } = useServices()
  const reconstruct = useStore((s) => s.reconstruct)
  const error = useStore((s) => s.reconstructionError)
  const failedTrace = useStore((s) => s.failedTrace)
  const openConnect = useStore((s) => s.openConnect)
  const goHome = useStore((s) => s.goHome)
  const settingsOpen = useStore((s) => s.settingsOpen)
  const draft = useStore((s) => s.draft)
  const [kind, setKind] = useState<DesignKind | null>(draft?.kind ?? null)
  const [space, setSpace] = useState(() => spaceFromMm(draft?.space))
  const [photos, setPhotos] = useState<TakenPhoto[]>(
    () =>
      draft?.photos.map((f, i) => ({
        id: `draft-${i}`,
        base64: f.base64,
        note: f.note,
        view: f.view ?? draft.thumbnails[i]?.view ?? null,
        thumbnail: draft.thumbnails[i]?.dataUrl ?? '',
        reading: false,
      })) ?? [],
  )
  const [notes, setNotes] = useState(draft?.notes ?? '')
  const [processing, setProcessing] = useState(false)
  const [withSimulated, setWithSimulated] = useState(draft !== null)
  const picker = useRef<HTMLInputElement>(null)
  // Re-read when the settings close so the notice disappears as soon as you connect an expert.
  // oxlint-disable-next-line react-hooks/exhaustive-deps -- settingsOpen is the recompute trigger: preferences live in storage, outside React
  const config = useMemo(() => preferences.load(), [preferences, settingsOpen])
  const missingKey = missing(config)
  const simulated = config.active === 'simulated'
  const connected = expertConnected(config)
  const usable = connected || (simulated && withSimulated)

  const update = (id: string, change: Partial<TakenPhoto>) => setPhotos((all) => all.map((f) => (f.id === id ? { ...f, ...change } : f)))

  const add = async (files: FileList | null) => {
    const chosen = [...(files ?? [])].slice(0, MAX_PHOTOS - photos.length)
    if (!chosen.length) return
    setProcessing(true)
    try {
      for (const file of chosen) {
        const r = await images.reduce(file)
        const photo: TakenPhoto = {
          id: crypto.randomUUID(),
          base64: r.base64,
          thumbnail: r.thumbnail,
          view: null,
          reading: !missingKey,
        }
        setPhotos((all) => [...all, photo].slice(0, MAX_PHOTOS))
        if (!missingKey)
          void useCases
            .readPhoto({ base64: photo.base64 }, notes.trim())
            .then((reading) => update(photo.id, { reading: false, view: reading?.view ?? null }))
            .catch(() => update(photo.id, { reading: false }))
      }
    } finally {
      setProcessing(false)
    }
  }

  const withoutPhotos = photos.length === 0
  const blocker = designBlocker({
    description: notes,
    photos: photos.length,
    reading: processing,
    space,
  })
  const canAnalyze = usable && blocker === null
  const analyzeCapture = () =>
    reconstruct({
      measures: null,
      photos: photos.map((f) => ({
        base64: f.base64,
        ...(f.note?.trim() ? { note: f.note.trim() } : {}),
        ...(f.view ? { view: f.view } : {}),
      })),
      thumbnails: photos.map((f) => ({ view: f.view, dataUrl: f.thumbnail })),
      notes: notes.trim(),
      kind,
      space: spaceToMm(space),
    })

  const pickerInput = (
    <input
      ref={picker}
      type="file"
      accept="image/*"
      multiple
      hidden
      onChange={(e) => {
        void add(e.target.files)
        e.target.value = ''
      }}
    />
  )

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-[1184px] flex-1 flex-col gap-7 px-5 py-6 md:px-8 md:py-10">
        <header className="flex flex-col gap-1">
          <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight [font-variation-settings:'opsz'_48] md:text-4xl">¿Qué mueble quieres?</h1>
          <p className="text-lg text-graphite-2 md:text-xl">Con fotos, con palabras o con las dos.</p>
        </header>

        {!usable && (
          <div className="flex flex-col gap-3 rounded-3xl border-2 border-graphite bg-kraft-2 p-4 md:flex-row md:items-center md:gap-5 md:px-7 md:py-5" role="note">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-graphite text-bone">
              <PlugsConnected size={22} weight="bold" />
            </span>
            <div className="flex flex-1 flex-col gap-1">
              <p className="text-lg font-medium">Conecta tu experto para diseñar tu mueble</p>
              <p className="text-base text-graphite-2">{missingKey ?? 'Él lee tus fotos y tu descripción y arma el diseño. Las bases ya hechas no lo necesitan.'}</p>
            </div>
            {simulated && (
              <Button variant="ghost" className="min-h-11 self-start px-3 text-base! text-graphite-2 md:self-center" onClick={() => setWithSimulated(true)}>
                Probar con los ejemplos simulados
              </Button>
            )}
          </div>
        )}

        <div className="grid gap-7 lg:grid-cols-2 lg:gap-x-16">
          <div className="flex flex-col gap-7">
            <Block label="Tipo de mueble" htmlFor="kind" helpBelow={!kind && 'Si no lo eliges, el experto lo saca de tus fotos y tu descripción. Lo puedes cambiar después.'}>
              <KindSelect id="kind" value={kind} onChange={setKind} none="Que el experto lo decida" />
            </Block>

            <Block
              label={withoutPhotos ? 'Describe el mueble' : '¿Algo que el experto deba saber?'}
              htmlFor="description"
              help={withoutPhotos ? 'Una o dos frases: qué es, sus partes y para qué lo quieres.' : 'Opcional: lo que las fotos no muestran.'}
            >
              <TextArea
                id="description"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={withoutPhotos ? 4 : 3}
                placeholder={withoutPhotos ? 'Ej. librero de 5 repisas, sin puertas, pegado a la pared' : 'Ej. va a cargar libros; mi espacio mide 90 cm de ancho'}
              />
            </Block>

            <section className="flex flex-col gap-1.5" aria-labelledby="space-title">
              <h2 id="space-title" className={LABEL}>
                Espacio disponible
              </h2>
              <div className="grid grid-cols-3 gap-3">
                {SPACE_SIDES.map((side) => {
                  const problem = spaceError(side.key, space[side.key])
                  return (
                    <Field key={side.key} label={side.name} error={problem}>
                      <Input
                        type="text"
                        inputMode="decimal"
                        unit="cm"
                        placeholder={side.example}
                        value={space[side.key]}
                        invalid={problem !== null}
                        onChange={(e) => setSpace({ ...space, [side.key]: e.target.value })}
                      />
                    </Field>
                  )
                })}
              </div>
              <p className="text-sm text-graphite">Aproximado, en cm, está bien. Sin esto el experto propone unas medidas típicas.</p>
            </section>
          </div>

          <section className="flex flex-col gap-1.5" aria-labelledby="photos-title">
            {pickerInput}
            <div className="flex items-center justify-between">
              <h2 id="photos-title" className={LABEL}>
                Fotos
              </h2>
              {photos.length >= MAX_PHOTOS && (
                <span className="numerals text-xs text-graphite-2">
                  {photos.length} de {MAX_PHOTOS}
                </span>
              )}
            </div>
            {withoutPhotos ? (
              <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-3xl border-[1.5px] border-graphite-2 bg-kraft/60 p-6 text-center lg:min-h-[240px]">
                <Image size={28} className="text-graphite" />
                <Button variant="secondary" className="min-h-12 px-6 text-base!" onClick={() => picker.current?.click()} disabled={processing}>
                  <Camera weight="bold" /> Agregar fotos
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {photos.map((f, i) => (
                  <PhotoTile
                    key={f.id}
                    photo={f}
                    index={i}
                    onRemove={() => setPhotos((all) => all.filter((x) => x.id !== f.id))}
                    onNote={(note) => update(f.id, { note })}
                    onView={(view) => update(f.id, { view })}
                  />
                ))}
                {photos.length < MAX_PHOTOS && (
                  <button
                    type="button"
                    onClick={() => picker.current?.click()}
                    disabled={processing}
                    className="flex aspect-[8/7] flex-col items-center justify-center gap-1 rounded-xl border-[1.5px] border-graphite-2 text-graphite disabled:opacity-50"
                  >
                    <Plus size={22} />
                    <span className="text-sm font-medium">Agregar fotos</span>
                    <span className="numerals text-xs text-graphite-2">
                      {photos.length} de {MAX_PHOTOS}
                    </span>
                  </button>
                )}
              </div>
            )}
            <p className="text-base text-graphite-2">Hasta {MAX_PHOTOS} fotos. Se envían a tu experto para leerlas.</p>
          </section>
        </div>

        {error && (
          <div className="mx-auto flex w-full max-w-[720px] flex-col gap-2 rounded-xl border border-rust/30 bg-rust/10 p-3 text-sm text-rust">
            <div className="flex items-start gap-2">
              <Warning className="mt-0.5 shrink-0" weight="bold" />
              <span role="alert" className="flex-1">{error} Tus fotos y tu descripción siguen aquí.</span>
              {canAnalyze && (
                <Button variant="ghost" className="shrink-0 px-2 text-rust underline" onClick={analyzeCapture}>
                  <ArrowClockwise weight="bold" /> Reintentar
                </Button>
              )}
            </div>
            {failedTrace.length > 0 && (
              <details className="text-graphite">
                <summary className="cursor-pointer text-xs underline">Ver qué pasó</summary>
                <div className="mt-2">
                  <TraceLog trace={failedTrace} />
                </div>
              </details>
            )}
          </div>
        )}

        <div className="-mx-5 flex flex-col items-center gap-3 border-t border-line px-5 pt-5 md:mx-0 md:border-t-0 md:px-0 md:pt-2">
          {usable ? (
            <Button variant="primary" className="min-h-14 w-full max-w-[720px] text-lg! shadow-md" disabled={!canAnalyze} onClick={analyzeCapture}>
              {blocker ?? (
                <>
                  Diseñar mi mueble <ArrowRight weight="bold" />
                </>
              )}
            </Button>
          ) : (
            <Button variant="secondary" className="min-h-14 w-full max-w-[720px] text-lg!" onClick={() => openConnect(true)}>
              {missingKey && <Key weight="bold" />} Conectar experto <ArrowRight weight="bold" />
            </Button>
          )}
          <p className="text-center text-base text-graphite-2">Suele tomar menos de un minuto; las fotos y el diseño usan tu llave.</p>
          <p className="flex flex-wrap items-center justify-center gap-x-2 text-base text-graphite-2">
            ¿Prefieres una base ya hecha?
            <Button variant="ghost" className="min-h-11 px-3 text-base! text-graphite-2" onClick={goHome}>
              <ArrowLeft weight="bold" /> Ver bases
            </Button>
          </p>
        </div>
      </main>
      <AppFooter />
    </div>
  )
}
