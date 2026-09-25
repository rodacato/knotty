import { CameraControls, ContactShadows, Environment, Grid, Lightformer, PerformanceMonitor } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { EffectComposer, N8AO } from '@react-three/postprocessing'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Design } from '../../domain/design/schema'
import type { Geometry } from '../../domain/design/resolve'
import type { Catalog } from '../../domain/materials/catalog'
import { useStore, type View } from '../store'
import { DimensionLines } from './DimensionLines'
import { Hardware } from './Hardware'
import { PieceMeasures } from './PieceMeasures'
import { Sawdust } from './Sawdust'
import { PieceMesh } from './PieceMesh'
import { RemovedGhost } from './RemovedGhost'
import { useReducedMotion, useDark, useTouch } from './preferences'

const MM = 0.001

interface SceneProps {
  design: Design
  geo: Geometry
  catalog: Catalog
  /** New pieces from a proposal: amber ghost. */
  ghosts: string[]
  /** Pieces a proposal changes: amber edges. */
  marked: string[]
  /** Pieces with unresolved validation problems. */
  problems?: string[]
}

/** How far each piece moves apart in the assembly view: away from the center, mostly along its thickness, never below the floor. */
function offsets(geo: Geometry, design: Design, active: boolean) {
  const zero = new Map(design.pieces.map((p) => [p.id, [0, 0, 0] as [number, number, number]]))
  if (!active) return { pushes: zero, height: design.dimensions.height * MM }
  const { width, height, depth: background } = design.dimensions
  const center = { x: width / 2, y: height / 2, z: background / 2 }
  const scale = Math.max(width, background, height * 0.5)
  // Drawers slide out whole towards the front, as if opened, instead of coming apart.
  const drawers = new Map<string, number>()
  for (const p of design.pieces)
    if (p.group && p.role === 'drawer-side' && p.normal === 'x') {
      const c = geo.boxes.get(p.id)!
      const front = design.pieces.find((q) => q.group === p.group && q.role === 'drawer-front')
      const f = front && geo.boxes.get(front.id)
      // A drawer on the far side of a bed opens backward.
      const direction = f && (f.z0 + f.z1) / 2 < (c.z0 + c.z1) / 2 ? -1 : 1
      drawers.set(p.group, (c.z1 - c.z0) * 0.75 * direction)
    }
  const raw = design.pieces.map((p) => {
    const c = geo.boxes.get(p.id)!
    const output = p.group ? drawers.get(p.group) : undefined
    if (output !== undefined) return { id: p.id, c, push: { x: 0, y: 0, z: output } }
    const d = { x: (c.x0 + c.x1) / 2 - center.x, y: (c.y0 + c.y1) / 2 - center.y, z: (c.z0 + c.z1) / 2 - center.z }
    const n = p.normal
    const side = Math.sign(d[n]) || (n === 'z' ? -1 : 1)
    const push = { x: d.x * 0.3, y: d.y * 0.18, z: d.z * 0.3 }
    push[n] += side * scale * 0.22 + d[n] * (n === 'y' ? 0.25 : 0.35)
    return { id: p.id, c, push }
  })
  const lift = Math.max(0, ...raw.map(({ c, push }) => -(c.y0 + push.y))) + (raw.some(({ c, push }) => c.y0 + push.y < 0) ? 20 : 0)
  const pushes = new Map(raw.map(({ id, push }) => [id, [push.x * MM, (push.y + lift) * MM, push.z * MM] as [number, number, number]]))
  const cap = Math.max(...raw.map(({ c, push }) => c.y1 + push.y + lift))
  return { pushes, height: cap * MM }
}

function CameraRig({ design, visibleHeight, reduced }: { design: Design; visibleHeight: number; reduced: boolean }) {
  const controls = useRef<CameraControls>(null)
  const view = useStore((s) => s.view)
  const exploded = useStore((s) => s.exploded)
  const { width, height, depth: background } = design.dimensions

  useEffect(() => {
    const c = controls.current
    if (!c) return
    const a = width * MM
    const h = visibleHeight
    const f = background * MM
    const d = Math.max(a * (exploded ? 1.5 : 1), h, f * (exploded ? 1.5 : 1)) * 1.7 + 0.4
    const positions: Record<View, [number, number, number]> = {
      front: [0, h / 2, d + f / 2],
      side: [d + a / 2, h / 2, 0],
      'three-quarter': [d * 0.72, h * 0.7 + d * 0.28, d * 0.82],
      top: [0, d + h, 0.001],
    }
    const [x, y, z] = positions[view.name]
    void c.setLookAt(x, y, z, 0, h / 2, 0, !reduced)
  }, [view, width, height, background, exploded, visibleHeight, reduced])

  return <CameraControls ref={controls} makeDefault minDistance={0.3} maxDistance={12} maxPolarAngle={Math.PI / 2 - 0.02} smoothTime={0.35} />
}

