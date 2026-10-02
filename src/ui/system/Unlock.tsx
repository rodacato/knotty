import { useState, type ReactNode } from 'react'
import { Button } from './components'
import { Field, Input } from './Field'
import { Reveal } from './Reveal'

export const UNLOCK_TEXT = 'Tienes llaves guardadas y cifradas en este navegador. Escribe tu frase para usarlas.'

/** The passphrase of the saved keys, with its eye and its error under the field. */
export function PassphraseField({
  value,
  onChange,
  error,
  label,
  hiddenLabel = false,
  placeholder,
  autoFocus = false,
  className = '',
  inputClassName = '',
}: {
  value: string
  onChange: (value: string) => void
  error: string
  label: ReactNode
  hiddenLabel?: boolean
  placeholder: string
  autoFocus?: boolean
  className?: string
  inputClassName?: string
}) {
  const [shown, setShown] = useState(false)
  return (
    <Field label={label} hiddenLabel={hiddenLabel} error={error} className={className}>
      <Input
        type={shown ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="current-password"
        autoFocus={autoFocus}
        invalid={!!error}
        className={inputClassName}
        end={<Reveal what="frase" shown={shown} onToggle={() => setShown((v) => !v)} />}
      />
    </Field>
  )
}

/** 16 px text lines get a 44 px hit area without changing the look. */
export const FORGET_HIT_AREA = "relative before:absolute before:-inset-y-3.5 before:inset-x-0 before:content-['']"

/** Forgetting the saved keys asks first because it cannot be undone. */
export function ForgetKeysPrompt({ onForget }: { onForget: () => void }) {
  const [asking, setAsking] = useState(false)
  return asking ? (
    <p className="flex flex-wrap items-center gap-2 text-xs">
      ¿Borrar las llaves guardadas? No se pueden recuperar.
      <button type="button" className={`font-medium underline ${FORGET_HIT_AREA}`} onClick={() => setAsking(false)}>
        No
      </button>
      <button type="button" className={`font-medium text-rust underline ${FORGET_HIT_AREA}`} onClick={onForget}>
        Sí, borrarlas
      </button>
    </p>
  ) : (
    <button type="button" className={`self-start text-xs font-medium text-rust ${FORGET_HIT_AREA}`} onClick={() => setAsking(true)}>
      Olvidé la frase: borrar las llaves guardadas
    </button>
  )
}

/** The passphrase form of the saved keys; the caller owns the state and what opening or forgetting does. */
export function UnlockForm({
  passphrase,
  onPassphrase,
  error,
  opening,
  onSubmit,
  onForget,
  autoFocus = false,
}: {
  passphrase: string
  onPassphrase: (value: string) => void
  error: string
  opening: boolean
  onSubmit: () => void
  onForget: () => void
  autoFocus?: boolean
}) {
  return (
    <form
      className="flex flex-col gap-3 text-sm"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
    >
      <p>{UNLOCK_TEXT}</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <PassphraseField
          label="Frase secreta"
          hiddenLabel
          placeholder="Tu frase secreta"
          value={passphrase}
          onChange={onPassphrase}
          error={error}
          autoFocus={autoFocus}
          className="flex-1"
        />
        <Button type="submit" variant="primary" className="min-h-11" disabled={!passphrase || opening}>
          {opening ? 'Abriendo…' : 'Desbloquear'}
        </Button>
      </div>
      <ForgetKeysPrompt onForget={onForget} />
    </form>
  )
}
