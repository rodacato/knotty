import { Check } from '@phosphor-icons/react'
import { createContext, useContext, useId, type ReactNode } from 'react'

const GroupName = createContext<string | undefined>(undefined)

/** Radios that share a name: the browser gives one tab stop and arrow keys inside. */
export function RadioGroup({ label, className = '', children }: { label?: string; className?: string; children: ReactNode }) {
  const name = useId()
  return (
    <GroupName.Provider value={name}>
      <div role="radiogroup" aria-label={label} className={className}>
        {children}
      </div>
    </GroupName.Provider>
  )
}

// Square and ruled, like the boxes of a printed form (UI-93): the chosen one is ink.
const VARIANTS = {
  card: { base: 'relative min-h-11 cursor-pointer border-2 transition', on: 'border-graphite bg-select-soft outline-2 -outline-offset-4 outline-graphite', off: 'border-graphite hover:bg-kraft' },
  pill: { base: 'relative cursor-pointer border-2 transition', on: 'border-graphite bg-graphite text-bone', off: 'border-graphite bg-bone text-graphite hover:bg-kraft' },
  segment: { base: 'relative cursor-pointer transition', on: 'bg-graphite text-bone', off: 'text-graphite hover:bg-kraft' },
  bare: { base: 'cursor-pointer', on: '', off: '' },
}

const FOCUS = 'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus'

/** A native radio under a styled label; `card` also draws the check on the corner, `bare` leaves the look to its parent. */
export function RadioCard({
  checked,
  onChange,
  variant = 'card',
  mark = variant === 'card',
  disabled,
  label,
  className = '',
  children,
}: {
  checked: boolean
  onChange: () => void
  variant?: keyof typeof VARIANTS
  mark?: boolean
  disabled?: boolean
  label?: string
  className?: string
  children: ReactNode
}) {
  const name = useContext(GroupName)
  const v = VARIANTS[variant]
  return (
    <label className={`${v.base} ${checked ? v.on : v.off} ${FOCUS} has-[:disabled]:cursor-default has-[:disabled]:opacity-40 ${className}`}>
      <input type="radio" name={name} checked={checked} disabled={disabled} aria-label={label} onChange={onChange} className="sr-only" />
      {children}
      {mark && checked && (
        <span aria-hidden className="pointer-events-none absolute top-0 right-0 grid size-8 place-items-center bg-graphite text-bone">
          <Check weight="bold" size={18} />
        </span>
      )}
    </label>
  )
}
