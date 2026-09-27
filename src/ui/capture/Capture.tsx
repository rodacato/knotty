import { ArrowClockwise, ArrowRight, Camera, Image, Key, NotePencil, Plus, Robot, Ruler, Trash, Warning, X } from '@phosphor-icons/react'
import { useMemo, useRef, useState } from 'react'
import type { Dimensions } from '../../domain/design/schema'
import { KIND_NOUN, type DesignKind } from '../../domain/design/kind'
import { VIEWS, viewLabel, type View } from '../../domain/furniture/reading/reading'
import { MEASURE_RANGE, typicalDimensions } from '../../domain/furniture/typical'
import { missing } from '../../ports/Preferences'
import { useServices } from '../services'
import { Button, Pencil, Title } from '../system/components'
import { Field, Input, Select, TextArea } from '../system/Field'
import { KindSelect } from '../system/KindSelect'
import { useStore } from '../store'
import { TraceLog } from '../studio/TraceLog'

const MAX_PHOTOS = 5

const MEASURES: { key: keyof Dimensions; name: string }[] = [
  { key: 'height', name: 'Alto' },
  { key: 'width', name: 'Ancho' },
  { key: 'depth', name: 'Fondo' },
]

/** Without photos, the expert works with what you tell it: asks for a description with some substance. */
const MIN_DESCRIPTION = 15

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

const inRange = (key: keyof Dimensions, value: number) => value >= MEASURE_RANGE[key][0] && value <= MEASURE_RANGE[key][1]

function PhotoTile({ photo, index, onRemove, onNote, onView }: { photo: TakenPhoto; index: number; onRemove: () => void; onNote: (note: string) => void; onView: (view: View) => void }) {
  const [writing, setWriting] = useState(false)
  const name = photo.view ? viewLabel(photo.view) : `${index + 1}`
  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative aspect-[8/7] overflow-hidden rounded-xl">
        <img src={photo.thumbnail} alt={`Foto ${name}`} className="absolute inset-0 h-full w-full object-cover" />
        <button type="button" onClick={onRemove} aria-label={`Quitar foto ${name}`} className="absolute top-2 right-2 grid size-9 place-items-center rounded-full bg-bone/90 text-graphite shadow">
          <Trash />
        </button>
        <div className="absolute bottom-2 left-2">
          {photo.reading ? (
            <span className="flex min-h-8 items-center gap-1.5 rounded-full bg-bone/90 px-2.5 text-xs text-graphite">
              <Pencil className="h-4 w-8 text-amber" /> Mirando la foto…
            </span>
          ) : (
            <Select size="sm" value={photo.view ?? ''} onChange={(e) => onView(e.target.value as View)} aria-label={`Vista de la foto ${index + 1}`} className="text-sm font-medium">
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
        <button type="button" onClick={() => setWriting(true)} className="flex min-h-9 items-center gap-1.5 self-start rounded-lg px-1.5 text-sm text-graphite">
          <NotePencil className="shrink-0" /> Agregar una nota
        </button>
      )}
    </div>
  )
}

