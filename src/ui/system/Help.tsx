import { BookOpen, Question, X } from '@phosphor-icons/react'
import { useState } from 'react'
import type { Term } from '../glossary'

// Help opens on tap, never on hover: a touch screen has no hover, so a tooltip would never show.

/** Which help is open in a group of controls: one at a time. */
export function useHelp<K extends string>() {
  const [open, setOpen] = useState<K | null>(null)
  return { open, toggle: (key: K) => setOpen((k) => (k === key ? null : key)), close: () => setOpen(null) }
}

/** The ? beside a term: 44 px to touch, a small mark to see. */
export function HelpButton({ term, open, onToggle }: { term: Term; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-label={open ? `Cerrar la ayuda de ${term.name}` : `Qué es ${term.name}`}
      onClick={(e) => {
        e.preventDefault()
        onToggle()
      }}
      className="-my-2.5 grid size-11 shrink-0 place-items-center rounded-full"
    >
      <span className={`grid size-5 place-items-center rounded-full transition ${open ? 'bg-graphite text-bone' : 'bg-kraft text-graphite'}`}>
        <Question size={12} weight="bold" />
      </span>
    </button>
  )
}

/** What a term means, in place, under the control that uses it. */
export function HelpPanel({ term, onClose }: { term: Term; onClose: () => void }) {
  return (
    <div role="note" className="animate-appear flex flex-col gap-1.5 rounded-xl border border-line bg-paper p-3 text-[13px] leading-snug">
      <p className="flex items-center gap-1.5 font-semibold">
        <BookOpen className="shrink-0" /> <span className="flex-1">{term.name}</span>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="relative -my-2 -mr-2 grid size-9 place-items-center rounded-full text-graphite-2 before:absolute before:-inset-1 before:content-[''] hover:bg-kraft">
          <X />
        </button>
      </p>
      <p>{term.meaning}</p>
      {term.note && <p className="text-graphite-2">{term.note}</p>}
    </div>
  )
}
