import { CaretDown } from '@phosphor-icons/react'
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

// Every control is 16 px: below that, iOS Safari zooms the page when the control takes focus.

type Size = 'md' | 'sm'

const FRAME = 'rounded-xl border bg-bone text-base text-graphite outline-none transition focus:border-amber focus-within:border-amber disabled:opacity-60 has-disabled:opacity-60'
const HEIGHT: Record<Size, string> = { md: 'min-h-11 px-3', sm: 'min-h-8 px-2' }
const border = (invalid?: boolean) => (invalid ? 'border-rust' : 'border-line')

/** A control with its label on top and, under it, an error or a help line. */
export function Field({ label, help, error, className = '', children }: { label: ReactNode; help?: ReactNode; error?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-sm text-graphite-2">{label}</span>
      {children}
      {error ? <span className="text-xs text-rust">{error}</span> : help && <span className="text-xs text-graphite">{help}</span>}
    </label>
  )
}

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & { size?: Size; invalid?: boolean; unit?: string; end?: ReactNode }

/** A text or number input; `unit` and `end` sit inside the box, after the value. */
export function Input({ size = 'md', invalid, unit, end, className = '', ...props }: InputProps) {
  const numeric = props.type === 'number' || props.inputMode === 'numeric' || props.inputMode === 'decimal'
  const box = `${FRAME} ${HEIGHT[size]} ${border(invalid)} ${numeric ? 'numerals' : ''} ${className}`
  if (!unit && !end) return <input aria-invalid={invalid || undefined} className={box} {...props} />
  return (
    <span className={`flex items-center gap-2 ${box}`}>
      <input aria-invalid={invalid || undefined} className="w-full min-w-0 self-stretch bg-transparent outline-none" {...props} />
      {unit && <span className="numerals text-xs text-graphite-2">{unit}</span>}
      {end}
    </span>
  )
}

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> & { size?: Size; invalid?: boolean }

export function Select({ size = 'md', invalid, className = '', ...props }: SelectProps) {
  return (
    <span className={`relative flex ${className}`}>
      <select aria-invalid={invalid || undefined} className={`w-full appearance-none pr-8 ${FRAME} ${HEIGHT[size]} ${border(invalid)}`} {...props} />
      <CaretDown className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-graphite-2" />
    </span>
  )
}

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }

export function TextArea({ invalid, className = '', ...props }: TextAreaProps) {
  return <textarea aria-invalid={invalid || undefined} className={`${FRAME} ${border(invalid)} px-3 py-2.5 ${className}`} {...props} />
}
