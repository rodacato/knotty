import { ArrowRight } from '@phosphor-icons/react'
import { viewLabel } from '../../domain/furniture/reading/reading'
import { useId, useMemo, useState } from 'react'
import { currentPlan } from '../../application/useCases'
import type { Geometry } from '../../domain/design/resolve'
import { currentDesign, type DesignState } from '../../domain/session/state'
import { Button } from '../system/components'
import { KindSelect } from '../system/KindSelect'
import { KIND_NOUN, kindLabel, type DesignKind, type KindSource } from '../../domain/design/kind'
import { kindOf } from '../../domain/furniture/kind'
import { useExpertStatus } from '../shell/expertStatus'
import { useStore } from '../store'
import { PieceList } from './Panels'
import { PlanSheet } from './PlanSheet'
import { PartsList } from './PartsList'
import { StepRow } from './StepRow'
import { StepTitle } from './StepStrip'
import { draftOf } from '../store'

// Editing the furniture from outside (UI-74): its kind, the parts of its plan when it has one, the photos and, without a plan, its pieces.

const SOURCE: Record<KindSource, string | null> = {
  person: 'Lo elegiste tú.',
  example: null,
  plan: 'Knotty lo sabe por cómo se armó.',
  photo: 'Knotty lo vio en tus fotos.',
  words: 'Knotty lo dedujo de tus palabras.',
}

/** What the furniture is: it decides which checks by use apply and how the expert is asked. Another module's kind cannot come from this plan, so it is designed again. */
/** `panel`: the kind is the open step of the strip, so it is always open and titled as the strip names it. */
function KindPicker({ state, open, onToggle, panel = false }: { state: DesignState; open: boolean; onToggle: () => void; panel?: boolean }) {
  const chooseKind = useStore((s) => s.chooseKind)
  const redoAs = useStore((s) => s.redoAs)
  const openConnect = useStore((s) => s.openConnect)
  const { available } = useExpertStatus()
  const thinking = useStore((s) => s.thinking)
  const [redo, setRedo] = useState<DesignKind | null>(null)
  const [error, setError] = useState<string | null>(null)
  const id = useId()
  const draft = useStore(draftOf)
  const design = draft?.design ?? currentDesign(state)
  const known = kindOf(design)
  const source = known.source ? SOURCE[known.source] : 'Knotty no sabe qué mueble es: elígelo para que revise lo que le toca.'
  // Only a bookcase's shelves are judged with a heavy load: the kind is how the person says what they carry.
  const said = [source, known.kind === 'bookcase' ? 'Sus repisas se revisan con el peso de libros.' : null].filter(Boolean).join(' ')
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
  // A choice still waiting on the person keeps the step open.
  const expanded = panel || open || !!redo || !!error
  return (
    <section className={panel ? 'flex flex-col gap-3 p-4' : 'flex flex-col border-b border-line'}>
      {panel ? <StepTitle number={1} name="Tipo de mueble" /> : <StepRow number={1} name="Tipo de mueble" summary={current ? kindLabel(current) : 'Sin decidir'} active={expanded} onToggle={onToggle} />}
      {expanded && (
      <div className={`flex flex-col gap-2 ${panel ? '' : 'p-4'}`}>
      <label htmlFor={id} className="sr-only">
        Tipo de mueble
      </label>
      <KindSelect id={id} value={redo ?? current} onChange={choose} none="Sin decidir" disabled={thinking || !!draft} />
      {draft && <p className="text-sm text-graphite-2">Aplica o descarta tu cambio para elegir el tipo.</p>}
      {!draft && !redo && !error && said && <p className="text-sm text-graphite-2">{said}</p>}
      {error && <p className="text-xs text-rust">{error}</p>}
      {redo && (
        <div className="flex flex-col gap-2 rounded-xl border border-line bg-kraft p-3 text-sm">
          <p>
            {capitalized(KIND_NOUN[redo])} no sale de la ficha de {current ? KIND_NOUN[current] : 'este mueble'}: hay que diseñarla de nuevo con el experto, con tu descripción y las medidas de ahora como referencia. Lo
            de ahora se queda en el historial.
          </p>
          <div className="flex flex-wrap gap-2">
            {available ? (
              <Button
                variant="primary"
                onClick={() => {
                  setRedo(null)
                  void redoAs(redo)
                }}
              >
                Rehacer como {KIND_NOUN[redo].replace(/^una? /, '')}
              </Button>
            ) : (
              <Button variant="primary" onClick={() => openConnect(true)}>
                Conectar experto <ArrowRight weight="bold" />
              </Button>
            )}
            <Button variant="ghost" onClick={() => setRedo(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
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

/** `strip`: the steps are on the strip above (UI-93), so this shows only the open one. */
export function OutsideList({ state, geo, strip = false }: { state: DesignState; geo: Geometry | null; strip?: boolean }) {
  const source = useMemo(() => currentPlan(state), [state])
  const hasPlan = !!source.plan
  const draft = useStore(draftOf)
  // A plan is edited by its parts (UI-39); one the expert left behind keeps its sheet, with what applying it would lose.
  const plan = !source.diverged ? (draft?.plan ?? source.plan) : null
  // One step open at a time (UI-92): opening the kind closes the part, and opening a part closes the kind.
  const part = useStore((s) => s.part)
  const selectPart = useStore((s) => s.selectPart)
  const [kindOpen, setKindOpen] = useState(false)
  const toggleKind = () => {
    if (kindOpen && !part) return setKindOpen(false)
    selectPart(null)
    setKindOpen(true)
  }
  if (strip && plan)
    return (
      <PartsList
        state={state}
        plan={plan}
        side="outside"
        first={2}
        kindStep={
          <>
            <KindPicker state={state} open onToggle={() => {}} panel />
            <Photos state={state} />
          </>
        }
      />
    )
  return (
    <div className="flex flex-col">
      <KindPicker state={state} open={kindOpen && !part} onToggle={toggleKind} />
      {plan ? (
        <PartsList state={state} plan={plan} side="outside" first={2} />
      ) : hasPlan ? (
        <PlanSheet state={state} />
      ) : (
        <p className="px-4 pt-4 text-sm text-graphite">Este mueble no tiene ficha: se ajusta con el experto o editando cada pieza en el 3D.</p>
      )}
      <Photos state={state} />
      {!hasPlan && geo && <PieceList design={currentDesign(state)} geo={geo} />}
    </div>
  )
}
