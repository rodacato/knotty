import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { facing, nameOf, openingProblem, rectOf, slidOpening, WALLS, type Layout, type Opening } from './layout'
import { useRoom } from './store'

const cm = (v: number) => (v / 10).toLocaleString('es-MX')
export function wallPoint(layout: Layout, wall: Opening['wall'], along: number, inward: number): [number, number] {
  const { room } = layout
  if (wall === 'back') return [along, inward]
  if (wall === 'front') return [along, room.depth - inward]
  if (wall === 'left') return [inward, along]
  return [room.width - inward, along]
}

/** A door or a window on the plan: dragged along its wall or to another one, and chosen to edit its measures in «Mi espacio». */
function OpeningMark({ layout, opening: o, hit, onGrab }: { layout: Layout; opening: Opening; hit: number; onGrab: (e: ReactPointerEvent<SVGGElement>, o: Opening) => void }) {
  const chosen = useRoom((s) => s.opening === o.id)
  const start = wallPoint(layout, o.wall, o.offset, 0),
    end = wallPoint(layout, o.wall, o.offset + o.width, 0)
  const hinge = o.hinge === 'start' ? o.offset : o.offset + o.width
  const points = [
    wallPoint(layout, o.wall, hinge, 0),
    ...Array.from({ length: 17 }, (_, i) => {
      const angle = (i * Math.PI) / 32
      return wallPoint(layout, o.wall, hinge + (o.hinge === 'start' ? 1 : -1) * o.width * Math.cos(angle), o.width * Math.sin(angle))
    }),
  ]
  const label = o.kind === 'window' ? 'Ventana' : o.swing === 'outside' ? 'Puerta: abre hacia afuera' : o.swing === 'sliding' ? 'Puerta corrediza' : 'Puerta: abre hacia adentro'
  const problem = openingProblem(layout.room, o, layout.openings)
  const color = problem ? 'var(--rust)' : 'var(--graphite)'
  const px = hit / 44
  const across = o.wall === 'back' || o.wall === 'front'
  const span = { x1: start[0], y1: start[1], x2: end[0], y2: end[1] }
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${label}, en la ${WALLS.find(([wall]) => wall === o.wall)![1].toLowerCase()}, a ${cm(o.offset)} centímetros de la esquina${problem ? `. ${problem}` : ''}`}
      aria-pressed={chosen}
      data-room-opening={o.kind}
      className="group cursor-grab outline-none"
      onPointerDown={(e) => onGrab(e, o)}
      onKeyDown={(e) => {
        const step = (e.shiftKey ? 100 : 10) * ({ [across ? 'ArrowLeft' : 'ArrowUp']: -1, [across ? 'ArrowRight' : 'ArrowDown']: 1 }[e.key] ?? 0)
        if (step) {
          e.preventDefault()
          const offset = Math.max(0, Math.min((across ? layout.room.width : layout.room.depth) - o.width, o.offset + step))
          if (offset !== o.offset) useRoom.getState().setOpening({ ...o, offset })
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          useRoom.getState().chooseOpening(o.id)
        }
      }}
    >
      <title>{label}</title>
      {o.kind === 'door' && o.swing === 'inside' && (
        <>
          <polyline points={points.slice(1).map((p) => p.join(',')).join(' ')} fill="none" stroke={color} strokeWidth={1.5 * px} />
          <line x1={points[0][0]} y1={points[0][1]} x2={points[17][0]} y2={points[17][1]} stroke={color} strokeWidth={3 * px} />
        </>
      )}
      <line {...span} stroke="transparent" strokeWidth={hit} />
      <line {...span} className={chosen ? '' : 'opacity-0 group-focus-visible:opacity-100'} stroke="var(--graphite)" strokeWidth={16 * px} />
      <line {...span} stroke="var(--bone)" strokeWidth={10 * px} />
      {o.kind === 'window' ? (
        <>
          <line {...span} stroke={color} strokeWidth={8 * px} />
          <line {...span} stroke="var(--bone)" strokeWidth={5 * px} />
          <line {...span} stroke={color} strokeWidth={1.5 * px} />
        </>
      ) : (
        <line {...span} stroke={color} strokeWidth={3 * px} />
      )}
    </g>
  )
}

/** A dimension line with arrowheads, extension lines from the wall and its figure, drawn `px` screen pixels at a time. */
function Dimension({ length, along, px, label }: { length: number; along: 'x' | 'y'; px: number; label: string }) {
  const off = -32 * px,
    tick = 6 * px,
    head = 9 * px
  const at = (u: number, v: number): [number, number] => (along === 'x' ? [u, v] : [v, u])
  const line = (a: [number, number], b: [number, number]) => <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="var(--graphite)" strokeWidth={1.5 * px} />
  const arrow = (tip: number, dir: 1 | -1) => (
    <polygon
      points={[at(tip, off), at(tip + dir * head, off - head / 3), at(tip + dir * head, off + head / 3)].map((p) => p.join(',')).join(' ')}
      fill="var(--graphite)"
    />
  )
  const [tx, ty] = at(length / 2, off - 8 * px)
  return (
    <g aria-hidden className="pointer-events-none">
      {line(at(0, -tick), at(0, off - tick))}
      {line(at(length, -tick), at(length, off - tick))}
      {line(at(0, off), at(length, off))}
      {arrow(0, 1)}
      {arrow(length, -1)}
      <text x={tx} y={ty} textAnchor="middle" transform={along === 'y' ? `rotate(-90 ${tx} ${ty})` : undefined} fontSize={18 * px} fontWeight="600" fill="var(--graphite)" className="numerals font-mono">
        {label}
      </text>
    </g>
  )
}

export function RoomPlan({ layout, bad }: { layout: Layout; bad: Set<string> }) {
  const selected = useRoom((s) => s.selected)
  const svg = useRef<SVGSVGElement>(null)
  const [{ hit, margin }, setSizing] = useState({ hit: 500, margin: 600 })
  const px = hit / 44
  const drag = useRef<{
    id: string
    x: number
    z: number
    px: number
    py: number
    started: boolean
  } | null>(null)
  useEffect(() => {
    const node = svg.current
    if (!node) return
    const resize = new ResizeObserver(() => {
      const style = getComputedStyle(node)
      const width = node.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      const height = node.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
      const roomScale = Math.min((width - 48) / layout.room.width, (height - 48) / layout.room.depth)
      if (roomScale <= 0) return
      const margin = Math.max(220, 64 / roomScale)
      const scale = Math.min(width / (layout.room.width + margin * 2), height / (layout.room.depth + margin * 2))
      setSizing({ hit: 44 / scale, margin })
    })
    resize.observe(node)
    return () => resize.disconnect()
  }, [layout.room.width, layout.room.depth])
  const point = (e: ReactPointerEvent) => {
    const matrix = svg.current?.getScreenCTM()
    return matrix ? new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse()) : null
  }
  const slide = useRef<{ id: string; grip: number; px: number; py: number; started: boolean } | null>(null)
  const end = () => {
    if (drag.current?.started) useRoom.getState().settle(drag.current.id)
    drag.current = null
    slide.current = null
  }
  const grab = (e: ReactPointerEvent<SVGGElement>, o: Opening) => {
    const at = point(e)
    if (e.button !== 0 || !at) return
    e.currentTarget.setPointerCapture(e.pointerId)
    useRoom.getState().chooseOpening(o.id)
    slide.current = { id: o.id, grip: (o.wall === 'back' || o.wall === 'front' ? at.x : at.y) - o.offset, px: at.x, py: at.y, started: false }
  }
  const slideTo = (at: DOMPoint) => {
    const held = slide.current,
      opening = layout.openings.find((o) => o.id === held?.id)
    if (!held || !opening) return
    if (!held.started && Math.hypot(at.x - held.px, at.y - held.py) < 25) return
    if (!held.started) {
      useRoom.getState().beginMove()
      held.started = true
    }
    const moved = slidOpening(layout.room, opening, at.x, at.y, held.grip)
    if (moved.wall !== opening.wall) held.grip = opening.width / 2
    if (moved.wall !== opening.wall || moved.offset !== opening.offset) useRoom.getState().setOpening(moved, false)
  }
  return (
    <svg
      ref={svg}
      role="group"
      aria-label="Plano del espacio. Arrastra un mueble, una puerta o una ventana, o usa las flechas; Mayús mueve diez centímetros."
      data-room-plan
      viewBox={`${-margin} ${-margin} ${layout.room.width + margin * 2} ${layout.room.depth + margin * 2}`}
      className="h-full w-full touch-none select-none p-1"
      onPointerMove={(e) => {
        const at = point(e),
          grabbed = drag.current
        if (at && slide.current) slideTo(at)
        if (!at || !grabbed) return
        if (!grabbed.started && Math.hypot(at.x - grabbed.px, at.y - grabbed.py) < 25) return
        if (!grabbed.started) {
          useRoom.getState().beginMove()
          grabbed.started = true
        }
        useRoom.getState().move(
          grabbed.id,
          {
            x: Math.round((grabbed.x + at.x - grabbed.px) / 10) * 10,
            z: Math.round((grabbed.z + at.y - grabbed.py) / 10) * 10,
          },
          false,
        )
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
    >
      <defs>
        <pattern id="room-grid" width="500" height="500" patternUnits="userSpaceOnUse">
          <path d="M 500 0 H 0 V 500" fill="none" stroke="var(--line)" strokeWidth="7" />
        </pattern>
      </defs>
      <rect width={layout.room.width} height={layout.room.depth} fill="var(--bone)" />
      <rect width={layout.room.width} height={layout.room.depth} fill="url(#room-grid)" />
      <rect width={layout.room.width} height={layout.room.depth} fill="none" stroke="var(--graphite)" strokeWidth={6 * px} className="pointer-events-none" />
      <Dimension length={layout.room.width} along="x" px={px} label={`${cm(layout.room.width)} cm`} />
      <Dimension length={layout.room.depth} along="y" px={px} label={`${cm(layout.room.depth)} cm`} />
      {layout.openings.map((o) => (
        <OpeningMark key={o.id} layout={layout} opening={o} hit={hit} onGrab={grab} />
      ))}
      {layout.items.map((item, index) => {
        const r = rectOf(item),
          chosen = selected === item.id
        const w = r.x1 - r.x0,
          d = r.z1 - r.z0
        const front = item.kind === 'furniture' ? facing(item.turn) : null
        const frontEdge = front && { back: [r.x0 + 30, r.z0, r.x1 - 30, r.z0], front: [r.x0 + 30, r.z1, r.x1 - 30, r.z1], left: [r.x0, r.z0 + 30, r.x0, r.z1 - 30], right: [r.x1, r.z0 + 30, r.x1, r.z1 - 30] }[front]
        return (
          <g
            key={item.id}
            role="button"
            tabIndex={0}
            aria-label={`${nameOf(item)}, ${cm(w)} por ${cm(d)} centímetros${front ? `, con el frente hacia la ${WALLS.find(([wall]) => wall === front)![1].toLowerCase()}` : ''}${chosen ? ', seleccionado' : ''}${bad.has(item.id) ? ', tiene algo por revisar' : ''}`}
            aria-pressed={chosen}
            className="group cursor-grab outline-none"
            onClick={() => useRoom.getState().select(item.id)}
            onPointerDown={(e) => {
              if (e.button !== 0) return
              const at = point(e)
              if (!at) return
              e.currentTarget.setPointerCapture(e.pointerId)
              useRoom.getState().select(item.id)
              drag.current = {
                id: item.id,
                x: item.x,
                z: item.z,
                px: at.x,
                py: at.y,
                started: false,
              }
            }}
            onKeyDown={(e) => {
              const step = e.shiftKey ? 100 : 10
              const delta = {
                ArrowLeft: [-step, 0],
                ArrowRight: [step, 0],
                ArrowUp: [0, -step],
                ArrowDown: [0, step],
              }[e.key]
              if (delta) {
                e.preventDefault()
                useRoom.getState().select(item.id)
                useRoom.getState().nudge(item.id, delta[0], delta[1])
              } else if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                useRoom.getState().select(item.id)
              }
            }}
          >
            <rect x={item.x - Math.max(w, hit) / 2} y={item.z - Math.max(d, hit) / 2} width={Math.max(w, hit)} height={Math.max(d, hit)} fill="transparent" />
            <rect
              className="pointer-events-none opacity-0 group-focus-visible:opacity-100"
              x={r.x0 - (hit * 4) / 44}
              y={r.z0 - (hit * 4) / 44}
              width={w + (hit * 8) / 44}
              height={d + (hit * 8) / 44}
              fill="none"
              stroke="var(--graphite)"
              strokeWidth={2 * px}
              strokeDasharray={`${4 * px} ${3 * px}`}
            />
            <rect
              className="room-footprint"
              x={r.x0}
              y={r.z0}
              width={w}
              height={d}
              fill={chosen ? 'var(--graphite)' : item.kind === 'block' ? 'var(--kraft-2)' : 'var(--bone)'}
              stroke="var(--graphite)"
              strokeWidth={2 * px}
              strokeDasharray={item.elevation ? `${6 * px} ${4 * px}` : undefined}
            />
            {frontEdge && (
              <line className="pointer-events-none" x1={frontEdge[0]} y1={frontEdge[1]} x2={frontEdge[2]} y2={frontEdge[3]} stroke={chosen ? 'var(--bone)' : 'var(--graphite)'} strokeWidth={6 * px} />
            )}
            {bad.has(item.id) && (
              <rect
                x={r.x0 + 6 * px}
                y={r.z0 + 6 * px}
                width={Math.max(1, w - 12 * px)}
                height={Math.max(1, d - 12 * px)}
                fill="none"
                stroke={chosen ? 'var(--bone)' : 'var(--graphite)'}
                strokeWidth={1.5 * px}
                strokeDasharray={`${5 * px} ${4 * px}`}
              />
            )}
            <text
              x={item.x}
              y={item.z}
              dominantBaseline="central"
              textAnchor="middle"
              fontSize={Math.max(145, 18 * px)}
              fontWeight="600"
              fill={chosen ? 'var(--bone)' : 'var(--graphite)'}
              className="numerals pointer-events-none font-mono"
            >
              {index + 1}
              {chosen ? ' ✓' : ''}
              {bad.has(item.id) ? ' !' : ''}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
