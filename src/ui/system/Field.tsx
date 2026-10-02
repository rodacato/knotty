import { CaretDown } from '@phosphor-icons/react'
import { createContext, useContext, useId } from 'react'
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

// Every control is 16 px: below that, iOS Safari zooms the page when the control takes focus.

type Size = 'md' | 'sm'

const FRAME = 'rounded-xl border bg-bone text-base text-graphite outline-none transition focus:border-focus focus-within:border-focus disabled:opacity-60 has-disabled:opacity-60'
const PLACEHOLDER = 'placeholder:text-graphite-2'
const HEIGHT: Record<Size, string> = { md: 'min-h-11 px-3', sm: 'min-h-8 px-2' }
const border = (invalid?: boolean) => (invalid ? 'border-rust' : 'border-line')

const FieldContext = createContext<{ id?: string; describedBy?: string; invalid: boolean }>({ invalid: false })

/** An error line announced as soon as it appears; `id` is what the control's `aria-describedby` points at. */
export function ErrorText({ id, className = '', children }: { id?: string; className?: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className={`text-xs text-rust ${className}`}>
      {children}
    </p>
  )
}

/** A control with its label on top and, under it, an error or a help line; a hidden label takes no room. */
export function Field({ label, hiddenLabel = false, help, error, className = '', children }: { label: ReactNode; hiddenLabel?: boolean; help?: ReactNode; error?: ReactNode; className?: string; children: ReactNode }) {
  const noteId = useId()
  const controlId = useId()
  const describedBy = error || help ? noteId : undefined
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={controlId} className={hiddenLabel ? 'sr-only' : 'text-sm text-graphite-2'}>
        {label}
      </label>
      <FieldContext.Provider value={{ id: controlId, describedBy, invalid: !!error }}>{children}</FieldContext.Provider>
      {error ? <ErrorText id={noteId}>{error}</ErrorText> : help && <span id={noteId} className="text-xs text-graphite">{help}</span>}
    </div>
  )
}

function useControlAria(invalid?: boolean) {
  const field = useContext(FieldContext)
  return { id: field.id, 'aria-invalid': invalid || field.invalid || undefined, 'aria-describedby': field.describedBy }
}

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & { size?: Size; invalid?: boolean; unit?: string; end?: ReactNode }

/** A text or number input; `unit` and `end` sit inside the box, after the value. */
export function Input({ size = 'md', invalid, unit, end, className = '', ...props }: InputProps) {
  const aria = useControlAria(invalid)
  const numeric = props.type === 'number' || props.inputMode === 'numeric' || props.inputMode === 'decimal'
  const box = `min-w-0 ${FRAME} ${unit || end ? '' : PLACEHOLDER} ${HEIGHT[size]} ${border(invalid)} ${numeric ? 'numerals' : ''} ${className}`
  if (!unit && !end) return <input {...aria} className={box} {...props} />
  return (
    <span className={`flex items-center gap-2 ${box}`}>
      <input {...aria} className={`w-full min-w-0 self-stretch bg-transparent outline-none ${PLACEHOLDER}`} {...props} />
      {unit && <span className="numerals text-xs text-graphite-2">{unit}</span>}
      {end}
    </span>
  )
}

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> & { size?: Size; invalid?: boolean }

export function Select({ size = 'md', invalid, className = '', ...props }: SelectProps) {
  const aria = useControlAria(invalid)
  return (
    <span className={`relative flex ${className}`}>
      <select {...aria} className={`w-full appearance-none pr-8 ${FRAME} ${HEIGHT[size]} ${border(invalid)}`} {...props} />
      <CaretDown className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-graphite-2" />
    </span>
  )
}

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }

export function TextArea({ invalid, className = '', ...props }: TextAreaProps) {
  const aria = useControlAria(invalid)
  return <textarea {...aria} className={`${FRAME} ${PLACEHOLDER} ${border(invalid)} px-3 py-2.5 ${className}`} {...props} />
}
