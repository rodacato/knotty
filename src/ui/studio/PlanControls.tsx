import { Minus, Plus } from '@phosphor-icons/react'

// The small controls of a plan: choices, counts and measures.

/** A module's labels as the buttons of a choice, in their order. */
export const optionsOf = (labels: Record<string, { option: string }>) => Object.entries(labels).map(([value, { option }]): [string, string] => [value, option])

export function Segmented({ value, options, onChange, label }: { value: string; options: [string, string][]; onChange: (v: string) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full border border-line bg-bone p-0.5">
      {options.map(([id, text]) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          onClick={() => onChange(id)}
          className={`rounded-full px-2.5 py-1 text-xs transition ${value === id ? 'bg-graphite text-bone' : 'text-graphite-2 hover:text-graphite'}`}
        >
          {text}
        </button>
      ))}
    </div>
  )
}

export function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (v: number) => void; label: string }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={label}>
      <button type="button" aria-label={`Menos ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)} className="grid size-6 place-items-center rounded-full border border-line disabled:opacity-30">
        <Minus size={10} />
      </button>
      <span className="numerals w-5 text-center text-xs">{value}</span>
      <button type="button" aria-label={`Más ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)} className="grid size-6 place-items-center rounded-full border border-line disabled:opacity-30">
        <Plus size={10} />
      </button>
    </span>
  )
}

export function NumberField({ value, onChange, label, suffix, min = 1 }: { value: number; onChange: (v: number) => void; label: string; suffix: string; min?: number }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-graphite-2">{label}</span>
      <span className="flex items-baseline gap-1 rounded-xl border border-line bg-bone px-2 focus-within:border-amber">
        <input type="number" inputMode="numeric" min={min} value={value || value === min ? value : ''} onChange={(e) => onChange(Number(e.target.value))} className="numerals min-h-9 w-full bg-transparent outline-none" />
        <span className="numerals text-xs text-graphite-2">{suffix}</span>
      </span>
    </label>
  )
}
