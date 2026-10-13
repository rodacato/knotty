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
  const color = problem ? 'var(--rust)' : o.kind === 'window' ? 'var(--slate)' : 'var(--amber)'
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
          const moved = { ...o, offset: o.offset + step }
          if (!openingProblem(layout.room, moved)) useRoom.getState().setOpening(moved)
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          useRoom.getState().chooseOpening(o.id)
        }
      }}
    >
      <title>{label}</title>
      {o.kind === 'door' && o.swing === 'inside' && <polygon points={points.map((p) => p.join(',')).join(' ')} fill={color} fillOpacity="0.10" stroke={color} strokeWidth="14" strokeDasharray="30 25" />}
      <line {...span} stroke="transparent" strokeWidth={hit} />
      <line {...span} className={chosen ? '' : 'opacity-0 group-focus-visible:opacity-100'} stroke="var(--graphite)" strokeWidth="80" />
      <line {...span} stroke="var(--bone)" strokeWidth="45" />
      <line {...span} stroke={color} strokeWidth="22" />
    </g>
  )
}

const BELOW = { chips: ['pb-24', 'pb-40'], warning: ['pb-16', 'pb-32'], nothing: ['pb-4', 'pb-20'] }

/** `tools`: the chosen piece's tools sit over the foot of the plan, so it leaves them room. */
export function RoomPlan({ layout, bad, below, tools }: { layout: Layout; bad: Set<string>; below: keyof typeof BELOW; tools: boolean }) {
  const selected = useRoom((s) => s.selected)
  const svg = useRef<SVGSVGElement>(null)
  const [{ hit, margin }, setSizing] = useState({ hit: 500, margin: 220 })
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
      const margin = Math.max(220, 24 / roomScale)
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
      className={`h-full w-full touch-none select-none px-4 pt-36 ${BELOW[below][+tools]} md:pt-28 md:px-8`}
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
      <rect width={layout.room.width} height={layout.room.depth} fill="var(--bone)" stroke="var(--graphite-2)" strokeWidth="20" />
      <rect width={layout.room.width} height={layout.room.depth} fill="url(#room-grid)" />
      <text x={layout.room.width / 2} y="-75" textAnchor="middle" fill="var(--graphite-2)" fontSize={Math.max(130, (hit * 12) / 44)} className="font-mono">
        {cm(layout.room.width)} cm
      </text>
      <text
        x="-85"
        y={layout.room.depth / 2}
        textAnchor="middle"
        transform={`rotate(-90 -85 ${layout.room.depth / 2})`}
        fill="var(--graphite-2)"
        fontSize={Math.max(130, (hit * 12) / 44)}
        className="font-mono"
      >
        {cm(layout.room.depth)} cm
      </text>
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
              rx="30"
              fill="none"
              stroke="var(--graphite)"
              strokeWidth={(hit * 2) / 44}
              strokeDasharray={`${(hit * 4) / 44} ${(hit * 3) / 44}`}
            />
            <rect
              className="room-footprint"
              x={r.x0}
              y={r.z0}
              width={w}
              height={d}
              rx="30"
              fill={item.kind === 'block' ? 'var(--line)' : 'var(--kraft)'}
              stroke={chosen ? 'var(--amber)' : 'var(--graphite-2)'}
              strokeWidth={chosen ? 30 : 14}
              strokeDasharray={item.elevation ? '45 30' : undefined}
            />
            {frontEdge && <line className="pointer-events-none" x1={frontEdge[0]} y1={frontEdge[1]} x2={frontEdge[2]} y2={frontEdge[3]} stroke="var(--graphite)" strokeWidth="50" />}
            {bad.has(item.id) && (
              <rect x={r.x0 + 40} y={r.z0 + 40} width={Math.max(1, w - 80)} height={Math.max(1, d - 80)} fill="none" stroke="var(--rust)" strokeWidth="18" strokeDasharray="35 25" />
            )}
            <text x={item.x} y={item.z + 40} textAnchor="middle" fontSize={Math.max(145, (hit * 12) / 44)} fill="var(--graphite)" className="font-mono pointer-events-none">
              {index + 1}
              {bad.has(item.id) ? ' !' : ''}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
