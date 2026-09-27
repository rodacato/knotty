import { viewLabel } from '../../domain/furniture/reading/reading'
import { useMemo, useState } from 'react'
import { currentPlan } from '../../application/useCases'
import type { Geometry } from '../../domain/design/resolve'
import { currentDesign, type DesignState } from '../../domain/session/state'
import { Button } from '../system/components'
import { Field } from '../system/Field'
import { KindSelect } from '../system/KindSelect'
import { KIND_NOUN, type DesignKind, type KindSource } from '../../domain/design/kind'
import { kindOf } from '../../domain/furniture/kind'
import { useStore } from '../store'
import { PieceList } from './Panels'
import { PlanSheet } from './PlanSheet'

// The furniture as decided: its kind, its plan when it has one, the photos and, without a plan, its pieces.

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
      <Field label="Tipo de mueble" error={error} help={!redo && (known.source ? SOURCE[known.source] : 'Knotty no sabe qué mueble es: elígelo para que revise lo que le toca.')}>
        <KindSelect value={redo ?? current} onChange={choose} none="Sin decidir" disabled={thinking} />
      </Field>
      {redo && (
        <div className="flex flex-col gap-2 rounded-xl border border-line bg-kraft p-3 text-sm">
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
    <section className="flex flex-col gap-2 p-4">
      <h3 className="font-display text-base font-semibold">Tus fotos</h3>
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {state.thumbnails.map((m, i) => (
          <figure key={i} className="flex shrink-0 flex-col items-center gap-1">
            <img src={m.dataUrl} alt={m.view ? `Foto: ${viewLabel(m.view)}` : `Foto ${i + 1}`} className="size-20 rounded-xl border border-line object-cover" />
            {m.view && <figcaption className="text-xs text-graphite-2">{viewLabel(m.view)}</figcaption>}
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
        <p className="px-4 pt-4 text-sm text-graphite">Este mueble no tiene ficha: se ajusta con el experto o editando cada pieza en el 3D.</p>
      )}
      <Photos state={state} />
      {!hasPlan && geo && <PieceList design={currentDesign(state)} geo={geo} />}
    </div>
  )
}
