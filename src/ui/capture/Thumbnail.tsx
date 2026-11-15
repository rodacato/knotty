import { useMemo } from 'react'
import type { Box } from '../../domain/design/resolve'
import { sketch, type Face } from './sketch'

const FACE: Record<Face, string> = { front: 'fill-birch', top: 'fill-[color-mix(in_srgb,var(--color-birch)_60%,white)]', side: 'fill-pine' }

/** The furniture as Knotty builds it, drawn from its pieces. */
export function Thumbnail({ boxes, ink = false }: { boxes: Map<string, Box>; /** Contours in ink, as the catalog's plates print them (UI-93). */ ink?: boolean }) {
  const contour = ink ? 'stroke-graphite [stroke-width:1.25]' : 'stroke-walnut/80 [stroke-width:0.8]'
  const { polygons, width, height } = useMemo(() => sketch(boxes), [boxes])
  // A plate frames the drawing itself, so it needs only a hair of margin.
  const pad = Math.max(width, height) * (ink ? 0.02 : 0.08)
  return (
    <svg viewBox={`${-pad} ${-pad} ${width + 2 * pad} ${height + 2 * pad}`} className="size-full" aria-hidden>
      {polygons.map((p, i) => (
        <polygon key={i} points={p.points.map(([x, y]) => `${x},${y}`).join(' ')} className={`${FACE[p.face]} ${contour} [stroke-linejoin:round] [vector-effect:non-scaling-stroke]`} />
      ))}
    </svg>
  )
}
