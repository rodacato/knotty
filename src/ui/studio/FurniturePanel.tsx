import { Plus, X } from '@phosphor-icons/react'
import { angleLabel } from '../../domain/furniture/reading/reading'
import { useMemo, useState } from 'react'
import { currentPlan } from '../../application/useCases'
import type { Geometry } from '../../domain/design/resolve'
import { currentDesign, type DesignState } from '../../domain/session/state'
import { Button } from '../system/components'
import { KindSelect } from '../system/KindSelect'
import { KIND_NOUN, type DesignKind, type KindSource } from '../../domain/design/kind'
import { kindOf } from '../../domain/furniture/kind'
import { useStore } from '../store'
import { PieceList } from './Panels'
import { PlanSheet } from './PlanSheet'

// The furniture as decided: its plan when it has one, what the expert remembers, the photos and, without a plan, its pieces.

/** What the expert remembers between changes: the person's requirements and design decisions, which can be removed or added to. */
function Memory({ state }: { state: DesignState }) {
  const addNote = useStore((s) => s.addNote)
  const removeNote = useStore((s) => s.removeNote)
  const removeDecision = useStore((s) => s.removeDecision)
  const [note, setNote] = useState('')
  const item = (text: string, onRemove: () => void, key: string) => (
    <li key={key} className="animate-appear flex items-start gap-2 rounded-xl bg-kraft px-3 py-2 text-sm">
      <span className="flex-1 leading-snug">{text}</span>
      <button type="button" onClick={onRemove} aria-label={`Quitar: ${text}`} className="mt-0.5 text-graphite-2 hover:text-rust">
        <X size={14} />
      </button>
    </li>
  )
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-bone p-4">
      <div>
        <h3 className="font-display text-base font-semibold">Lo que el experto recuerda</h3>
        <p className="text-xs text-graphite-2">Se lo recuerda en cada cambio. Quita lo que ya no aplique.</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-medium tracking-wide text-graphite-2 uppercase">Tus requisitos</p>
        {state.requirements.length ? (
          <ul className="flex flex-col gap-1.5">{state.requirements.map((r) => item(r.text, () => removeNote(r.id), r.id))}</ul>
        ) : (
          <p className="text-sm text-graphite-2">Nada todavía: dile al experto cosas como «mi espacio mide 90 cm».</p>
        )}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            addNote(note)
            setNote('')
          }}
        >
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Agregar una nota: «lo voy a pintar»"
            aria-label="Nota para el experto"
            className="min-h-10 flex-1 rounded-xl border border-line bg-bone px-3 text-sm outline-none focus:border-amber"
          />
          <Button type="submit" variant="secondary" className="min-h-10 px-3" disabled={!note.trim()} aria-label="Agregar nota">
            <Plus weight="bold" />
          </Button>
        </form>
      </div>
      {state.decisions.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium tracking-wide text-graphite-2 uppercase">Decisiones de diseño</p>
          <ul className="flex flex-col gap-1.5">{state.decisions.map((d) => item(d.text, () => removeDecision(d.topic), d.topic))}</ul>
        </div>
      )}
    </section>
  )
}

const SOURCE: Record<KindSource, string> = {
  person: 'Lo elegiste tú.',
  example: 'Lo dice el ejemplo.',
  plan: 'Knotty lo sabe por cómo se armó.',
  photo: 'Knotty lo vio en tus fotos.',
  words: 'Knotty lo dedujo de tus palabras.',
}

/** What the furniture is: it decides which checks by use apply and how the expert is asked. Another module's kind cannot come from this plan, so it is designed again. */
function KindPicker({ state }: { state: DesignState }) {
  const chooseKind = useStore((s) => s.chooseKind)
  const redoAs = useStore((s) => s.redoAs)
  const thinking = useStore((s) => s.thinking)
  const [redo, setRedo] = useState<DesignKind | null>(null)
  const [error, setError] = useState<string | null>(null)
  const design = currentDesign(state)
  const known = kindOf(design)
  const current = known.kind === 'unknown' ? null : known.kind
  const choose = (kind: DesignKind | null) => {
    setError(null)
    setRedo(null)
    if (!kind) return
    const r = chooseKind(kind)
    if (r.ok) return
    if ('redo' in r) setRedo(kind)
    else setError(r.message)
  }
  return (
    <section className="flex flex-col gap-2 px-4 pt-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Tipo de mueble</span>
        <KindSelect value={redo ?? current} onChange={choose} none="Sin decidir" disabled={thinking} />
      </label>
      {!redo && <p className="text-xs text-graphite-2">{known.source ? SOURCE[known.source] : 'Knotty no sabe qué mueble es: elígelo para que revise lo que le toca.'}</p>}
      {error && <p className="text-xs text-rust">{error}</p>}
      {redo && (
        <div className="flex flex-col gap-2 rounded-xl border border-amber/40 bg-amber-soft p-3 text-sm">
          <p>
            {capitalized(KIND_NOUN[redo])} no sale de la ficha de {current ? KIND_NOUN[current] : 'este mueble'}: hay que diseñarla de nuevo con el experto, con tu descripción y las medidas de ahora como referencia. Lo
            de ahora se queda en el historial.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              onClick={() => {
                setRedo(null)
                void redoAs(redo)
              }}
            >
              Rehacer como {KIND_NOUN[redo].replace(/^una? /, '')}
            </Button>
            <Button variant="ghost" onClick={() => setRedo(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

function Photos({ state }: { state: DesignState }) {
  if (!state.thumbnails.length) return null
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-display text-base font-semibold">Tus fotos</h3>
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {state.thumbnails.map((m) => (
          <figure key={m.angle} className="flex shrink-0 flex-col items-center gap-1">
            <img src={m.dataUrl} alt={`Foto ${angleLabel(m.angle)}`} className="size-20 rounded-xl border border-line object-cover" />
            <figcaption className="text-[11px] text-graphite-2">{angleLabel(m.angle)}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}

export function FurniturePanel({ state, geo }: { state: DesignState; geo: Geometry | null }) {
  const hasPlan = useMemo(() => !!currentPlan(state).plan, [state])
  return (
    <div className="flex flex-col">
      <KindPicker state={state} />
      {hasPlan ? (
        <PlanSheet state={state} />
      ) : (
        <p className="px-4 pt-4 text-sm text-graphite-2">Este mueble no tiene ficha: se ajusta con el experto o editando cada pieza en el 3D.</p>
      )}
      <div className="flex flex-col gap-4 p-4">
        <Memory state={state} />
        <Photos state={state} />
      </div>
      {!hasPlan && geo && <PieceList design={currentDesign(state)} geo={geo} />}
    </div>
  )
}
