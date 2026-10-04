import { Edges, Html } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { Plane, Raycaster, Vector2, Vector3 } from 'three'
import type { Geometry } from '../../domain/design/resolve'
import type { CabinetPlan } from '../../domain/furniture/modules/cabinet'
import { cellAt, cellLayout, joinCells, joinSides, moveLine, splitCell, type CellPath, type JoinSide, type LineRect } from '../../domain/furniture/modules/cabinetCells'
import { useStore } from '../store'

// The interior view (UI-68): each cell can be chosen on the furniture, its lines dragged, and the chosen one cut or joined where it sits.

const MM = 0.001
/** In front of the furniture by this much, in mm, so a cell catches the pointer before the boards behind it. */
const LIFT = 4
/** A line moves in steps of this many mm, and leaves no part narrower than the least. */
const STEP = 10
const LEAST = 90
const AMBER = '#d98a2b'

const samePath = (a: CellPath | null, b: CellPath) => !!a && a.join('.') === b.join('.')
const SIDE_WORDS: Record<JoinSide, string> = { up: 'arriba', down: 'abajo', left: 'la izquierda', right: 'la derecha' }
const SIDE_ARROW: Record<JoinSide, string> = { up: '↑', down: '↓', left: '←', right: '→' }
/** Each «Juntar» sits on the far side of the line it removes, so two of them never cover each other in a short cell. */
const SIDE_SHIFT: Record<JoinSide, string> = { up: 'translate(-50%, calc(-100% - 2px))', down: 'translate(-50%, 2px)', left: 'translate(calc(-100% - 2px), -50%)', right: 'translate(2px, -50%)' }

/** Where a pointer on the screen meets the front of the furniture, in the furniture's mm. */
function useFrontPoint(width: number, depth: number) {
  const camera = useThree((s) => s.camera)
  const canvas = useThree((s) => s.gl.domElement)
  return (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect()
    const ray = new Raycaster()
    ray.setFromCamera(new Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1), camera)
    const hit = ray.ray.intersectPlane(new Plane(new Vector3(0, 0, 1), -(depth / 2 + LIFT) * MM), new Vector3())
    return hit ? { x: hit.x / MM + width / 2, y: hit.y / MM } : null
  }
}

