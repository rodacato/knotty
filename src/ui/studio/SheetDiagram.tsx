import type { KeyboardEvent } from 'react'
import type { MaterialLayout } from '../../domain/estimate/layout'
import { sheetLabels } from './sheetLabels'

export const percent = (f: number) => `${Math.round(f * 100)} %`
export const meters = (mm: number) => `${(mm / 1000).toLocaleString('es-MX', { maximumFractionDigits: 2 })} m`

/** A dimension line in ink with an arrowhead at each end and its figure in the middle, as on a drawing. */
export function Cota({ label, vertical = false }: { label: string; vertical?: boolean }) {
  const line = vertical ? 'w-0.5 flex-1 bg-graphite' : 'h-0.5 flex-1 bg-graphite'
  const start = vertical ? 'border-x-[5px] border-b-[8px] border-x-transparent border-b-graphite' : 'border-y-[5px] border-r-[8px] border-y-transparent border-r-graphite'
  const end = vertical ? 'border-x-[5px] border-t-[8px] border-x-transparent border-t-graphite' : 'border-y-[5px] border-l-[8px] border-y-transparent border-l-graphite'
  return (
    <div aria-hidden className={`flex items-center ${vertical ? 'h-full flex-col' : 'w-full'}`}>
      <span className={start} />
      <span className={line} />
      <span data-cota={vertical ? 'vertical' : 'horizontal'} className={`numerals shrink-0 font-semibold text-graphite ${vertical ? 'py-1 text-sm md:text-base' : 'px-2 text-base md:text-lg'}`}>{label}</span>
      <span className={line} />
      <span className={end} />
    </div>
  )
}

type Props = {
  a: MaterialLayout
  index: number
  total: number
  numbers: Map<string, number>
  chosen: string | null
  /** Without it the pieces are a picture, not controls (the public site). */
  onChoose?: (id: string) => void
}

/** A sheet's layout as in a drawing (UI-93): its two dimensions, pieces in wood, everything else hatched in ink, and the chosen piece hatched black. */
export function SheetDiagram({ a, index, total, numbers, chosen, onChoose }: Props) {
  const sheet = a.sheets[index]
  const trim = (a.sheet.length - a.usable.length) / 2
  const pattern = `rayado-${a.material}-${index}`
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="flex flex-col gap-0.5">
        <span className="font-display text-2xl leading-tight font-semibold md:text-3xl">
          Hoja {index + 1} de {total} · desperdicio {percent(sheet.waste)}
        </span>
        {sheet.leftover && (
          <span className="numerals text-base text-graphite">
            Sobra al menos {sheet.leftover.length} × {sheet.leftover.width} mm
          </span>
        )}
      </figcaption>
      <div className="grid grid-cols-[auto_1fr] grid-rows-[auto_1fr] gap-x-2 gap-y-1">
        <span />
        <Cota label={meters(a.sheet.length)} />
        <Cota label={meters(a.sheet.width)} vertical />
      <svg viewBox={`0 0 ${a.sheet.length} ${a.sheet.width}`} className="drawing-sheet w-full border-2 border-graphite" role="group" aria-label={`Acomodo de la hoja ${index + 1}`}>
        <defs>
          <pattern id={pattern} width="48" height="48" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="48" height="48" fill="var(--color-drawing-paper)" />
            <line x1="0" y1="0" x2="0" y2="48" stroke="var(--color-brand-ink)" strokeWidth="9" />
          </pattern>
          {/* The chosen piece is hatched in ink, as the edited part is marked (UI-93). */}
          <pattern id={`${pattern}-chosen`} width="36" height="36" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="36" height="36" fill="#e2c9a2" />
            <line x1="0" y1="0" x2="0" y2="36" stroke="var(--color-brand-ink)" strokeWidth="12" />
          </pattern>
        </defs>
        <rect width={a.sheet.length} height={a.sheet.width} fill={`url(#${pattern})`} />
        {sheet.placed.map((c) => {
          const active = chosen === c.id
          const size = `${Math.round(c.rotated ? c.h : c.w)} × ${Math.round(c.rotated ? c.w : c.h)}`
          const number = numbers.get(c.id)
          const named = number ? `${number}. ${c.name}` : c.name
          const full = sheetLabels(c.w, c.h, named, size)
          // A number alone stays no larger than a name would be beside its size, so it does not outshout the named pieces.
          const alone = number && !full.name ? sheetLabels(c.w, c.h, `${number}.`, size).name : null
          const short = alone && Math.min(alone, full.size ? full.size * 1.1 : 60)
          const labels = { name: full.name ?? short, size: full.size }
          const cx = trim + c.x + c.w / 2
          const control = onChoose && {
            role: 'button',
            tabIndex: 0,
            'aria-label': `Ver ${named} en 3D · ${size} mm`,
            'aria-pressed': active,
            onClick: () => onChoose(c.id),
            onKeyDown: (event: KeyboardEvent) => {
              if (event.key !== 'Enter' && event.key !== ' ') return
              event.preventDefault()
              onChoose(c.id)
            },
            className: 'cursor-pointer focus-visible:outline-2 focus-visible:outline-focus',
          }
          return (
            <g key={c.id} data-piece={c.id} {...control}>
              <title>{`${named} · ${size}`}</title>
              <rect x={trim + c.x} y={trim + c.y} width={c.w} height={c.h} fill={active ? `url(#${pattern}-chosen)` : '#e2c9a2'} stroke="var(--color-brand-ink)" strokeWidth={active ? 14 : 6} />
              {(labels.name || labels.size) && (
                // Over the hatching the label prints on a wood halo, so it stays readable.
                <text x={cx} y={trim + c.y + c.h / 2} textAnchor="middle" dominantBaseline="middle" fill="var(--color-brand-ink)" stroke={active ? '#e2c9a2' : 'none'} strokeWidth={active ? 18 : 0} style={{ paintOrder: 'stroke' }}>
                  {labels.name && (
                    <tspan fontSize={labels.name} fontWeight={600} style={{ fontFamily: 'var(--font-display)' }}>
                      {full.name ? named : `${number}.`}
                    </tspan>
                  )}
                  {labels.size && (
                    <tspan x={cx} dy={labels.name ? '1.2em' : undefined} fontSize={labels.size} style={{ fontFamily: 'var(--font-mono)' }}>
                      {size}
                    </tspan>
                  )}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      </div>
    </figure>
  )
}
