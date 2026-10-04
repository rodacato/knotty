import { animated, useSpring } from '@react-spring/three'
import { useMemo, type ReactNode } from 'react'
import type { Design } from '../../domain/design/schema'
import { hardwareParts, type HardwarePart } from '../../domain/design/hardware'
import type { Catalog } from '../../domain/materials/catalog'
import type { Geometry } from '../../domain/design/resolve'
import type { Swing } from './open'

// Runners and hinges drawn in metal, so a drawer shows what it slides on and a door what it swings on.
// Taken apart, each piece also carries its dowels, screws and shelf pins, and shows the holes the others go into.

const MM = 0.001
const NO_OFFSET: [number, number, number] = [0, 0, 0]
const METAL = { color: '#a19e98', metalness: 0.75, roughness: 0.35 }
/** A plug of a darker wood than the board, sitting a hair proud of the face so it does not flicker against it. */
const PLUG = { color: '#5e4130', metalness: 0, roughness: 0.85 }
const PLUG_HEIGHT = 2
const DOWEL = { color: '#d9b98a', metalness: 0, roughness: 0.8 }
const HOLE = { color: '#2a211b', metalness: 0, roughness: 1 }
const SCREW_HEAD = { diameter: 8, height: 2 }
/** What holds two pieces together sits inside the wood: it only shows with the furniture taken apart. */
const INSIDE = new Set<HardwarePart['kind']>(['dowel', 'screw', 'shelf-pin', 'hole'])
const LOOK = { plug: PLUG, hole: HOLE, dowel: DOWEL, runner: METAL, hinge: METAL, screw: METAL, 'shelf-pin': METAL }
const AXIS = { x: 0, y: 1, z: 2 }
const PLUG_PROUD = 0.8
const TURN = { x: [0, 0, Math.PI / 2], y: [0, 0, 0], z: [Math.PI / 2, 0, 0] } as const
/** The hinge arm, from the cup toward the side it is screwed to. */
const ARM = { length: 45, width: 16, thickness: 10 }

/** Moves with its piece: same spring as the piece, so the two never come apart. */
function Follows({ offset, swing, reduced, children }: { offset: [number, number, number]; swing?: Swing; reduced: boolean; children: ReactNode }) {
  const { position } = useSpring({ position: offset, config: { mass: 1, tension: 170, friction: 16 }, immediate: reduced })
  const { turn } = useSpring({ turn: swing?.angle ?? 0, config: { mass: 1, tension: 120, friction: 18 }, immediate: reduced })
  const [x, z] = swing ? [swing.pivot[0] * MM, swing.pivot[1] * MM] : [0, 0]
  return (
    <animated.group position={position as never}>
      <group position={[x, 0, z]}>
        <animated.group rotation-y={turn as never}>
          <group position={[-x, 0, -z]}>{children}</group>
        </animated.group>
      </group>
    </animated.group>
  )
}

/** A disc on a face, a hair proud of it: a plug, a hole or the head of a screw. */
function Disc({ center, axis, outward, diameter, children }: { center: [number, number, number]; axis: 'x' | 'y' | 'z'; outward: 1 | -1; diameter: number; children: ReactNode }) {
  const at = [...center]
  at[AXIS[axis]] += outward * (PLUG_PROUD - PLUG_HEIGHT / 2)
  return (
    <mesh position={[at[0] * MM, at[1] * MM, at[2] * MM]} rotation={TURN[axis] as unknown as [number, number, number]}>
      <cylinderGeometry args={[(diameter / 2) * MM, (diameter / 2) * MM, PLUG_HEIGHT * MM, 20]} />
      {children}
    </mesh>
  )
}

function Part({ part, geo, faded }: { part: HardwarePart; geo: Geometry; faded: boolean }) {
  const material = <meshStandardMaterial {...LOOK[part.kind]} transparent={faded} opacity={faded ? 0.15 : 1} />
  if (part.kind === 'plug' || part.kind === 'hole') return <Disc {...part}>{material}</Disc>
  if (part.kind === 'dowel' || part.kind === 'shelf-pin' || part.kind === 'screw') {
    const [x, y, z] = part.center
    const head = [...part.center] as [number, number, number]
    if (part.kind === 'screw') head[AXIS[part.axis]] += (part.outward * part.length) / 2
    return (
      <>
        <mesh castShadow position={[x * MM, y * MM, z * MM]} rotation={TURN[part.axis] as unknown as [number, number, number]}>
          <cylinderGeometry args={[(part.diameter / 2) * MM, (part.diameter / 2) * MM, part.length * MM, 12]} />
          {material}
        </mesh>
        {part.kind === 'screw' && (
          <Disc center={head} axis={part.axis} outward={part.outward} diameter={SCREW_HEAD.diameter}>
            {material}
          </Disc>
        )}
      </>
    )
  }
  if (part.kind === 'runner') {
    const b = part.box
    return (
      <mesh castShadow position={[((b.x0 + b.x1) / 2) * MM, ((b.y0 + b.y1) / 2) * MM, ((b.z0 + b.z1) / 2) * MM]}>
        <boxGeometry args={[(b.x1 - b.x0) * MM, (b.y1 - b.y0) * MM, (b.z1 - b.z0) * MM]} />
        {material}
      </mesh>
    )
  }
  const door = geo.boxes.get(part.owner)
  const towardsLeft = door ? part.center[0] - door.x0 < door.x1 - part.center[0] : true
  const [x, y, z] = part.center
  return (
    <group position={[x * MM, y * MM, z * MM]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -1.5 * MM]}>
        <cylinderGeometry args={[(part.diameter / 2) * MM, (part.diameter / 2) * MM, 3 * MM, 24]} />
        {material}
      </mesh>
      <mesh position={[((towardsLeft ? -1 : 1) * ARM.length * MM) / 2, 0, (-ARM.thickness / 2 - 3) * MM]}>
        <boxGeometry args={[ARM.length * MM, ARM.width * MM, ARM.thickness * MM]} />
        {material}
      </mesh>
    </group>
  )
}

export function Hardware({ design, geo, catalog, offsets, swings, selected, hidden, apart, reduced }: { design: Design; geo: Geometry; catalog: Catalog; offsets: Map<string, [number, number, number]>; swings: Map<string, Swing>; selected: string | null; hidden: string[]; apart: boolean; reduced: boolean }) {
  const byOwner = useMemo(() => {
    const by = new Map<string, HardwarePart[]>()
    for (const part of hardwareParts(design, geo.boxes, catalog)) {
      if (hidden.includes(part.owner) || (!apart && INSIDE.has(part.kind))) continue
      by.set(part.owner, [...(by.get(part.owner) ?? []), part])
    }
    return by
  }, [design, geo, catalog, hidden, apart])
  return (
    <group>
      {[...byOwner].map(([owner, parts]) => (
        <Follows key={owner} offset={offsets.get(owner) ?? NO_OFFSET} swing={swings.get(owner)} reduced={reduced}>
          {parts.map((part, i) => (
            // With a piece selected, only its own hardware stays solid, like the pieces.
            <Part key={i} part={part} geo={geo} faded={!!selected && selected !== owner} />
          ))}
        </Follows>
      ))}
    </group>
  )
}
