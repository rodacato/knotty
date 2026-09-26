import { ArrowClockwise, ArrowLeft, ArrowRight, Key, NotePencil, Question, Robot, Trash, Warning } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import type { Dimensions } from '../../domain/design/schema'
import type { DesignKind } from '../../domain/design/kind'
import { KindSelect } from '../system/KindSelect'
import { missing } from '../../ports/Preferences'
import { useServices } from '../services'
import { Button, cm, Title } from '../system/components'
import { TakePhoto } from '../system/TakePhoto'
import { useStore } from '../store'
import { TraceLog } from '../studio/TraceLog'
import { Silhouette } from './Silhouettes'

const ANGLES = [
  { id: 'front', name: 'Frente', hint: 'De frente, a media altura', required: true },
  { id: 'three-quarter', name: '3/4', hint: 'Desde una esquina: frente y lado', required: true },
  { id: 'side', name: 'Lateral', hint: 'De lado, para ver el fondo', required: false },
  { id: 'inside', name: 'Interior', hint: 'Abierto: entrepaños y trasera', required: false },
  { id: 'joints', name: 'Uniones', hint: 'De cerca: cómo se juntan', required: false },
] as const

const MEASURES: { key: keyof Dimensions; name: string; min: number; max: number }[] = [
  { key: 'height', name: 'Alto', min: 200, max: 2400 },
  { key: 'width', name: 'Ancho', min: 200, max: 2400 },
  { key: 'depth', name: 'Fondo', min: 150, max: 1200 },
]

/** Without photos, the expert works with what you tell it: asks for a description with some substance. */
const MIN_DESCRIPTION = 15

interface TakenPhoto {
  angle: string
  base64: string
  thumbnail: string
  /** Optional: what the person wants to say about this photo. */
  note?: string
}

function MeasureField({ name, value, min, max, onChange }: { name: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-2 rounded-2xl border border-line bg-bone/70 p-4">
      <span className="flex items-baseline justify-between">
        <span className="font-medium">{name}</span>
        <span className="numerals text-sm text-graphite-2">{cm(value)}</span>
      </span>
      <span className="flex items-baseline gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={10}
          value={value || ''}
          onChange={(e) => onChange(Number(e.target.value))}
          className="numerals w-full bg-transparent text-4xl font-medium outline-none"
        />
        <span className="numerals text-graphite-2">mm</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={10}
        value={Math.min(max, Math.max(min, value))}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={`${name} en milímetros`}
        className="h-7 w-full cursor-pointer appearance-none rounded bg-[repeating-linear-gradient(90deg,var(--line)_0_1px,transparent_1px_10px),repeating-linear-gradient(90deg,var(--graphite-2)_0_1px,transparent_1px_50px)] bg-[length:100%_40%,100%_75%] bg-bottom bg-no-repeat accent-amber"
      />
    </label>
  )
}

function Slot({
  angle,
  photo,
  onPhoto,
  onRemove,
  onNote,
  processing,
}: {
  angle: (typeof ANGLES)[number]
  photo?: TakenPhoto
  onPhoto: (f: File) => void
  onRemove: () => void
  onNote: (note: string) => void
  processing: boolean
}) {
  const [noteOpen, setNoteOpen] = useState(false)
  return (
    <div className={`animate-appear relative flex min-h-60 flex-col overflow-hidden rounded-2xl border ${photo ? 'border-transparent' : 'border-dashed border-graphite/25 bg-bone/60'}`}>
      {photo ? (
        <>
          <img src={photo.thumbnail} alt={`Foto ${angle.name}`} className="absolute inset-0 h-full w-full object-cover" />
          <span className="absolute top-2 left-2 rounded-full bg-graphite/80 px-2 py-0.5 text-xs font-medium text-bone">{angle.name}</span>
          <button type="button" onClick={onRemove} aria-label={`Quitar foto ${angle.name}`} className="absolute top-2 right-2 grid size-8 place-items-center rounded-full bg-bone/90 text-graphite shadow">
            <Trash />
          </button>
          {noteOpen ? (
            <textarea
              autoFocus
              value={photo.note ?? ''}
              onChange={(e) => onNote(e.target.value)}
              onBlur={() => !photo.note?.trim() && setNoteOpen(false)}
              rows={3}
              placeholder="Descríbela: «la de abajo es puerta», «las repisas se mueven»"
              aria-label={`Nota sobre la foto ${angle.name}`}
              className="absolute inset-x-2 bottom-2 resize-none rounded-xl border border-line bg-bone/95 p-2 text-xs text-graphite shadow outline-none focus:border-amber"
            />
          ) : (
            <button
              type="button"
              onClick={() => setNoteOpen(true)}
              aria-label={`Agregar una nota a la foto ${angle.name}`}
              title="Agregar una nota"
              className={`absolute right-2 bottom-2 flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs shadow ${photo.note?.trim() ? 'bg-graphite text-bone' : 'bg-bone/90 text-graphite'}`}
            >
              <NotePencil /> {photo.note?.trim() ? 'Nota' : ''}
            </button>
          )}
        </>
      ) : (
        <div className="flex h-full flex-col justify-between gap-1 p-3">
          <div>
            <p className="font-medium">
              {angle.name} {angle.required && <span className="text-amber">•</span>}
            </p>
            <p className="text-xs leading-snug text-graphite-2">{angle.hint}</p>
          </div>
          <div className="grid flex-1 place-items-center">
            <Silhouette angle={angle.id} />
          </div>
          <div className="flex gap-1.5">
            <TakePhoto onChoose={onPhoto} disabled={processing} compact />
          </div>
        </div>
      )}
    </div>
  )
}

