import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { Severity } from '../../domain/structure/finding'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-graphite text-bone hover:bg-graphite/90 shadow-[0_1px_0_rgba(255,255,255,.15)_inset,0_6px_16px_-8px_rgba(43,40,37,.6)]',
  secondary: 'bg-kraft text-graphite border border-line hover:bg-kraft-2',
  ghost: 'text-graphite-2 hover:bg-kraft hover:text-graphite',
  danger: 'bg-rust text-white hover:bg-rust/90',
}

export function Button({ variant = 'secondary', className = '', children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function Chip({ active = false, className = '', children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={`animate-appear inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition active:scale-[0.96] disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-amber ${
        active ? 'border-amber bg-amber-soft text-graphite' : 'border-line bg-bone text-graphite hover:border-amber/60 hover:bg-amber-soft'
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

const STAMP: Record<Severity, { text: string; className: string; tilt: string }> = {
  critical: { text: 'Crítico', className: 'text-rust border-rust', tilt: '-rotate-3' },
  recommendation: { text: 'Recomendación', className: 'text-amber border-amber', tilt: 'rotate-2' },
  detail: { text: 'Detalle', className: 'text-slate border-slate', tilt: '-rotate-1' },
}

/** Severity as an ink stamp on a drawing. */
export function Stamp({ severity }: { severity: Severity }) {
  const s = STAMP[severity]
  return (
    <span className={`inline-block rounded-[4px] border-2 px-1.5 py-px font-mono text-[10px] font-bold uppercase tracking-[0.12em] opacity-90 mix-blend-multiply dark:mix-blend-screen ${s.className} ${s.tilt}`}>
      {s.text}
    </span>
  )
}

/** A carpenter's pencil drawing a line: the "expert is thinking" state. */
export function Pencil({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 24" className={className} aria-hidden>
      <path d="M4 18 C 16 6, 28 22, 40 12 S 56 8, 60 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" pathLength={1} strokeDasharray="1" className="animate-draw" />
    </svg>
  )
}

export { cm } from '../../domain/modules/common'

export function Title({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <h2 className={`font-display text-2xl font-semibold tracking-tight [font-variation-settings:'opsz'_48] ${className}`}>{children}</h2>
}
