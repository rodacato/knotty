import { RadioCard, RadioGroup } from '../system/RadioCard'
import { LockSimple, LockSimpleOpen, Minus, Plus } from '@phosphor-icons/react'
import type { ReactNode } from 'react'

// The small controls of a plan: choices, counts, measures and the lock that keeps «Ahorrar material» off a field.

export function Segmented({ value, options, onChange, label }: { value: string; options: readonly (readonly [string, string])[]; onChange: (v: string) => void; label: string }) {
  return (
    <RadioGroup label={label} className="inline-flex rounded-full border border-line bg-bone p-0.5">
      {options.map(([id, text]) => (
        <RadioCard key={id} variant="segment" checked={value === id} onChange={() => onChange(id)} className="px-2.5 py-1 text-xs before:absolute before:-inset-x-0.5 before:-inset-y-2.5 before:content-['']">
          {text}
        </RadioCard>
      ))}
    </RadioGroup>
  )
}

/** A choice as cards, each with its drawing over its name; always three across, so a card is the same size in every choice. */
export function OptionCards({ value, options, diagrams, onChange, label }: { value: string; options: readonly (readonly [string, string])[]; diagrams: Record<string, ReactNode>; onChange: (v: string) => void; label: string }) {
  return (
    <RadioGroup label={label} className="grid grid-cols-3 gap-2">
      {options.map(([id, text]) => (
        <RadioCard key={id} checked={value === id} onChange={() => onChange(id)} className="flex flex-col items-center gap-1 rounded-2xl px-2 pt-2 pb-1.5 text-center text-xs font-medium">
          {diagrams[id]}
          {text}
        </RadioCard>
      ))}
    </RadioGroup>
  )
}

export function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (v: number) => void; label: string }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={label}>
      <button type="button" aria-label={`Menos ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)} className="relative grid size-6 place-items-center rounded-full border border-line before:absolute before:-inset-[11px] before:content-[''] disabled:opacity-30">
        <Minus size={10} />
      </button>
      <span className="numerals w-5 text-center text-xs">{value}</span>
      <button type="button" aria-label={`Más ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)} className="relative grid size-6 place-items-center rounded-full border border-line before:absolute before:-inset-[11px] before:content-[''] disabled:opacity-30">
        <Plus size={10} />
      </button>
    </span>
  )
}

/** 44 px to touch, 28 px to see: filled when locked, outlined when free. */
export function LockToggle({ locked, name, onToggle }: { locked: boolean; name: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={locked}
      aria-label={`Fijar ${name.charAt(0).toLowerCase()}${name.slice(1)}`}
      onClick={(e) => {
        e.preventDefault()
        onToggle()
      }}
      className="-my-2 -ml-2 grid size-11 shrink-0 place-items-center rounded-full"
    >
      <span className={`grid size-7 place-items-center rounded-full transition ${locked ? 'bg-graphite text-bone' : 'border border-line text-graphite-2'}`}>
        {locked ? <LockSimple size={14} weight="fill" /> : <LockSimpleOpen size={14} />}
      </span>
    </button>
  )
}