export function Scene({ design, geo, catalog, ghosts, marked, problems = [] }: SceneProps) {
  const selection = useStore((s) => s.selection)
  const exploded = useStore((s) => s.exploded)
  const dimensions = useStore((s) => s.dimensions)
  const changes = useStore((s) => s.changes)
  const reveal = useStore((s) => s.reveal)
  const select = useStore((s) => s.select)
  const touch = useTouch()
  const reduced = useReducedMotion()
  const [quality, setQuality] = useState(!touch)
  const dark = useDark()

  const { pushes, height: visibleHeight } = useMemo(() => offsets(geo, design, exploded), [geo, design, exploded])
  const kindOf = (material: string) => (catalog.materials.find((m) => m.id === material)?.type === 'back' ? 'back' : 'plywood')
  const order = useMemo(() => [...design.pieces].sort((a, b) => geo.boxes.get(a.id)!.y0 - geo.boxes.get(b.id)!.y0).map((p) => p.id), [design, geo])

  return (
    <Canvas frameloop="demand" shadows dpr={[1, touch ? 1.5 : quality ? 2 : 1.25]} camera={{ fov: 35, near: 0.05, far: 60, position: [2.2, 1.8, 2.6] }} gl={{ antialias: true, alpha: true }} onPointerMissed={() => select(null)}>
      <PerformanceMonitor onDecline={() => setQuality(false)} onIncline={() => setQuality(true)} />
      <CameraRig design={design} visibleHeight={visibleHeight} reduced={reduced} />
      <hemisphereLight args={[dark ? '#6b5f52' : '#fff6e8', dark ? '#1a1612' : '#b89a78', dark ? 0.5 : 0.8]} />
      <directionalLight position={[2.5, 4.5, 3.2]} intensity={dark ? 1.6 : 2.1} color="#fff1dc" castShadow shadow-mapSize={touch ? [1024, 1024] : [2048, 2048]} shadow-bias={-0.0004}>
        <orthographicCamera attach="shadow-camera" args={[-2.5, 2.5, 2.5, -2.5, 0.1, 12]} />
      </directionalLight>
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2} position={[0, 4, 2]} scale={[6, 2, 1]} color="#fff4e2" />
        <Lightformer form="rect" intensity={0.8} position={[-4, 1.5, 0]} rotation-y={Math.PI / 2} scale={[4, 3, 1]} color="#ffe2c0" />
        <Lightformer form="rect" intensity={0.6} position={[4, 1.5, -1]} rotation-y={-Math.PI / 2} scale={[4, 3, 1]} color="#dfe7ff" />
      </Environment>

      <group position={[(-design.dimensions.width / 2) * MM, 0, (-design.dimensions.depth / 2) * MM]}>
        {design.pieces.map((p) => (
          <PieceMesh
            key={`${p.id}-${reveal}`}
            piece={p}
            box={geo.boxes.get(p.id)!}
            tone={kindOf(p.material)}
            offset={pushes.get(p.id)!}
            selected={selection === p.id}
            dimmed={!!selection && selection !== p.id}
            ghost={ghosts.includes(p.id)}
            marked={marked.includes(p.id)}
            problem={problems.includes(p.id)}
            highlight={changes.modified.includes(p.id) ? changes.nonce : 0}
            isNew={changes.added.includes(p.id)}
            reduced={reduced}
            delay={changes.added.includes(p.id) ? 0 : order.indexOf(p.id) * 70}
            onSelect={select}
          />
        ))}
        <Hardware design={design} geo={geo} offsets={pushes} selected={selection} />
        {changes.removed.filter(() => !reduced).map(({ piece, box }) => (
          <RemovedGhost key={`${piece.id}-${changes.nonce}`} box={box} />
        ))}
        {changes.added
          .filter((id) => !reduced && geo.boxes.has(id))
          .map((id) => {
            const c = geo.boxes.get(id)!
            const [dx, dy, dz] = pushes.get(id) ?? [0, 0, 0]
            return <Sawdust key={`${id}-${changes.nonce}`} en={[((c.x0 + c.x1) / 2) * MM + dx, c.y0 * MM + dy, ((c.z0 + c.z1) / 2) * MM + dz]} />
          })}
        {dimensions && !exploded && <DimensionLines dimensions={design.dimensions} dark={dark} />}
        {dimensions && exploded && <PieceMeasures design={design} geo={geo} offsets={pushes} dark={dark} selected={selection} />}
      </group>

      <ContactShadows position={[0, 0.0005, 0]} opacity={dark ? 0.6 : 0.45} scale={6} blur={2.4} far={2.5} color="#3a2a1a" />
      <Grid
        position={[0, 0, 0]}
        args={[20, 20]}
        cellSize={0.1}
        cellThickness={0.6}
        cellColor={dark ? '#3a332c' : '#d9ccb8'}
        sectionSize={0.5}
        sectionThickness={1}
        sectionColor={dark ? '#4a4038' : '#c9b89e'}
        fadeDistance={9}
        fadeStrength={1.5}
        infiniteGrid
      />
      {quality && (
        <EffectComposer multisampling={0}>
          <N8AO aoRadius={0.25} distanceFalloff={0.6} intensity={2.2} quality="medium" halfRes />
        </EffectComposer>
      )}
    </Canvas>
  )
}
