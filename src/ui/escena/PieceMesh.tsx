import { animated, useSpring } from '@react-spring/three'
import { Edges } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { MeshStandardMaterial, Texture } from 'three'
import type { Axis, Piece } from '../../domain/diseno/schema'
import type { Box } from '../../domain/diseno/resolve'
import { texture, type TextureKind, type Tone } from './textures'

const MM = 0.001
/** (u, v) axes of each BoxGeometry face, in the order of its materials: +x, −x, +y, −y, +z, −z. */
const FACES: { normal: Axis; u: Axis; v: Axis }[] = [
  { normal: 'x', u: 'z', v: 'y' },
  { normal: 'x', u: 'z', v: 'y' },
  { normal: 'y', u: 'x', v: 'z' },
  { normal: 'y', u: 'x', v: 'z' },
  { normal: 'z', u: 'x', v: 'y' },
  { normal: 'z', u: 'x', v: 'y' },
]
const GRAIN_SIZE = 0.45
const FALL = 0.35

function faceTextures(p: Piece, box: Box, tone: Tone): Texture[] {
  const m = { x: box.x1 - box.x0, y: box.y1 - box.y0, z: box.z1 - box.z0 }
  if (p.confidence === 'low')
    return FACES.map((face) => {
      const t = texture('sketch', tone).clone()
      t.repeat.set(Math.max(0.2, (m[face.u] * MM) / 0.25), Math.max(0.2, (m[face.v] * MM) / 0.25))
      t.needsUpdate = true
      return t
    })
  const [a, b] = (['x', 'y', 'z'] as Axis[]).filter((e) => e !== p.normal)
  const length = m[a] >= m[b] ? a : b
  const grainAlong = p.grain === 'width' ? (length === a ? b : a) : length
  return FACES.map((face) => {
    const isFace = face.normal === p.normal
    const kind: TextureKind = isFace ? (grainAlong === face.u ? 'grain-u' : 'grain-v') : p.normal === face.u ? 'plies-u' : 'plies-v'
    const t = texture(kind, tone).clone()
    if (isFace) t.repeat.set((m[face.u] * MM) / GRAIN_SIZE, (m[face.v] * MM) / GRAIN_SIZE)
    else t.repeat.set(p.normal === face.u ? 1 : (m[face.u] * MM) / GRAIN_SIZE, p.normal === face.v ? 1 : (m[face.v] * MM) / GRAIN_SIZE)
    t.offset.set((box.x0 + box.z0) * 0.00037, (box.y0 + box.x0) * 0.00053)
    t.needsUpdate = true
    return t
  })
}

export interface PieceMeshProps {
  piece: Piece
  box: Box
  tone: Tone
  offset: [number, number, number]
  selected: boolean
  dimmed: boolean
  ghost: boolean
  marked: boolean
  /** A piece with an unresolved validation problem: red edges. */
  problem: boolean
  highlight: number
  /** A piece just added: it falls into place. */
  isNew: boolean
  /** No animations: the person asked for reduced motion. */
  reduced: boolean
  /** Delay of the reveal from sketch to wood; the parent remounts the piece to repeat it. */
  delay: number
  onSelect: (id: string) => void
}

export function PieceMesh({ piece, box, tone, offset, selected, dimmed, ghost, marked, problem, highlight, isNew, reduced, delay, onSelect }: PieceMeshProps) {
  const [over, setOver] = useState(false)
  const size: [number, number, number] = [(box.x1 - box.x0) * MM, (box.y1 - box.y0) * MM, (box.z1 - box.z0) * MM]
  const center: [number, number, number] = [((box.x0 + box.x1) / 2) * MM, ((box.y0 + box.y1) / 2) * MM, ((box.z0 + box.z1) / 2) * MM]
  const maps = useMemo(() => faceTextures(piece, box, tone), [piece, box, tone])

  const sketch = piece.confidence === 'low'
  const finalOpacity = dimmed ? 0.12 : ghost ? 0.55 : sketch ? 0.92 : 1
  const target: [number, number, number] = [center[0] + offset[0], center[1] + offset[1], center[2] + offset[2]]
  const { position, scale } = useSpring({
    from: isNew ? { position: [target[0], target[1] + FALL, target[2]], scale: size.map((t) => t * 0.92) } : { position: target, scale: size },
    to: { position: target, scale: size },
    config: isNew ? { mass: 1.2, tension: 260, friction: 13 } : { mass: 1, tension: 170, friction: 16 },
    immediate: reduced,
  })
  const { opacity } = useSpring({ from: { opacity: reduced ? finalOpacity : 0 }, to: { opacity: finalOpacity }, delay: reduced ? 0 : delay, immediate: reduced, config: { tension: 120, friction: 20 } })
  const [{ glow }] = useSpring(() => ({ from: { glow: highlight ? 1 : 0 }, to: { glow: 0 }, config: { duration: 1800 }, reset: true }), [highlight])

  const materials = useRef<(MeshStandardMaterial | null)[]>([])
  useEffect(() => () => maps.forEach((m) => m.dispose()), [maps])
  useFrame(({ invalidate }) => {
    if (opacity.isAnimating || glow.isAnimating) invalidate()
    const o = opacity.get()
    const e = glow.get() * 0.55 + (over && !selected ? 0.08 : 0)
    for (const m of materials.current) {
      if (!m) continue
      const transparent = o < 0.995
      if (m.transparent !== transparent) {
        m.transparent = transparent
        m.needsUpdate = true
      }
      m.opacity = o
      m.emissiveIntensity = e
    }
  })

  const onTap = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onSelect(piece.id)
  }

  return (
    <animated.mesh
      position={position as never}
      scale={scale as never}
      castShadow={!dimmed}
      receiveShadow
      onClick={onTap}
      onPointerOver={(e) => (e.stopPropagation(), setOver(true), (document.body.style.cursor = 'pointer'))}
      onPointerOut={() => (setOver(false), (document.body.style.cursor = ''))}
    >
      <boxGeometry />
      {maps.map((map, i) => (
        <meshStandardMaterial
          key={i}
          ref={(m) => void (materials.current[i] = m)}
          attach={`material-${i}`}
          map={map}
          roughness={0.78}
          metalness={0}
          transparent
          opacity={0}
          depthWrite={finalOpacity > 0.5}
          color={ghost ? '#f2b56b' : '#ffffff'}
          emissive="#d98a2b"
        />
      ))}
      <Edges
        threshold={15}
        color={problem ? '#b4452f' : selected || ghost || marked ? '#d98a2b' : '#2b2825'}
        lineWidth={selected ? 2.5 : problem ? 2.2 : marked || sketch ? 1.8 : 1}
        transparent
        opacity={dimmed ? 0.15 : selected || marked || problem || sketch ? 1 : 0.45}
      />
    </animated.mesh>
  )
}
