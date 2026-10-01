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

const VARIANTS = {
  card: { base: 'relative min-h-11 cursor-pointer border transition', on: 'border-graphite bg-amber-soft', off: 'border-line hover:bg-kraft' },
  pill: { base: 'relative cursor-pointer rounded-full border transition', on: 'border-graphite bg-graphite text-bone', off: 'border-line bg-bone text-graphite-2 hover:text-graphite' },
  segment: { base: 'relative cursor-pointer rounded-full transition', on: 'bg-graphite text-bone', off: 'text-graphite-2 hover:text-graphite' },
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
        <span aria-hidden className="pointer-events-none absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-graphite text-bone">
          <Check weight="bold" size={12} />
        </span>
      )}
    </label>
  )
}
