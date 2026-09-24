import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { Severidad } from '../../domain/estructura/hallazgo'

type Variante = 'primario' | 'secundario' | 'fantasma' | 'peligro'

const VARIANTES: Record<Variante, string> = {
  primario: 'bg-grafito text-hueso hover:bg-grafito/90 shadow-[0_1px_0_rgba(255,255,255,.15)_inset,0_6px_16px_-8px_rgba(43,40,37,.6)]',
  secundario: 'bg-kraft text-grafito border border-linea hover:bg-kraft-2',
  fantasma: 'text-grafito-2 hover:bg-kraft hover:text-grafito',
  peligro: 'bg-oxido text-white hover:bg-oxido/90',
}

export function Boton({ variante = 'secundario', className = '', children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ambar ${VARIANTES[variante]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function Chip({ activo = false, className = '', children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { activo?: boolean }) {
  return (
    <button
      type="button"
      className={`animate-aparecer inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition active:scale-[0.96] disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-ambar ${
        activo ? 'border-ambar bg-ambar-suave text-grafito' : 'border-linea bg-hueso text-grafito hover:border-ambar/60 hover:bg-ambar-suave'
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

const SELLO: Record<Severidad, { texto: string; clase: string; giro: string }> = {
  critico: { texto: 'Crítico', clase: 'text-oxido border-oxido', giro: '-rotate-3' },
  recomendacion: { texto: 'Recomendación', clase: 'text-ambar border-ambar', giro: 'rotate-2' },
  detalle: { texto: 'Detalle', clase: 'text-pizarra border-pizarra', giro: '-rotate-1' },
}

/** Severidad como sello de tinta sobre un plano. */
export function Sello({ severidad }: { severidad: Severidad }) {
  const s = SELLO[severidad]
  return (
    <span className={`inline-block rounded-[4px] border-2 px-1.5 py-px font-mono text-[10px] font-bold uppercase tracking-[0.12em] opacity-90 mix-blend-multiply dark:mix-blend-screen ${s.clase} ${s.giro}`}>
      {s.texto}
    </span>
  )
}

/** Un lápiz de carpintero que traza una línea: el estado de "el experto está pensando". */
export function Lapiz({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 24" className={className} aria-hidden>
      <path d="M4 18 C 16 6, 28 22, 40 12 S 56 8, 60 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" pathLength={1} strokeDasharray="1" className="animate-trazo" />
    </svg>
  )
}

export function Medida({ mm, className = '' }: { mm: number; className?: string }) {
  return (
    <span className={`cifras ${className}`}>
      {Math.round(mm)} <span className="text-grafito-2">mm</span>
    </span>
  )
}

export const cm = (mm: number) => `${(mm / 10).toLocaleString('es-MX', { maximumFractionDigits: 1 })} cm`

export function Titulo({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <h2 className={`font-titulo text-2xl font-semibold tracking-tight [font-variation-settings:'opsz'_48] ${className}`}>{children}</h2>
}
