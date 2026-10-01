import { CaretDown, CaretUp, Notebook, Plus, X } from '@phosphor-icons/react'
import { useId, useState, type ReactNode } from 'react'
import type { DesignState } from '../../domain/session/state'
import { Button } from '../system/components'
import { Input } from '../system/Field'
import { useStore } from '../store'

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <p className="text-sm text-graphite-2">{label}</p>
      {children}
    </div>
  )
}

function Chips({ items }: { items: { key: string; text: string; onRemove: () => void }[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <li key={i.key} className="animate-appear inline-flex min-h-9 items-center gap-1 rounded-full border border-line bg-bone py-0.5 pr-1 pl-3 text-sm text-graphite">
          <span className="leading-snug">{i.text}</span>
          <button
            type="button"
            onClick={i.onRemove}
            aria-label={`Quitar: ${i.text}`}
            className="grid size-7 shrink-0 place-items-center rounded-full text-graphite-2 hover:text-rust"
          >
            <X size={14} />
          </button>
        </li>
      ))}
    </ul>
  )
}

/** What the expert remembers between changes, folded above the conversation: the person's requirements and the design decisions. */
export function Memory({ state }: { state: DesignState }) {
  const addNote = useStore((s) => s.addNote)
  const removeNote = useStore((s) => s.removeNote)
  const removeDecision = useStore((s) => s.removeDecision)
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const body = useId()
  const count = state.requirements.length + state.decisions.length
  return (
    <section className="shrink-0 border-b border-line bg-kraft">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={body}
        className="flex min-h-11 w-full items-center gap-2.5 px-4 text-left text-graphite focus-visible:-outline-offset-2"
      >
        <Notebook size={18} />
        <span className="flex-1 text-[15px] font-medium">Lo que el experto recuerda</span>
        <span className="numerals text-sm text-graphite-2">{count}</span>
        {open ? <CaretUp className="text-graphite-2" /> : <CaretDown className="text-graphite-2" />}
      </button>
      {open && (
        <div id={body} className="flex max-h-[45vh] flex-col gap-3 overflow-y-auto px-4 pb-3">
          <p className="text-sm text-graphite">Se lo recuerda en cada cambio. Quita lo que ya no aplique.</p>
          <Group label="Tus requisitos">
            {state.requirements.length ? (
              <Chips items={state.requirements.map((r) => ({ key: r.id, text: r.text, onRemove: () => removeNote(r.id) }))} />
            ) : (
              <p className="text-sm text-graphite">Nada todavía: dile al experto cosas como «mi espacio mide 90 cm».</p>
            )}
          </Group>
          {state.decisions.length > 0 && (
            <Group label="Decisiones de diseño">
              <Chips items={state.decisions.map((d) => ({ key: d.topic, text: d.text, onRemove: () => removeDecision(d.topic) }))} />
            </Group>
          )}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              addNote(note)
              setNote('')
            }}
          >
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Agregar una nota: «lo voy a pintar»" aria-label="Nota para el experto" className="flex-1" />
            <Button type="submit" variant="secondary" className="min-h-11 px-3" disabled={!note.trim()} aria-label="Agregar nota">
              <Plus weight="bold" />
            </Button>
          </form>
        </div>
      )}
    </section>
  )
}
