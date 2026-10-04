import { CameraControls, ContactShadows, Environment, Grid, Lightformer, PerformanceMonitor } from '@react-three/drei'
import { Canvas, useFrame, useThree, type RootState } from '@react-three/fiber'
import { EffectComposer, N8AO } from '@react-three/postprocessing'
import { useEffect, useMemo, useRef, useState, type ComponentProps } from 'react'
import { Vector3 } from 'three'
import type { Design } from '../../domain/design/schema'
import type { Box, Geometry } from '../../domain/design/resolve'
import { materialById, type Catalog } from '../../domain/materials/catalog'
import { boardLook } from '../../domain/materials/grades'
import { finishOf } from '../../domain/materials/finishes'
import { hiddenIn, useStore, type View } from '../store'
import { DimensionLines } from './DimensionLines'
import { edgeNeighbours, profilesOf } from '../../domain/design/edges'
import { EDGE_PROFILES } from '../../domain/materials/edgeProfiles'
import { assembled, explode, type Explosion } from './explode'
import { opening, type Swing } from './open'
import { Hardware } from './Hardware'
import { PieceMeasures } from './PieceMeasures'
import { Sawdust } from './Sawdust'
import type { EdgeShape } from './edgeGeometry'
import { PieceMesh } from './PieceMesh'
import { RemovedGhost } from './RemovedGhost'
import { useReducedMotion, useDark, useTouch } from './preferences'

const MM = 0.001
const FOV = 35
/** A chamfer has no radius: this is the size of its cut, in mm. */
const CHAMFER = 3
const NO_SHAPES: EdgeShape[] = []
const NO_SWINGS = new Map<string, Swing>()

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

/** Runs once per frame, in the order it mounts among its siblings. */
function EachFrame({ run }: { run: (state: RootState) => void }) {
  useFrame(run)
  return null
}

// The shadow's blur pass draws a plane at the floor, which must be in front of its camera, and the grid must stay behind it or it shadows itself.
const SHADOW_Y = -0.001
const SHADOW_NEAR = 0.0005
const GRID_Y = -0.00075

/** The ground shadow, redrawn from scratch every frame; without clearing, every place a piece has been stays on the floor. */
function GroundShadow(props: Omit<ComponentProps<typeof ContactShadows>, 'position' | 'near'>) {
  const saved = useRef(true)
  // The effect composer keeps autoClear off while mounted, and ContactShadows needs it to clear its target; subscribers of one priority run in mount order.
  return (
    <>
      <EachFrame
        run={({ gl }) => {
          saved.current = gl.autoClear
          gl.autoClear = true
        }}
      />
      <ContactShadows position={[0, SHADOW_Y, 0]} near={SHADOW_NEAR} {...props} />
      <EachFrame run={({ gl }) => void (gl.autoClear = saved.current)} />
    </>
  )
}

/** Directions the camera looks from, toward the middle of what is shown. */
const VIEWPOINTS: Record<View, [number, number, number]> = {
  front: [0, 0.12, 1],
  side: [1, 0.12, 0],
  'three-quarter': [0.62, 0.48, 0.72],
  top: [0, 1, 0.001],
}

/** Frames the box around what is shown, or around the selected piece so the camera turns and zooms about it. */
function CameraRig({ frame, focus, focusId, reduced }: { frame: Box; focus: Box | null; focusId: string | null; reduced: boolean }) {
  const controls = useRef<CameraControls>(null)
  const view = useStore((s) => s.view)
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height))
  const latest = useRef({ frame, focus })
  useEffect(() => void (latest.current = { frame, focus }))

  const place = (keepDirection: boolean) => {
    const c = controls.current
    if (!c) return
    const { x0, x1, y0, y1, z0, z1 } = latest.current.focus ?? latest.current.frame
    const [a, h, f] = [(x1 - x0) * MM, (y1 - y0) * MM, (z1 - z0) * MM]
    const radius = Math.hypot(a, h, f) / 2
    const vertical = (FOV * Math.PI) / 180
    const narrowest = Math.min(vertical, 2 * Math.atan(Math.tan(vertical / 2) * aspect))
    const d = Math.max(0.45, (radius / Math.sin(narrowest / 2)) * 1.1 + 0.15)
    // Aimed a little above the middle, so the scene bar over the top of the 3D does not cover it.
    const target = [((x0 + x1) / 2) * MM, ((y0 + y1) / 2) * MM + d * Math.tan(vertical / 2) * 0.12, ((z0 + z1) / 2) * MM]
    const [dx, dy, dz] = keepDirection ? c.getPosition(new Vector3()).sub(c.getTarget(new Vector3())).toArray() : VIEWPOINTS[view.name]
    const n = Math.hypot(dx, dy, dz) || 1
    void c.setLookAt(target[0] + (dx / n) * d, target[1] + (dy / n) * d, target[2] + (dz / n) * d, target[0], target[1], target[2], !reduced)
  }

  const { x0, x1, y0, y1, z0, z1 } = frame
  useEffect(() => place(false), [view, aspect, reduced]) // eslint-disable-line react-hooks/exhaustive-deps
  const placed = useRef(false)
  useEffect(() => {
    if (placed.current) place(true)
    placed.current = true
  }, [x0, x1, y0, y1, z0, z1]) // eslint-disable-line react-hooks/exhaustive-deps
  // Choosing or leaving a piece keeps the angle the person is looking from; editing its size does not move the camera.
  useEffect(() => place(true), [focusId]) // eslint-disable-line react-hooks/exhaustive-deps

  return <CameraControls ref={controls} makeDefault dollyToCursor minDistance={0.15} maxDistance={12} maxPolarAngle={Math.PI / 2 - 0.02} smoothTime={reduced ? 0.01 : 0.35} draggingSmoothTime={reduced ? 0.01 : 0.125} />
}

