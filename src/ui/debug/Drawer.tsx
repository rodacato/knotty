import { CaretLeft, X } from '@phosphor-icons/react'
import type { ReactNode } from 'react'

// A drawer of the debug bar: beside the screen on a desk, a sheet over it on a phone. Closed it stays mounted, so what a tool shows (a run of cases) is not lost.

interface DrawerProps {
  open: boolean
  onClose: () => void
  /** What the drawer is called, for its landmark and its close button. */
  label: string
  /** Tailwind width of the drawer from the medium breakpoint up. */
  width: string
  children: ReactNode
}

export function Drawer({ open, onClose, label, width, children }: DrawerProps) {
  return (
    <aside aria-label={label} hidden={!open} className={`fixed inset-0 z-50 flex-col bg-bone md:static md:z-auto md:h-dvh md:shrink-0 md:border-r md:border-line ${width} ${open ? 'flex' : ''}`}>
      <button type="button" onClick={onClose} aria-label={`Cerrar ${label}`} className="absolute top-2 right-2 z-10 grid size-11 place-items-center rounded-full text-graphite-2 hover:bg-kraft">
        <CaretLeft className="hidden md:block" />
        <X className="md:hidden" />
      </button>
      {children}
    </aside>
  )
}
