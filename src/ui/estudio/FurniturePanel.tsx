import { Plus, X } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { currentPlan } from '../../application/casosDeUso'
import type { Geometria } from '../../domain/diseno/resolver'
import { disenoActual, type EstadoDiseno } from '../../domain/sesion/estado'
import { Boton } from '../sistema/componentes'
import { useTienda } from '../tienda'
import { Piezas } from './Paneles'
import { PlanSheet } from './PlanSheet'

// The furniture as decided: its ficha when it has one, what the expert remembers, the photos and, without a ficha, its pieces.

/** What the expert remembers between changes: the person's requirements and design decisions, which can be removed or added to. */
function Memory({ estado }: { estado: EstadoDiseno }) {
  const addNote = useTienda((s) => s.agregarNota)
  const removeNote = useTienda((s) => s.quitarNota)
  const removeDecision = useTienda((s) => s.quitarDecision)
  const [note, setNote] = useState('')
  const item = (text: string, onRemove: () => void, key: string) => (
    <li key={key} className="animate-aparecer flex items-start gap-2 rounded-xl bg-kraft px-3 py-2 text-sm">
      <span className="flex-1 leading-snug">{text}</span>
      <button type="button" onClick={onRemove} aria-label={`Quitar: ${text}`} className="mt-0.5 text-grafito-2 hover:text-oxido">
        <X size={14} />
      </button>
    </li>
  )
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-linea bg-hueso p-4">
      <div>
        <h3 className="font-titulo text-base font-semibold">Lo que el experto recuerda</h3>
        <p className="text-xs text-grafito-2">Se lo recuerda en cada cambio. Quita lo que ya no aplique.</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-medium tracking-wide text-grafito-2 uppercase">Tus requisitos</p>
        {estado.requisitos.length ? (
          <ul className="flex flex-col gap-1.5">{estado.requisitos.map((r) => item(r.texto, () => removeNote(r.id), r.id))}</ul>
        ) : (
          <p className="text-sm text-grafito-2">Nada todavía: dile al experto cosas como «mi espacio mide 90 cm».</p>
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
            className="min-h-10 flex-1 rounded-xl border border-linea bg-hueso px-3 text-sm outline-none focus:border-ambar"
          />
          <Boton type="submit" variante="secundario" className="min-h-10 px-3" disabled={!note.trim()} aria-label="Agregar nota">
            <Plus weight="bold" />
          </Boton>
        </form>
      </div>
      {estado.decisiones.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium tracking-wide text-grafito-2 uppercase">Decisiones de diseño</p>
          <ul className="flex flex-col gap-1.5">{estado.decisiones.map((d) => item(d.texto, () => removeDecision(d.tema), d.tema))}</ul>
        </div>
      )}
    </section>
  )
}

function Photos({ estado }: { estado: EstadoDiseno }) {
  if (!estado.miniaturas.length) return null
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-titulo text-base font-semibold">Tus fotos</h3>
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {estado.miniaturas.map((m) => (
          <figure key={m.angulo} className="flex shrink-0 flex-col items-center gap-1">
            <img src={m.dataUrl} alt={`Foto ${m.angulo}`} className="size-20 rounded-xl border border-linea object-cover" />
            <figcaption className="text-[11px] text-grafito-2">{m.angulo}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}

export function FurniturePanel({ estado, geo }: { estado: EstadoDiseno; geo: Geometria | null }) {
  const hasPlan = useMemo(() => !!currentPlan(estado).plan, [estado])
  return (
    <div className="flex flex-col">
      {hasPlan ? (
        <PlanSheet estado={estado} />
      ) : (
        <p className="px-4 pt-4 text-sm text-grafito-2">Este mueble no tiene ficha: se ajusta con el experto o editando cada pieza en el 3D.</p>
      )}
      <div className="flex flex-col gap-4 p-4">
        <Memory estado={estado} />
        <Photos estado={estado} />
      </div>
      {!hasPlan && geo && <Piezas diseno={disenoActual(estado)} geo={geo} />}
    </div>
  )
}