function LineHandle({ line, plan, width, depth }: { line: LineRect; plan: CabinetPlan; width: number; depth: number }) {
  const editPlan = useStore((s) => s.editPlan)
  const three = useThree((s) => s.get)
  // The camera stays put while a line is dragged; read when the drag starts, not while rendering.
  const orbit = (enabled: boolean) => {
    const controls = three().controls as { enabled: boolean } | null
    if (controls) controls.enabled = enabled
  }
  const frontPoint = useFrontPoint(width, depth)
  const [moving, setMoving] = useState(false)
  const start = useRef<{ plan: CabinetPlan; moved: boolean } | null>(null)
  const span = line.end - line.start
  const to = (from: CabinetPlan, mm: number, merge: boolean) => editPlan(moveLine(from, line, (Math.round(mm / STEP) * STEP - line.start) / span, LEAST / span), merge)
  const vertical = line.axis === 'columns'
  const mid = (line.from + line.to) / 2

  const down = (e: PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    start.current = { plan, moved: false }
    orbit(false)
    setMoving(true)
  }
  const move = (e: PointerEvent<HTMLButtonElement>) => {
    const s = start.current
    const p = s && frontPoint(e.clientX, e.clientY)
    if (!s || !p) return
    to(s.plan, vertical ? p.x : p.y, s.moved)
    s.moved = true
  }
  const up = () => {
    start.current = null
    orbit(true)
    setMoving(false)
  }
  const key = (e: KeyboardEvent<HTMLButtonElement>) => {
    const d = { ArrowLeft: -STEP, ArrowDown: -STEP, ArrowRight: STEP, ArrowUp: STEP }[e.key]
    if (d === undefined) return
    e.preventDefault()
    to(plan, line.position + d, false)
  }

  return (
    <Html position={[(vertical ? line.position : mid) * MM, (vertical ? mid : line.position) * MM, (depth + LIFT) * MM]} center zIndexRange={[20, 10]}>
      <button
        type="button"
        role="slider"
        aria-label={vertical ? 'Línea entre columnas' : 'Línea entre huecos'}
        aria-valuemin={Math.round(line.start)}
        aria-valuemax={Math.round(line.end)}
        aria-valuenow={Math.round(line.position)}
        aria-valuetext={`${Math.round(line.position - line.start)} mm de un lado y ${Math.round(line.end - line.position)} del otro`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onKeyDown={key}
        className={`grid size-11 touch-none place-items-center rounded-full ${vertical ? 'cursor-ew-resize' : 'cursor-ns-resize'}`}
      >
        <span className={`block size-4 rounded-full border-2 border-amber ${moving ? 'bg-amber' : 'bg-bone'}`} />
      </button>
      {moving && (
        <span className="numerals pointer-events-none absolute top-full left-1/2 -translate-x-1/2 rounded-full border border-line bg-paper px-2 py-0.5 font-mono text-xs whitespace-nowrap text-graphite">
          {Math.round(line.position - line.start)} · {Math.round(line.end - line.position)} mm
        </span>
      )}
    </Html>
  )
}

/** What the chosen cell can do where it sits: cut it, and on each side it can lose, join. */
function CellActions({ plan, path, box, depth }: { plan: CabinetPlan; path: CellPath; box: { x0: number; x1: number; y0: number; y1: number }; depth: number }) {
  const editPlan = useStore((s) => s.editPlan)
  const selectCell = useStore((s) => s.selectCell)
  const z = (depth + LIFT) * MM
  const cut = (direction: 'columns' | 'rows') => {
    const next = splitCell(plan, path, direction, 2)
    if (!next) return
    editPlan(next)
    // A cell that became a split one is chosen in its first part.
    selectCell(cellAt(next, path) ? path : [...path, 0, 0])
  }
  const join = (side: JoinSide) => {
    const r = joinCells(plan, path, side)
    if (!r) return
    editPlan(r.plan)
    selectCell(r.path)
  }
  const at: Record<JoinSide, [number, number]> = { up: [(box.x0 + box.x1) / 2, box.y1], down: [(box.x0 + box.x1) / 2, box.y0], left: [box.x0, (box.y0 + box.y1) / 2], right: [box.x1, (box.y0 + box.y1) / 2] }
  const sides = joinSides(plan, path)
  const button = 'min-h-10 rounded-full px-3 text-sm font-medium whitespace-nowrap hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-amber'
  return (
    <>
      <Html position={[((box.x0 + box.x1) / 2) * MM, box.y1 * MM, z]} zIndexRange={[30, 20]} style={{ transform: `translate(-50%, calc(-100% - ${sides.includes('up') ? 52 : 12}px))` }}>
        <div role="toolbar" aria-label="Dividir el hueco" className="flex items-center gap-0.5 rounded-full bg-graphite p-1 text-bone shadow-lg">
          <span className="px-2 text-xs opacity-75">Dividir</span>
          <button type="button" className={button} onClick={() => cut('columns')}>
            2 columnas
          </button>
          <button type="button" className={button} onClick={() => cut('rows')}>
            2 filas
          </button>
        </div>
      </Html>
      {sides.map((side) => (
        <Html key={side} position={[at[side][0] * MM, at[side][1] * MM, z]} zIndexRange={[30, 20]} style={{ transform: SIDE_SHIFT[side] }}>
          <button type="button" onClick={() => join(side)} aria-label={`Juntar con el hueco de ${SIDE_WORDS[side]}`} className="relative flex min-h-9 items-center gap-1 rounded-full bg-amber px-3 text-xs before:absolute before:-inset-1 before:content-[''] font-semibold whitespace-nowrap text-[#2b2825] shadow-md focus-visible:outline-2 focus-visible:outline-graphite">
            {SIDE_ARROW[side]} Juntar
          </button>
        </Html>
      ))}
    </>
  )
}

export function InteriorOverlay({ plan, geo, width, depth }: { plan: CabinetPlan; geo: Geometry; width: number; depth: number }) {
  const chosen = useStore((s) => s.cell)
  const selectCell = useStore((s) => s.selectCell)
  const [hover, setHover] = useState<string | null>(null)
  const layout = useMemo(() => cellLayout(plan, geo.boxes), [plan, geo])
  if (!layout) return null
  const z = (depth + LIFT) * MM
  const selected = chosen && layout.cells.find((c) => samePath(chosen, c.path))
  return (
    <group>
      {layout.cells.map((c) => {
        const key = c.path.join('.')
        const on = samePath(chosen, c.path)
        return (
          <mesh
            key={key}
            position={[((c.x0 + c.x1) / 2) * MM, ((c.y0 + c.y1) / 2) * MM, z]}
            onClick={(e) => {
              e.stopPropagation()
              selectCell(on ? null : c.path)
            }}
            onPointerOver={(e) => {
              e.stopPropagation()
              setHover(key)
            }}
            onPointerOut={() => setHover((h) => (h === key ? null : h))}
          >
            <planeGeometry args={[(c.x1 - c.x0) * MM, (c.y1 - c.y0) * MM]} />
            <meshBasicMaterial color={AMBER} transparent opacity={on ? 0.22 : hover === key ? 0.12 : 0} depthWrite={false} />
            {on && <Edges color={AMBER} lineWidth={2} />}
          </mesh>
        )
      })}
      {layout.lines.map((line) => (
        <LineHandle key={`${line.axis}-${line.at.join('.')}-${line.index}`} line={line} plan={plan} width={width} depth={depth} />
      ))}
      {selected && <CellActions plan={plan} path={selected.path} box={selected} depth={depth} />}
    </group>
  )
}
