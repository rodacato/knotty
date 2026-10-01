import { Eye, EyeSlash } from '@phosphor-icons/react'

export const REVEAL_LABELS = {
  llave: { show: 'Mostrar la llave', hide: 'Ocultar la llave' },
  frase: { show: 'Mostrar la frase', hide: 'Ocultar la frase' },
}

/** The eye inside a secret field; `what` makes its name tell the key and the passphrase apart. */
export function Reveal({ what, shown, onToggle }: { what: keyof typeof REVEAL_LABELS; shown: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} aria-label={REVEAL_LABELS[what][shown ? 'hide' : 'show']} className="relative grid size-9 shrink-0 place-items-center text-graphite-2 before:absolute before:-inset-1 before:content-['']">
      {shown ? <EyeSlash className="size-5" /> : <Eye className="size-5" />}
    </button>
  )
}
