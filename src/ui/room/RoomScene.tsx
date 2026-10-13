import { CameraControls, Environment, Lightformer, Line } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Group } from 'three'
import { resolveGeometry } from '../../domain/design/resolve'
import { edgeNeighbours, profilesOf } from '../../domain/design/edges'
import { EDGE_PROFILES } from '../../domain/materials/edgeProfiles'
import { materialById } from '../../domain/materials/catalog'
import { boardLook } from '../../domain/materials/grades'
import { finishOf } from '../../domain/materials/finishes'
import { PieceMesh } from '../scene/PieceMesh'
import type { EdgeShape } from '../scene/edgeGeometry'
import { useReducedMotion } from '../scene/preferences'
import { useServices } from '../services'
import { openingProblem, rectOf, sizeOf, type Item, type Layout, type Wall } from './layout'
import { wallPoint } from './RoomPlan'
import { useRoom } from './store'

const MM = 0.001
const NO_SHAPES: EdgeShape[] = []
function readColors() {
  const style = getComputedStyle(document.documentElement)
  return Object.fromEntries(['color-brand-paper', 'color-drawing-paper', 'color-pine', 'graphite-2', 'amber', 'rust', 'slate'].map((key) => [key, style.getPropertyValue(`--${key}`).trim()]))
}
function useColors() {
  const [colors, setColors] = useState(readColors)
  useEffect(() => {
    const observer = new MutationObserver(() => setColors(readColors()))
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => observer.disconnect()
  }, [])
  return colors
}
function Furniture({ item }: { item: Extract<Item, { kind: 'furniture' }> }) {
  const { catalog } = useServices(),
    reduced = useReducedMotion()
  const { design } = item.source
  const resolved = useMemo(() => resolveGeometry(design, catalog), [design, catalog])
  const shapes = useMemo(() => {
    const by = new Map<string, EdgeShape[]>()
    if (!resolved.ok) return by
    for (const p of design.pieces) {
      const chosen = profilesOf(design, p.id)
      if (!chosen.length) continue
      const free = new Set(
        edgeNeighbours(design, resolved.value, p.id)
          .filter((n) => !n.against)
          .map((n) => n.edge),
      )
      by.set(
        p.id,
        chosen
          .filter((c) => free.has(c.edge))
          .map((c) => ({
            edge: c.edge,
            radius: (EDGE_PROFILES[c.profile].radius ?? 3) * MM,
            round: EDGE_PROFILES[c.profile].radius !== null,
          })),
      )
    }
    return by
  }, [design, resolved])
  if (!resolved.ok)
    return (
      <mesh position={[0, (design.dimensions.height * MM) / 2, 0]}>
        <boxGeometry args={[design.dimensions.width * MM, design.dimensions.height * MM, design.dimensions.depth * MM]} />
        <meshStandardMaterial color="#b3a896" wireframe />
      </mesh>
    )
  return (
    <group position={[(-design.dimensions.width * MM) / 2, 0, (-design.dimensions.depth * MM) / 2]}>
      {design.pieces.map((piece) => {
        const board = materialById(catalog, piece.material),
          look = boardLook(board?.grade ?? 'pine-plywood', board?.thickness ?? 18)
        return (
          <PieceMesh
            key={piece.id}
            piece={piece}
            box={resolved.value.boxes.get(piece.id)!}
            tone={look.tone}
            plies={look.plies}
            offset={[0, 0, 0]}
            swing={null}
            selected={false}
            dimmed={false}
            ghost={false}
            marked={false}
            problem={false}
            highlight={0}
            isNew={false}
            reduced={reduced}
            delay={0}
            shapes={shapes.get(piece.id) ?? NO_SHAPES}
            finish={finishOf(design)}
            onSelect={() => useRoom.getState().select(item.id)}
          />
        )
      })}
    </group>
  )
}

function WallMesh({ layout, wall, color, windowColor }: { layout: Layout; wall: Wall; color: string; windowColor: string }) {
  const group = useRef<Group>(null)
  const { room } = layout
  const length = wall === 'back' || wall === 'front' ? room.width : room.depth
  const openings = layout.openings.filter((o) => o.wall === wall && !openingProblem(room, o, layout.openings))
  const xs = [...new Set([0, length, ...openings.flatMap((o) => [o.offset, o.offset + o.width])])].sort((a, b) => a - b)
  const ys = [...new Set([0, room.height, ...openings.flatMap((o) => [o.kind === 'door' ? 0 : o.sill, (o.kind === 'door' ? 0 : o.sill) + o.height])])].sort((a, b) => a - b)
  useFrame(({ camera }) => {
    if (!group.current) return
    const x = camera.position.x / MM + room.width / 2,
      z = camera.position.z / MM + room.depth / 2
    group.current.visible = wall === 'back' ? z > 0 : wall === 'front' ? z < room.depth : wall === 'left' ? x > 0 : x < room.width
  })
  return (
    <group ref={group}>
      {xs.slice(0, -1).flatMap((left, xi) =>
        ys.slice(0, -1).flatMap((bottom, yi) => {
          const w = xs[xi + 1] - left,
            h = ys[yi + 1] - bottom
          if (
            openings.some(
              (o) => left + w / 2 > o.offset && left + w / 2 < o.offset + o.width && bottom + h / 2 > (o.kind === 'door' ? 0 : o.sill) && bottom + h / 2 < (o.kind === 'door' ? 0 : o.sill) + o.height,
            )
          )
            return []
          const [x, z] = wallPoint(layout, wall, left + w / 2, -30)
          return [
            <mesh key={`${xi}-${yi}`} position={[x * MM, (bottom + h / 2) * MM, z * MM]} rotation-y={wall === 'left' || wall === 'right' ? Math.PI / 2 : 0}>
              <boxGeometry args={[w * MM, h * MM, 0.06]} />
              <meshStandardMaterial color={color} />
            </mesh>,
          ]
        }),
      )}
      {openings
        .filter((o) => o.kind === 'window')
        .map((o) => {
          const [x, z] = wallPoint(layout, wall, o.offset + o.width / 2, 0)
          return (
            <group key={o.id} position={[x * MM, (o.sill + o.height / 2) * MM, z * MM]} rotation-y={wall === 'left' || wall === 'right' ? Math.PI / 2 : 0}>
              <mesh>
                <boxGeometry args={[o.width * MM, o.height * MM, 0.015]} />
                <meshStandardMaterial color={windowColor} transparent opacity={0.35} />
              </mesh>
              <mesh>
                <boxGeometry args={[0.035, o.height * MM, 0.035]} />
                <meshStandardMaterial color={color} />
              </mesh>
            </group>
          )
        })}
    </group>
  )
}

