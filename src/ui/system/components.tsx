import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { Severity } from '../../domain/checks/structure/finding'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'action'

const VARIANTS: Record<Variant, string> = {
  // The screen's one vermilion action (UI-93): at most one per screen.
  action: 'bg-action text-on-action font-display text-lg font-semibold uppercase hover:brightness-110',
  // Every button speaks in condensed capitals, as the brand guide rules (UI-93): ink filled, or outlined in ink.
  primary: 'border-2 border-graphite bg-graphite font-display text-base font-semibold text-bone uppercase hover:bg-graphite/90',
  secondary: 'border-2 border-graphite bg-bone font-display text-base font-semibold text-graphite uppercase hover:bg-kraft',
  ghost: 'text-graphite-2 hover:bg-kraft hover:text-graphite',
  danger: 'bg-rust text-on-rust hover:bg-rust/90',
}

export function Button({ variant = 'secondary', className = '', children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`btn inline-flex min-h-11 items-center justify-center font-medium transition active:scale-[0.97] disabled:pointer-events-none disabled:bg-kraft disabled:text-graphite-2 disabled:shadow-[inset_0_0_0_1px_var(--line)] ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

const ICON_BUTTON_SIZES = {
  md: "relative size-9 before:absolute before:-inset-1 before:content-['']",
  lg: 'size-11',
}

/** A round button that holds only an icon: 36 px with a 44 px hit area, or 44 px where a finger reaches it over the 3D or in a dialog. */
export function IconButton({ size = 'md', className = '', children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { size?: keyof typeof ICON_BUTTON_SIZES }) {
  return (
    <button type="button" className={`grid shrink-0 place-items-center rounded-full text-graphite-2 transition hover:bg-kraft active:scale-[0.97] ${ICON_BUTTON_SIZES[size]} ${className}`} {...props}>
      {children}
    </button>
  )
}

export function Chip({ active = false, className = '', children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={`relative inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] transition before:absolute before:-inset-y-[5px] before:-inset-x-px before:content-[''] active:scale-[0.96] disabled:opacity-40 ${
        active ? 'border-select bg-select-soft font-semibold text-graphite' : 'border-line bg-bone font-medium text-graphite hover:bg-kraft'
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

const STAMP: Record<Severity, { text: string; className: string; tilt: string }> = {
  critical: { text: 'Crítico', className: 'text-rust border-rust', tilt: '-rotate-3' },
  recommendation: { text: 'Recomendación', className: 'text-graphite border-graphite', tilt: 'rotate-2' },
  detail: { text: 'Detalle', className: 'text-slate border-slate', tilt: '-rotate-1' },
}

/** Severity as an ink stamp on a drawing. */
export function Stamp({ severity }: { severity: Severity }) {
  const s = STAMP[severity]
  return (
    <span className={`inline-block rounded-[4px] border-2 px-1.5 py-px font-mono text-xs font-bold uppercase tracking-[0.12em] opacity-90 mix-blend-multiply ${s.className} ${s.tilt}`}>
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

export { cm } from '../../domain/furniture/modules/common'

export function Title({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <h2 className={`font-display text-2xl font-semibold ${className}`}>{children}</h2>
}
