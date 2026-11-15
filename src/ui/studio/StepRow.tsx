import { CaretDown, CaretUp } from '@phosphor-icons/react'
import type { Ref } from 'react'

// One row of the numbered steps (UI-92) where they are a list (a phone, the inside): closed it says the step and how it is now in one line; open its number is a solid ink block, as the open cell of the strip (UI-93).

export function StepRow({ number, name, summary, active, onToggle, ref }: { number: number; name: string; summary?: string; active: boolean; onToggle: () => void; ref?: Ref<HTMLButtonElement> }) {
  return (
    <button
      ref={ref}
      type="button"
      aria-expanded={active}
      onClick={onToggle}
      title={!active && summary ? `${name} · ${summary}` : undefined}
      className={`grid min-h-14 w-full grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-2.5 text-left hover:bg-kraft focus-visible:outline-2 focus-visible:outline-focus ${active ? 'border-b-2 border-graphite' : ''}`}
    >
      <span className={`numerals grid size-7 place-items-center ${active ? 'bg-graphite font-semibold text-bone' : 'text-graphite'}`}>{number}</span>
      <span className="truncate">
        <span className={`font-display uppercase ${active ? 'font-semibold' : 'font-medium'}`}>{name}</span>
        {!active && summary && <span className="text-graphite-2"> · {summary}</span>}
      </span>
      {active ? <CaretUp className="text-graphite" aria-hidden /> : <CaretDown className="text-graphite-2" aria-hidden />}
    </button>
  )
}
