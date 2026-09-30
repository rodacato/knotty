import { CaretDown } from '@phosphor-icons/react'
import { useEffect, useId, useRef, useState } from 'react'
import { FINISH_IDS, FINISH_LOOK, FINISHES, type FinishId } from '../../domain/materials/finishes'

/** A finish is chosen by how it looks, so each option carries the colour it settles on. */
const Dot = ({ finish }: { finish: FinishId }) => <span aria-hidden className="size-4 shrink-0 rounded-full border border-line" style={{ backgroundColor: FINISH_LOOK[finish].color }} />

export function FinishSelect({ value, onChange }: { value: FinishId; onChange: (finish: FinishId) => void }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(FINISH_IDS.indexOf(value))
  const root = useRef<HTMLDivElement>(null)
  const list = useId()

  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => root.current && !root.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])

  const choose = (finish: FinishId) => {
    setOpen(false)
    onChange(finish)
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') return setOpen(false)
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) return setOpen(true)
      setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : FINISH_IDS.length - 1)) % FINISH_IDS.length)
    }
    if ((e.key === 'Enter' || e.key === ' ') && open) {
      e.preventDefault()
      choose(FINISH_IDS[active])
    }
  }

  return (
    <div ref={root} className="relative" onKeyDown={onKey}>
      <button
        type="button"
        role="combobox"
        aria-label="Acabado"
        aria-expanded={open}
        aria-controls={list}
        onClick={() => (setActive(FINISH_IDS.indexOf(value)), setOpen(!open))}
        className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-line bg-bone px-3 text-left text-sm"
      >
        <Dot finish={value} />
        <span className="flex-1">{FINISHES[value].name}</span>
        <CaretDown size={14} />
      </button>
      {open && (
        <ul id={list} role="listbox" aria-label="Acabados" className="absolute z-20 mt-1 flex max-h-72 w-full flex-col overflow-auto rounded-xl border border-line bg-bone p-1 shadow-lg">
          {FINISH_IDS.map((id, i) => (
            <li
              key={id}
              role="option"
              aria-selected={id === value}
              onPointerEnter={() => setActive(i)}
              onClick={() => choose(id)}
              className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm ${i === active ? 'bg-kraft' : ''} ${id === value ? 'font-medium' : ''}`}
            >
              <Dot finish={id} />
              {FINISHES[id].name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