export function Capture() {
  const { images, preferences } = useServices()
  const reconstruct = useStore((s) => s.reconstruct)
  const error = useStore((s) => s.reconstructionError)
  const failedTrace = useStore((s) => s.failedTrace)
  const openSettings = useStore((s) => s.openSettings)
  const settingsOpen = useStore((s) => s.settingsOpen)
  const draft = useStore((s) => s.draft)
  const [step, setStep] = useState<'measures' | 'photos'>(draft ? 'photos' : 'measures')
  const [measures, setMeasures] = useState<Dimensions>(draft?.measures ?? { width: 600, height: 1800, depth: 300 })
  const [withMeasures, setWithMeasures] = useState(!draft || draft.measures !== null)
  const [photos, setPhotos] = useState<TakenPhoto[]>(
    () => draft?.photos.map((f) => ({ angle: f.angle, base64: f.base64, note: f.note, thumbnail: draft.thumbnails.find((m) => m.angle === f.angle)?.dataUrl ?? '' })) ?? [],
  )
  const [notes, setNotes] = useState(draft?.notes ?? '')
  const [kind, setKind] = useState<DesignKind | null>(draft?.kind ?? null)
  const [processing, setProcessing] = useState(false)
  const [withSimulated, setWithSimulated] = useState(draft !== null)
  // Re-read when the settings close so the notice disappears as soon as you connect an expert.
  // oxlint-disable-next-line react-hooks/exhaustive-deps -- settingsOpen is the recompute trigger: preferences live in storage, outside React
  const config = useMemo(() => preferences.load(), [preferences, settingsOpen])
  const missingKey = missing(config)
  const simulated = config.active === 'simulated'

  const add = async (angle: string, file: File) => {
    setProcessing(true)
    try {
      const r = await images.reduce(file)
      setPhotos((f) => [...f.filter((x) => x.angle !== angle), { angle, base64: r.base64, thumbnail: r.thumbnail }])
    } finally {
      setProcessing(false)
    }
  }

  const withoutPhotos = photos.length === 0
  const enoughDescription = notes.trim().length >= MIN_DESCRIPTION
  const canAnalyze = !missingKey && !processing && (!simulated || withSimulated) && (!withoutPhotos || enoughDescription || simulated)
  const validMeasures = MEASURES.every((m) => measures[m.key] >= m.min && measures[m.key] <= m.max)
  const missingRequired = ANGLES.filter((a) => a.required && !photos.some((f) => f.angle === a.id))
  const analyzeCapture = () =>
    reconstruct({ measures: withMeasures ? measures : null, photos: photos.map((f) => ({ angle: f.angle, base64: f.base64, ...(f.note?.trim() ? { note: f.note.trim() } : {}) })), thumbnails: photos.map((f) => ({ angle: f.angle, dataUrl: f.thumbnail })), notes: notes.trim(), kind })

  return (
    <main className="mx-auto flex min-h-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6">
      <header className="flex items-center gap-3">
        <span className="numerals rounded-full bg-graphite px-2.5 py-1 text-xs text-bone">{step === 'measures' ? '1' : '2'} / 2</span>
        <Title>{step === 'measures' ? '¿Cuánto mide?' : 'Fotos o descripción'}</Title>
      </header>

      {simulated && !withSimulated && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber/40 bg-amber-soft p-4">
          <p className="flex items-start gap-2 font-medium">
            <Robot className="mt-0.5 shrink-0" weight="bold" /> Conecta tu experto para diseñar tu mueble
          </p>
          <p className="text-sm text-graphite-2">
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

      {step === 'measures' ? (
        <>
          <p className="-mt-4 text-graphite-2">Las medidas generales por fuera, en milímetros. Con cinta métrica basta.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {MEASURES.map((m) => (
              <MeasureField key={m.key} name={m.name} value={measures[m.key]} min={m.min} max={m.max} onChange={(v) => setMeasures((d) => ({ ...d, [m.key]: v }))} />
            ))}
          </div>
          <label className="flex flex-col gap-1.5 sm:max-w-sm">
            <span className="text-sm font-medium">Tipo de mueble</span>
            <KindSelect value={kind} onChange={setKind} none="Que Knotty lo decida" />
            <span className="text-xs text-graphite-2">Si no lo eliges, Knotty lo saca de tus fotos y tu descripción. Lo puedes cambiar después.</span>
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              variant="ghost"
              onClick={() => {
                setWithMeasures(false)
                setStep('photos')
              }}
            >
              <Question /> No sé las medidas
            </Button>
            <Button
              variant="primary"
              className="min-h-12 px-6"
              disabled={!validMeasures}
              onClick={() => {
                setWithMeasures(true)
                setStep('photos')
              }}
            >
              Siguiente <ArrowRight weight="bold" />
            </Button>
          </div>
        </>
      ) : (
        <>
          {!withMeasures && (
            <p className="-mt-4 text-sm text-graphite-2">Sin medidas: el experto propone unas típicas para ese mueble y luego las ajustas en el chat.</p>
          )}
          <p className={withMeasures ? '-mt-4 text-graphite-2' : 'text-graphite-2'}>
            Con fotos, frente y 3/4 son las importantes; se reducen en tu teléfono antes de enviarse. ¿No tienes el mueble enfrente? Descríbelo abajo y el experto lo arma con eso.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {ANGLES.map((a) => (
              <Slot
                key={a.id}
                angle={a}
                photo={photos.find((f) => f.angle === a.id)}
                processing={processing}
                onPhoto={(f) => void add(a.id, f)}
                onRemove={() => setPhotos((f) => f.filter((x) => x.angle !== a.id))}
                onNote={(note) => setPhotos((f) => f.map((x) => (x.angle === a.id ? { ...x, note } : x)))}
              />
            ))}
          </div>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium">{withoutPhotos ? 'Describe el mueble' : '¿Algo que el experto deba saber?'}</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={withoutPhotos ? 4 : 2}
              placeholder={
                withoutPhotos
                  ? 'Ej. librero de 5 repisas para libros, sin puertas, con zoclo al frente y un cajón abajo; lo quiero pegado a la pared'
                  : 'Ej. va a cargar libros; mi espacio mide 90 cm de ancho'
              }
              className="rounded-2xl border border-line bg-bone/70 p-3 outline-none focus:border-amber"
            />
            {withoutPhotos && (
              <span className="text-xs text-graphite-2">
                Ayuda decir qué es, cuántas repisas, puertas o cajones lleva, qué va a cargar y cómo te lo imaginas. Lo que no digas, el experto lo pregunta.
              </span>
            )}
          </label>
          {error && (
            <div className="flex flex-col gap-2 rounded-xl border border-rust/30 bg-rust/10 p-3 text-sm text-rust">
              <div className="flex items-start gap-2">
                <Warning className="mt-0.5 shrink-0" weight="bold" />
                <span className="flex-1">
                  {error} Tus fotos y tu descripción siguen aquí.
                </span>
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
            <p className="flex flex-wrap items-center gap-2 rounded-xl border border-amber/40 bg-amber-soft p-3 text-sm">
              <Key weight="bold" /> {missingKey}
              <Button variant="ghost" className="min-h-8 px-2 underline" onClick={() => openSettings(true)}>
                Configurar
              </Button>
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            <Button variant="ghost" onClick={() => setStep('measures')}>
              <ArrowLeft /> {withMeasures ? 'Medidas' : 'Poner medidas'}
            </Button>
            <div className="flex items-center gap-3">
              {missingRequired.length > 0 && photos.length > 0 && <span className="hidden text-xs text-graphite-2 sm:inline">Falta: {missingRequired.map((a) => a.name).join(', ')}</span>}
              <Button variant="primary" className="min-h-12 px-6" disabled={!canAnalyze} onClick={analyzeCapture}>
                {withoutPhotos ? 'Diseñar sin fotos' : 'Analizar'} <ArrowRight weight="bold" />
              </Button>
            </div>
          </div>
        </>
      )}
    </main>
  )
}