function Contents({ layout, bad }: { layout: Layout; bad: Set<string> }) {
  const selected = useRoom((s) => s.selected),
    reduced = useReducedMotion()
  const controls = useRef<CameraControls>(null)
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height))
  const colors = useColors()
  useEffect(() => {
    const span = Math.hypot(layout.room.width, layout.room.depth) * MM
    const distance = Math.max(4, span * Math.max(1.3, 1 / aspect))
    void controls.current?.setLookAt(distance * 0.55, distance * 0.7, distance * 0.75, 0, layout.room.height * MM * 0.22, 0, !reduced)
  }, [layout.room.width, layout.room.depth, layout.room.height, aspect, reduced])
  return (
    <>
      <CameraControls ref={controls} makeDefault minDistance={1} maxDistance={35} maxPolarAngle={Math.PI / 2 - 0.02} smoothTime={reduced ? 0.01 : 0.15} />
      <hemisphereLight args={['#fff6e8', '#b89a78', 1]} />
      <directionalLight position={[2.5, 4.5, 3.2]} intensity={2.1} color="#fff1dc" />
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={2} position={[0, 4, 2]} scale={[6, 2, 1]} color="#fff4e2" />
      </Environment>
      <group position={[(-layout.room.width * MM) / 2, 0, (-layout.room.depth * MM) / 2]}>
        <mesh rotation-x={-Math.PI / 2} position={[(layout.room.width * MM) / 2, -0.005, (layout.room.depth * MM) / 2]}>
          <planeGeometry args={[layout.room.width * MM, layout.room.depth * MM]} />
          <meshStandardMaterial color={colors['color-drawing-paper']} />
        </mesh>
        {(['back', 'left', 'front', 'right'] as Wall[]).map((wall) => (
          <WallMesh key={wall} layout={layout} wall={wall} color={colors['color-brand-paper']} windowColor={colors.slate} />
        ))}
        {layout.openings
          .filter((o) => o.kind === 'door' && o.swing !== 'sliding' && !openingProblem(layout.room, o, layout.openings))
          .map((o) => {
            const [x, z] = wallPoint(layout, o.wall, o.hinge === 'start' ? o.offset : o.offset + o.width, ((o.swing === 'inside' ? 1 : -1) * o.width) / 2)
            return (
              <mesh key={o.id} position={[x * MM, (o.height * MM) / 2, z * MM]} rotation-y={o.wall === 'front' || o.wall === 'back' ? Math.PI / 2 : 0}>
                <boxGeometry args={[o.width * MM, o.height * MM, 0.025]} />
                <meshStandardMaterial color={colors['color-pine']} />
              </mesh>
            )
          })}
        {layout.items.map((item) => {
          const s = sizeOf(item),
            r = rectOf(item)
          const footprint: [number, number, number][] = [
            [r.x0 * MM, 0.005, r.z0 * MM],
            [r.x1 * MM, 0.005, r.z0 * MM],
            [r.x1 * MM, 0.005, r.z1 * MM],
            [r.x0 * MM, 0.005, r.z1 * MM],
            [r.x0 * MM, 0.005, r.z0 * MM],
          ]
          return (
            <group key={item.id}>
              <group position={[item.x * MM, item.elevation * MM, item.z * MM]} rotation-y={(-item.turn * Math.PI) / 180}>
                {item.kind === 'furniture' ? (
                  <Furniture item={item} />
                ) : (
                  <mesh
                    position={[0, (s.height * MM) / 2, 0]}
                    onClick={(e) => {
                      e.stopPropagation()
                      useRoom.getState().select(item.id)
                    }}
                  >
                    <boxGeometry args={[s.width * MM, s.height * MM, s.depth * MM]} />
                    <meshStandardMaterial color={colors['graphite-2']} transparent opacity={0.35} />
                  </mesh>
                )}
              </group>
              {(selected === item.id || bad.has(item.id)) && (
                <Line points={footprint} color={selected === item.id ? colors.amber : colors.rust} lineWidth={selected === item.id ? 3 : 2} dashed={bad.has(item.id)} dashSize={0.04} gapSize={0.03} />
              )}
            </group>
          )
        })}
      </group>
    </>
  )
}

export function RoomScene({ layout, bad }: { layout: Layout; bad: Set<string> }) {
  return (
    <Canvas frameloop="demand" dpr={[1, 1.5]} camera={{ fov: 40, near: 0.05, far: 100, position: [4, 5, 6] }} gl={{ antialias: true, alpha: true }}>
      <Contents layout={layout} bad={bad} />
    </Canvas>
  )
}
