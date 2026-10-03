import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import type { ReactNode } from 'react'

// A side of the workshop that folds into a rail: it keeps its place and says how much it holds.

interface DrawerProps {
  side: 'left' | 'right'
  open: boolean
  onToggle: () => void
  /** What the open drawer is called, for the buttons that fold and unfold it. */
  label: string
  /** The icon and short count shown on the rail while folded. */
  rail: ReactNode
  /** Tailwind width of the open drawer. */
  width: string
  children: ReactNode
}

export function Drawer({ side, open, onToggle, label, rail, width, children }: DrawerProps) {
  const border = side === 'left' ? 'border-r' : 'border-l'
  const Fold = side === 'left' ? CaretLeft : CaretRight
  const Unfold = side === 'left' ? CaretRight : CaretLeft
  if (!open)
    return (
      <aside className={`flex w-[52px] shrink-0 flex-col items-center gap-2 bg-bone py-2 ${border} border-line`} aria-label={label}>
        <button type="button" onClick={onToggle} aria-label={`Abrir ${label}`} aria-expanded={false} className="relative grid size-11 place-items-center rounded-full text-graphite-2 hover:bg-kraft">
          <Unfold />
        </button>
        <div className="flex w-9 flex-col items-center gap-1.5 rounded-lg bg-kraft py-2.5 text-graphite">{rail}</div>
      </aside>
    )
  return (
    <aside className={`relative flex min-h-0 shrink-0 flex-col bg-bone ${border} border-line ${width}`} aria-label={label}>
      <button type="button" onClick={onToggle} aria-label={`Cerrar ${label}`} aria-expanded className={`absolute top-2 right-2 z-10 grid size-11 place-items-center rounded-full text-graphite-2 hover:bg-kraft`}>
        <Fold />
      </button>
      {children}
    </aside>
  )
}
