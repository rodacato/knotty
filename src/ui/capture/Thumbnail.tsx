import { useMemo } from 'react'
import type { Box } from '../../domain/design/resolve'
import { sketch, type Face } from './sketch'

const FACE: Record<Face, string> = { front: 'fill-birch', top: 'fill-[color-mix(in_srgb,var(--color-birch)_60%,white)]', side: 'fill-pine' }

/** The furniture as Knotty builds it, drawn from its pieces. */
export function Thumbnail({ boxes }: { boxes: Map<string, Box> }) {
  const { polygons, width, height } = useMemo(() => sketch(boxes), [boxes])
  const pad = Math.max(width, height) * 0.08
  return (
    <svg viewBox={`${-pad} ${-pad} ${width + 2 * pad} ${height + 2 * pad}`} className="size-full" aria-hidden>
      {polygons.map((p, i) => (
        <polygon key={i} points={p.points.map(([x, y]) => `${x},${y}`).join(' ')} className={`${FACE[p.face]} stroke-walnut/80 [stroke-linejoin:round] [stroke-width:0.8] [vector-effect:non-scaling-stroke]`} />
      ))}
    </svg>
  )
}
