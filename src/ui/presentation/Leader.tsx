import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

type Line = { width: number; height: number; points: [number, number][]; label: [number, number] }

/**
 * A black leader from a point of the first image inside to the sheet piece `to`, with `label` on its elbow, as a drawing ties a part to its piece.
 * It is measured after layout and redrawn on resize; until then, and where the stylesheet hides it, only the children show.
 */
export function Leader({ className, label, from, to, children }: { className: string; label: string; from: { x: number; y: number }; to: string; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const [line, setLine] = useState<Line | null>(null)

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => {
      const image = el.querySelector('img')
      const piece = el.querySelector(`[data-piece="${CSS.escape(to)}"] rect`)
      const sheet = piece?.closest('figure')
      if (!image || !piece || !sheet) return setLine(null)
      const o = el.getBoundingClientRect()
      const i = image.getBoundingClientRect()
      const p = piece.getBoundingClientRect()
      const s = sheet.getBoundingClientRect()
      const start: [number, number] = [i.left - o.left + i.width * from.x, i.top - o.top + i.height * from.y]
      // Above the sheet's caption, down the gutter, and into the piece from its left edge, so it crosses no other piece.
      const top = s.top - o.top - 36
      const gutter = (i.right + s.left) / 2 - o.left
      // Into the piece's middle, unless the sheet's height figure sits there; then just above or below it, still within the piece.
      const figure = sheet.querySelector('[data-cota="vertical"]')?.getBoundingClientRect()
      let y = p.top + p.height / 2
      if (figure && y > figure.top - 10 && y < figure.bottom + 10) y = figure.top - 12 > p.top + 8 ? figure.top - 12 : Math.min(figure.bottom + 12, p.bottom - 8)
      const middle = y - o.top
      const points: [number, number][] = [start, [start[0] + 36, top], [gutter, top], [gutter, middle], [p.left - o.left, middle]]
      setLine({ width: o.width, height: o.height, points, label: [(start[0] + 36 + gutter) / 2, top] })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [from.x, from.y, to])

  return (
    <div ref={box} className={`${className} leader`}>
      {children}
      {line && (
        <svg className="leader-line" width={line.width} height={line.height} aria-hidden>
          <defs>
            <marker id="leader-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill="var(--graphite)" />
            </marker>
          </defs>
          <circle cx={line.points[0][0]} cy={line.points[0][1]} r="7" fill="var(--graphite)" stroke="var(--bone)" strokeWidth="2" />
          <polyline points={line.points.map((p) => p.join(',')).join(' ')} fill="none" stroke="var(--graphite)" strokeWidth="3" strokeLinejoin="round" markerEnd="url(#leader-arrow)" />
          <foreignObject x={line.label[0] - 60} y={line.label[1] - 22} width="120" height="44">
            <span className="leader-label">{label}</span>
          </foreignObject>
        </svg>
      )}
    </div>
  )
}