export function Scene({ design, geo, catalog, ghosts, marked, problems = [] }: SceneProps) {
  const selection = useStore((s) => s.selection)
  const focused = useStore((s) => s.focus)
  const mode = useStore((s) => s.mode)
  const exploded = mode === 'exploded'
  const dimensions = useStore((s) => s.dimensions)
  const changes = useStore((s) => s.changes)
  const reveal = useStore((s) => s.reveal)
  const select = useStore((s) => s.select)
  const hiddenIds = useStore((s) => s.hidden)
  const hidden = useMemo(() => hiddenIn(hiddenIds, design), [hiddenIds, design])
  const shown = useMemo(() => design.pieces.filter((p) => !hidden.includes(p.id)), [design, hidden])
  const touch = useTouch()
  const reduced = useReducedMotion()
  const [quality, setQuality] = useState(!touch)
  const dark = useDark()

  const explosion: Explosion & { swings?: Map<string, Swing> } = useMemo(() => (mode === 'exploded' ? explode : mode === 'open' ? opening : assembled)(design, geo.boxes), [geo, design, mode])
  const swings = explosion.swings ?? NO_SWINGS
  const { width, depth } = design.dimensions
  // The furniture group is centered on the origin, so the camera frames the same box shifted with it.
  const frame = useMemo(() => {
    const b = explosion.bounds
    return { ...b, x0: b.x0 - width / 2, x1: b.x1 - width / 2, z0: b.z0 - depth / 2, z1: b.z1 - depth / 2 }
  }, [explosion, width, depth])
  const pushes = useMemo(() => new Map([...explosion.offsets].map(([id, [x, y, z]]) => [id, [x * MM, y * MM, z * MM] as [number, number, number]])), [explosion])
  const focusId = focused && focused === selection && shown.some((p) => p.id === focused) ? focused : null
  const focus = useMemo(() => {
    const box = focusId ? geo.boxes.get(focusId) : undefined
    if (!box) return null
    const [dx, dy, dz] = explosion.offsets.get(focusId!) ?? [0, 0, 0]
    return { x0: box.x0 + dx - width / 2, x1: box.x1 + dx - width / 2, y0: box.y0 + dy, y1: box.y1 + dy, z0: box.z0 + dz - depth / 2, z1: box.z1 + dz - depth / 2 }
  }, [focusId, geo, explosion, width, depth])
  // A material not in the catalog is drawn as the usual board: pine plywood of 18 mm.
  const lookOf = (material: string) => {
    const board = materialById(catalog, material)
    return board ? boardLook(board.grade, board.thickness) : boardLook('pine-plywood', 18)
  }
  // Only the edges that show are cut; the ones that rest against another piece stay square.
  const shapesOf = useMemo(() => {
    const by = new Map<string, EdgeShape[]>()
    for (const p of design.pieces) {
      const chosen = profilesOf(design, p.id)
      if (!chosen.length) continue
      const free = new Set(edgeNeighbours(design, geo, p.id).filter((n) => !n.against).map((n) => n.edge))
      by.set(p.id, chosen.filter((c) => free.has(c.edge)).map((c) => ({ edge: c.edge, radius: (EDGE_PROFILES[c.profile].radius ?? CHAMFER) * MM, round: EDGE_PROFILES[c.profile].radius !== null })))
    }
    return by
  }, [design, geo])
  const finish = finishOf(design)
  const order = useMemo(() => [...design.pieces].sort((a, b) => geo.boxes.get(a.id)!.y0 - geo.boxes.get(b.id)!.y0).map((p) => p.id), [design, geo])

  return (
    <Canvas frameloop="demand" shadows dpr={[1, touch ? 1.5 : quality ? 2 : 1.25]} camera={{ fov: FOV, near: 0.05, far: 60, position: [2.2, 1.8, 2.6] }} gl={{ antialias: true, alpha: true }} onPointerMissed={() => select(null)}>
      <PerformanceMonitor onDecline={() => setQuality(false)} onIncline={() => setQuality(true)} />
      <CameraRig frame={frame} focus={focus} focusId={focusId} reduced={reduced} />
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
        {shown.map((p) => (
          <PieceMesh
            key={`${p.id}-${reveal}`}
            piece={p}
            box={geo.boxes.get(p.id)!}
            tone={lookOf(p.material).tone}
            plies={lookOf(p.material).plies}
            offset={pushes.get(p.id)!}
            swing={swings.get(p.id) ?? null}
            selected={selection === p.id}
            dimmed={!!selection && selection !== p.id}
            ghost={ghosts.includes(p.id)}
            marked={marked.includes(p.id)}
            problem={problems.includes(p.id)}
            highlight={changes.modified.includes(p.id) ? changes.nonce : 0}
            isNew={changes.added.includes(p.id)}
            reduced={reduced}
            delay={changes.added.includes(p.id) ? 0 : order.indexOf(p.id) * 70}
            shapes={shapesOf.get(p.id) ?? NO_SHAPES}
            finish={finish}
            onSelect={select}
          />
        ))}
        <Hardware design={design} geo={geo} offsets={pushes} swings={swings} selected={selection} hidden={hidden} reduced={reduced} />
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
        {dimensions && exploded && <PieceMeasures design={{ ...design, pieces: shown }} geo={geo} offsets={pushes} dark={dark} selected={selection} />}
      </group>

      <GroundShadow opacity={dark ? 0.6 : 0.45} scale={6} blur={2.4} far={2.5} color="#3a2a1a" />
      <Grid
        position={[0, GRID_Y, 0]}
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