export function Capture() {
  const { images, preferences, useCases } = useServices()
  const reconstruct = useStore((s) => s.reconstruct)
  const error = useStore((s) => s.reconstructionError)
  const failedTrace = useStore((s) => s.failedTrace)
  const openSettings = useStore((s) => s.openSettings)
  const settingsOpen = useStore((s) => s.settingsOpen)
  const draft = useStore((s) => s.draft)
  const [kind, setKind] = useState<DesignKind | null>(draft?.kind ?? null)
  const [measures, setMeasures] = useState<Dimensions | null>(draft?.measures ?? null)
  // Measures the person typed stay when the kind changes; untouched ones follow the kind.
  const [measuresTouched, setMeasuresTouched] = useState(draft?.measures != null)
  const [photos, setPhotos] = useState<TakenPhoto[]>(
    () => draft?.photos.map((f, i) => ({ id: `draft-${i}`, base64: f.base64, note: f.note, view: f.view ?? draft.thumbnails[i]?.view ?? null, thumbnail: draft.thumbnails[i]?.dataUrl ?? '', reading: false })) ?? [],
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

  const update = (id: string, change: Partial<TakenPhoto>) => setPhotos((all) => all.map((f) => (f.id === id ? { ...f, ...change } : f)))

  const add = async (files: FileList | null) => {
    const chosen = [...(files ?? [])].slice(0, MAX_PHOTOS - photos.length)
    if (!chosen.length) return
    setProcessing(true)
    try {
      for (const file of chosen) {
        const r = await images.reduce(file)
        const photo: TakenPhoto = { id: crypto.randomUUID(), base64: r.base64, thumbnail: r.thumbnail, view: null, reading: !missingKey }
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

  const chooseKind = (next: DesignKind | null) => {
    setKind(next)
    if (measures && !measuresTouched) setMeasures(typicalDimensions(next))
  }

  const withoutPhotos = photos.length === 0
  const enoughDescription = notes.trim().length >= MIN_DESCRIPTION
  const validMeasures = !measures || MEASURES.every((m) => inRange(m.key, measures[m.key]))
  const canAnalyze = !missingKey && !processing && validMeasures && (!simulated || withSimulated) && (!withoutPhotos || enoughDescription || simulated)
  const analyzeCapture = () =>
    reconstruct({
      measures,
      photos: photos.map((f) => ({ base64: f.base64, ...(f.note?.trim() ? { note: f.note.trim() } : {}), ...(f.view ? { view: f.view } : {}) })),
      thumbnails: photos.map((f) => ({ view: f.view, dataUrl: f.thumbnail })),
      notes: notes.trim(),
      kind,
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
    <main className="mx-auto flex min-h-full max-w-3xl flex-col gap-7 px-4 py-8 sm:px-6 lg:max-w-6xl">
      <Title>¿Qué mueble quieres?</Title>

      {simulated && !withSimulated && (
        <div className="flex max-w-3xl flex-col gap-3 rounded-2xl border border-line bg-kraft p-4">
          <p className="flex items-start gap-2 font-medium">
            <Robot className="mt-0.5 shrink-0" weight="bold" /> Conecta tu experto para diseñar tu mueble
          </p>
          <p className="text-sm text-graphite">
            Sin una API key solo responde el modo simulado, que no entiende tu mueble: arma uno de tres ejemplos (librero, buró o alacena). Con Claude, OpenAI o SheLLM el experto sí lee
            tus fotos y tu descripción.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => openSettings(true)}>
              <Key weight="bold" /> Conectar experto
            </Button>
            <Button variant="ghost" className="underline" onClick={() => setWithSimulated(true)}>
              Probar con los ejemplos simulados
            </Button>
          </div>
        </div>
      )}

      {withoutPhotos && <p className="-mt-3 text-graphite">¿No tienes el mueble enfrente? Descríbelo abajo y el experto lo arma con eso.</p>}

      <div className="grid gap-7 lg:grid-cols-[minmax(0,480px)_1fr] lg:grid-rows-[auto_auto_1fr] lg:gap-x-16">
        <Field label="Tipo de mueble" help={!kind && 'Si no lo eliges, Knotty lo saca de tus fotos y tu descripción. Lo puedes cambiar después.'} className="lg:col-start-1">
          <KindSelect value={kind} onChange={chooseKind} none="Que Knotty lo decida" />
        </Field>

        <section className="flex flex-col gap-2 lg:col-start-1" aria-label="Medidas">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Medidas</p>
            {measures ? (
              <Button
                variant="ghost"
                className="min-h-9 px-2"
                onClick={() => {
                  setMeasures(null)
                  setMeasuresTouched(false)
                }}
              >
                <X /> Sin medidas
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => setMeasures(typicalDimensions(kind))}>
                <Ruler /> Agregar medidas
              </Button>
            )}
          </div>
          <p className="text-xs text-graphite">
            {!measures
              ? 'Sin medidas: el experto propone unas típicas para ese mueble y luego las ajustas en el chat.'
              : measuresTouched
                ? 'Son tus medidas: se quedan aunque cambies el tipo.'
                : kind
                  ? `Típicas de ${KIND_NOUN[kind]}; cámbialas si ya mediste el tuyo.`
                  : 'Las medidas generales por fuera, en milímetros. Con cinta métrica basta.'}
          </p>
          {measures && (
            <div className="grid grid-cols-3 gap-2">
              {MEASURES.map((m) => (
                <Field key={m.key} label={m.name}>
                  <Input
                    type="number"
                    inputMode="numeric"
                    unit="mm"
                    min={MEASURE_RANGE[m.key][0]}
                    max={MEASURE_RANGE[m.key][1]}
                    step={10}
                    value={measures[m.key] || ''}
                    invalid={!inRange(m.key, measures[m.key])}
                    onChange={(e) => {
                      setMeasures({ ...measures, [m.key]: Number(e.target.value) })
                      setMeasuresTouched(true)
                    }}
                  />
                </Field>
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-2 lg:col-start-2 lg:row-span-3 lg:row-start-1" aria-label="Fotos">
          {pickerInput}
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Fotos</p>
            {photos.length >= MAX_PHOTOS && <span className="numerals text-xs text-graphite-2">{photos.length} de {MAX_PHOTOS}</span>}
          </div>
          {withoutPhotos ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border-[1.5px] border-graphite-2 p-6 text-center">
              <Image size={28} className="text-graphite" />
              <Button variant="primary" className="min-h-12 px-6" onClick={() => picker.current?.click()} disabled={processing}>
                <Camera weight="bold" /> Agregar fotos
              </Button>
              <span className="text-xs text-graphite-2">hasta {MAX_PHOTOS}</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
        </section>

        <Field
          label={withoutPhotos ? 'Describe el mueble' : '¿Algo que el experto deba saber?'}
          help={withoutPhotos && 'Ayuda decir qué es, cuántas repisas, puertas o cajones lleva, qué va a cargar y cómo te lo imaginas. Lo que no digas, el experto lo pregunta.'}
          className="lg:col-start-1 lg:self-start"
        >
          <TextArea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={withoutPhotos ? 4 : 2}
            placeholder={
              withoutPhotos
                ? 'Ej. librero de 5 repisas para libros, sin puertas, con zoclo al frente y un cajón abajo; lo quiero pegado a la pared'
                : 'Ej. va a cargar libros; mi espacio mide 90 cm de ancho'
            }
          />
        </Field>
      </div>

      {error && (
        <div className="flex flex-col gap-2 rounded-xl border border-rust/30 bg-rust/10 p-3 text-sm text-rust">
          <div className="flex items-start gap-2">
            <Warning className="mt-0.5 shrink-0" weight="bold" />
            <span className="flex-1">{error} Tus fotos y tu descripción siguen aquí.</span>
            {canAnalyze && (
              <Button variant="ghost" className="min-h-8 shrink-0 px-2 text-rust underline" onClick={analyzeCapture}>
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
      {missingKey && (
        <p className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-kraft p-3 text-sm">
          <Key weight="bold" /> {missingKey}
          <Button variant="ghost" className="min-h-8 px-2 underline" onClick={() => openSettings(true)}>
            Configurar
          </Button>
        </p>
      )}
      <div className="flex justify-end">
        <Button variant="primary" className="min-h-12 px-6" disabled={!canAnalyze} onClick={analyzeCapture}>
          {withoutPhotos ? 'Diseñar sin fotos' : 'Analizar'} <ArrowRight weight="bold" />
        </Button>
      </div>
    </main>
  )
}
