import { CaretRight } from '@phosphor-icons/react'
import type { ReactNode } from 'react'

const WEIGHT = {
  major: { rule: 'border-t-[6px]', title: 'text-3xl md:text-5xl', row: 'min-h-16' },
  minor: { rule: 'border-t-[3px]', title: 'text-2xl md:text-3xl', row: 'min-h-14' },
}

/** A section of the cut ticket (UI-93): a condensed title on a rule, folded until it is opened. `aside` follows the title past a vertical rule. `minor` is for what supports the purchase rather than being it, so it never outweighs the sheets or the cut list. */
export function Section({ title, aside, open, label, minor = false, children }: { title: ReactNode; aside?: ReactNode; open?: boolean; label?: string; minor?: boolean; children: ReactNode }) {
  const weight = WEIGHT[minor ? 'minor' : 'major']
  return (
    <details open={open} aria-label={label} className={`group/section ${weight.rule} border-graphite`}>
      <summary className={`flex ${weight.row} cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 py-2 [&::-webkit-details-marker]:hidden`}>
        <CaretRight weight="bold" aria-hidden className="size-6 shrink-0 transition group-open/section:rotate-90" />
        <span className={`font-display ${weight.title} leading-none font-semibold uppercase`}>{title}</span>
        {aside && <span className="border-l-[3px] border-graphite pl-3 text-base text-graphite md:text-lg">{aside}</span>}
      </summary>
      <div className="pb-4">{children}</div>
    </details>
  )
}
