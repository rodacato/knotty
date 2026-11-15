import { CaretRight } from '@phosphor-icons/react'
import type { ReactNode } from 'react'

/** A section of the cut ticket (UI-93): a condensed title on a heavy rule, folded until it is opened. `aside` follows the title past a vertical rule. */
export function Section({ title, aside, open, label, children }: { title: ReactNode; aside?: ReactNode; open?: boolean; label?: string; children: ReactNode }) {
  return (
    <details open={open} aria-label={label} className="group/section border-t-[6px] border-graphite">
      <summary className="flex min-h-16 cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 py-2 [&::-webkit-details-marker]:hidden">
        <CaretRight weight="bold" aria-hidden className="size-6 shrink-0 transition group-open/section:rotate-90" />
        <span className="font-display text-3xl leading-none font-semibold uppercase md:text-5xl">{title}</span>
        {aside && <span className="border-l-[3px] border-graphite pl-3 text-base text-graphite md:text-lg">{aside}</span>}
      </summary>
      <div className="pb-4">{children}</div>
    </details>
  )
}
