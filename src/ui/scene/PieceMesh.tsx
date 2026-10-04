import { animated, to, useSpring } from '@react-spring/three'
import { Edges } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { MeshStandardMaterial, Texture } from 'three'
import type { Axis, Piece } from '../../domain/design/schema'
import type { Box } from '../../domain/design/resolve'
import type { BoardTone } from '../../domain/materials/grades'
import { cutBox } from '../../domain/design/cuts'
import { cutGeometry } from './cutGeometry'
import { FINISH_LOOK, NATURAL_PINE, type FinishId } from '../../domain/materials/finishes'
import { profiledGeometry, type EdgeShape } from './edgeGeometry'
import { texture, type TextureKind } from './textures'
import type { Swing } from './open'

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

function faceTextures(p: Piece, box: Box, tone: BoardTone, plies: number): Texture[] {
  const m = { x: box.x1 - box.x0, y: box.y1 - box.y0, z: box.z1 - box.z0 }
  if (p.confidence === 'low')
    return FACES.map((face) => {
      const t = texture('sketch', tone, plies).clone()
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
    const t = texture(kind, tone, plies).clone()
    if (isFace) t.repeat.set((m[face.u] * MM) / GRAIN_SIZE, (m[face.v] * MM) / GRAIN_SIZE)
    else t.repeat.set(p.normal === face.u ? 1 : (m[face.u] * MM) / GRAIN_SIZE, p.normal === face.v ? 1 : (m[face.v] * MM) / GRAIN_SIZE)
    t.offset.set((box.x0 + box.z0) * 0.00037, (box.y0 + box.x0) * 0.00053)
    t.needsUpdate = true
    return t
  })
}

interface PieceMeshProps {
  piece: Piece
  box: Box
  tone: BoardTone
  plies: number
  offset: [number, number, number]
  /** A door open on its hinge: the piece turns about this edge, in mm. */
  swing: Swing | null
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
  /** The profiles on the edges that show: the piece is cut to them instead of drawn as a box. */
  shapes: EdgeShape[]
  /** The finish the design has, drawn as its colour and sheen. */
  finish: FinishId
  onSelect: (id: string) => void
}

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
/** A colour that multiplies the natural wood to the finish's: it can darken and warm, not lighten (paint replaces the grain instead). */
const tintFor = (finish: FinishId) => {
  const [target, natural] = [channels(FINISH_LOOK[finish].color), channels(NATURAL_PINE)]
  const mix = target.map((c, i) => Math.min(1, c / natural[i]))
  return `#${mix.map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join('')}`
}

export function PieceMesh({ piece, box, tone, plies, offset, swing, selected, dimmed, ghost, marked, problem, highlight, isNew, reduced, delay, shapes, finish, onSelect }: PieceMeshProps) {
  const [over, setOver] = useState(false)
  const size: [number, number, number] = [(box.x1 - box.x0) * MM, (box.y1 - box.y0) * MM, (box.z1 - box.z0) * MM]
  const center: [number, number, number] = [((box.x0 + box.x1) / 2) * MM, ((box.y0 + box.y1) / 2) * MM, ((box.z0 + box.z1) / 2) * MM]
  const maps = useMemo(() => faceTextures(piece, box, tone, plies), [piece, box, tone, plies])
  // A piece with cuts is drawn from what is left of its box; the profiles of its edges are not drawn on it.
  const voided = useMemo(() => (piece.cuts?.length ? cutGeometry(box, piece.cuts.map((c) => cutBox(box, c))) : null), [piece.cuts, box])
  const cut = useMemo(() => (shapes.length ? profiledGeometry({ x: size[0], y: size[1], z: size[2] }, piece.normal, shapes) : null), [shapes, piece.normal, size[0], size[1], size[2]]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => cut?.dispose(), [cut])
  useEffect(() => () => voided?.dispose(), [voided])

  const look = FINISH_LOOK[finish]
  const tint = useMemo(() => tintFor(finish), [finish])
  const sketch = piece.confidence === 'low'
  const finalOpacity = dimmed ? 0.12 : ghost ? 0.55 : sketch ? 0.92 : 1
  const target: [number, number, number] = [center[0] + offset[0], center[1] + offset[1], center[2] + offset[2]]
  const { position, scale } = useSpring({
    from: isNew ? { position: [target[0], target[1] + FALL, target[2]], scale: size.map((t) => t * 0.92) } : { position: target, scale: size },
    to: { position: target, scale: size },
    config: isNew ? { mass: 1.2, tension: 260, friction: 13 } : { mass: 1, tension: 170, friction: 16 },
    immediate: reduced,
  })
  const { turn } = useSpring({ turn: swing?.angle ?? 0, config: { mass: 1, tension: 120, friction: 18 }, immediate: reduced })
  // Turning a piece about an edge also carries its center around it.
  const pivot = swing ? [swing.pivot[0] * MM, swing.pivot[1] * MM] : [target[0], target[2]]
  const swung = to([position, turn], (p, t) => {
    const [x, y, z] = p as unknown as [number, number, number]
    const [dx, dz] = [center[0] - pivot[0], center[2] - pivot[1]]
    const [c, s] = [Math.cos(t as number), Math.sin(t as number)]
    return [x - center[0] + pivot[0] + dx * c + dz * s, y, z - center[2] + pivot[1] - dx * s + dz * c]
  })
  const { opacity } = useSpring({ from: { opacity: reduced ? finalOpacity : 0 }, to: { opacity: finalOpacity }, delay: reduced ? 0 : delay, immediate: reduced, config: { tension: 120, friction: 20 } })
  const [{ glow }] = useSpring(() => ({ from: { glow: highlight ? 1 : 0 }, to: { glow: 0 }, config: { duration: 1800 }, reset: true, immediate: reduced }), [highlight])

  const materials = useRef<(MeshStandardMaterial | null)[]>([])
  useEffect(() => () => maps.forEach((m) => m.dispose()), [maps])
  useFrame(({ invalidate }) => {
    if (opacity.isAnimating || glow.isAnimating || turn.isAnimating) invalidate()
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
      position={swung as never}
      rotation-y={turn as never}
      scale={scale as never}
      castShadow={!dimmed}
      receiveShadow
      onClick={onTap}
      onPointerOver={(e) => (e.stopPropagation(), setOver(true), (document.body.style.cursor = 'pointer'))}
      onPointerOut={() => (setOver(false), (document.body.style.cursor = ''))}
    >
      {voided ? <primitive object={voided} attach="geometry" /> : cut ? <primitive object={cut} attach="geometry" /> : <boxGeometry />}
      {maps.map((map, i) => (
        <meshStandardMaterial
          key={`${i}-${finish}`}
          ref={(m) => void (materials.current[i] = m)}
          attach={`material-${i}`}
          map={look.grain ? map : undefined}
          roughness={look.roughness}
          metalness={0}
          transparent
          opacity={0}
          depthWrite={finalOpacity > 0.5}
          color={ghost ? '#f2b56b' : look.grain ? tint : look.color}
          emissive="#d98a2b"
        />
      ))}
      <Edges
        key={voided?.uuid ?? cut?.uuid ?? "box"}
        threshold={cut ? 30 : 15}
        color={problem ? '#b4452f' : selected || ghost || marked ? '#d98a2b' : '#2b2825'}
        lineWidth={selected ? 2.5 : problem ? 2.2 : marked || sketch ? 1.8 : 1}
        transparent
        opacity={dimmed ? 0.15 : selected || marked || problem || sketch ? 1 : 0.45}
      />
    </animated.mesh>
  )
}
