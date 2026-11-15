import { useId, useMemo } from 'react'
import type { Box } from '../../domain/design/resolve'
import { sketch, type Face } from './sketch'

const FACE: Record<Face, string> = { front: 'fill-birch', top: 'fill-[color-mix(in_srgb,var(--color-birch)_60%,white)]', side: 'fill-pine' }

type Props = {
  boxes: Map<string, Box>
  /** Contours in ink, as the catalog's plates print them (UI-93). */
  ink?: boolean
  /** The piece hatched in ink, as the sheets mark it (UI-93). */
  chosen?: string | null
  /** A pointer shortcut only: the sheets are the keyboard's way to choose a piece. */
  onChoose?: (id: string) => void
}

/** The furniture as Knotty builds it, drawn from its pieces. */
export function Thumbnail({ boxes, ink = false, chosen = null, onChoose }: Props) {
  const contour = ink ? 'stroke-graphite [stroke-width:1.25]' : 'stroke-walnut/80 [stroke-width:0.8]'
  const hatch = useId()
  const { polygons, width, height } = useMemo(() => sketch(boxes), [boxes])
  // A plate frames the drawing itself, so it needs only a hair of margin.
  const pad = Math.max(width, height) * (ink ? 0.02 : 0.08)
  const gap = Math.max(width, height) / 50
  return (
    <svg viewBox={`${-pad} ${-pad} ${width + 2 * pad} ${height + 2 * pad}`} className="size-full" aria-hidden>
      {chosen && (
        <defs>
          <pattern id={hatch} width={gap} height={gap} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2={gap} stroke="var(--color-brand-ink)" strokeWidth={gap * 0.6} />
          </pattern>
        </defs>
      )}
      {polygons.map((p, i) => {
        const points = p.points.map(([x, y]) => `${x},${y}`).join(' ')
        const choose = onChoose && { onClick: () => onChoose(p.id), className: 'cursor-pointer' }
        return (
          <g key={i} data-piece={p.id} {...choose}>
            <polygon points={points} className={`${FACE[p.face]} ${contour} [stroke-linejoin:round] [vector-effect:non-scaling-stroke]`} />
            {p.id === chosen && <polygon data-chosen points={points} fill={`url(#${hatch})`} className="stroke-graphite [stroke-width:2.5] [stroke-linejoin:round] [vector-effect:non-scaling-stroke]" />}
          </g>
        )
      })}
    </svg>
  )
}
