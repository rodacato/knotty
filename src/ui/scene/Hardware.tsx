import { animated, useSpring } from '@react-spring/three'
import { useMemo, type ReactNode } from 'react'
import type { Design } from '../../domain/design/schema'
import { hardwareParts } from '../../domain/design/hardware'
import type { Geometry } from '../../domain/design/resolve'
import type { Swing } from './open'

// Runners and hinges drawn in metal, so a drawer shows what it slides on and a door what it swings on.

const MM = 0.001
const NO_OFFSET: [number, number, number] = [0, 0, 0]
const METAL = { color: '#a19e98', metalness: 0.75, roughness: 0.35 }
/** A plug of a darker wood than the board, sitting a hair proud of the face so it does not flicker against it. */
const PLUG = { color: '#5e4130', metalness: 0, roughness: 0.85 }
const PLUG_HEIGHT = 2
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

export function Hardware({ design, geo, offsets, swings, selected, hidden, reduced }: { design: Design; geo: Geometry; offsets: Map<string, [number, number, number]>; swings: Map<string, Swing>; selected: string | null; hidden: string[]; reduced: boolean }) {
  const parts = useMemo(() => hardwareParts(design, geo.boxes).filter((part) => !hidden.includes(part.owner)), [design, geo, hidden])
  return (
    <group>
      {parts.map((part, i) => {
        const offset = offsets.get(part.owner) ?? NO_OFFSET
        // With a piece selected, only its own hardware stays solid, like the pieces.
        const faded = !!selected && selected !== part.owner
        const material = <meshStandardMaterial {...(part.kind === 'plug' ? PLUG : METAL)} transparent={faded} opacity={faded ? 0.15 : 1} />
        if (part.kind === 'plug') {
          const at = [...part.center]
          at[['x', 'y', 'z'].indexOf(part.axis)] += part.outward * (PLUG_PROUD - PLUG_HEIGHT / 2)
          return (
            <Follows key={i} offset={offset} swing={swings.get(part.owner)} reduced={reduced}>
              <mesh position={[at[0] * MM, at[1] * MM, at[2] * MM]} rotation={TURN[part.axis] as unknown as [number, number, number]}>
                <cylinderGeometry args={[(part.diameter / 2) * MM, (part.diameter / 2) * MM, PLUG_HEIGHT * MM, 20]} />
                {material}
              </mesh>
            </Follows>
          )
        }
        if (part.kind === 'runner') {
          const b = part.box
          return (
            <Follows key={i} offset={offset} swing={swings.get(part.owner)} reduced={reduced}>
              <mesh castShadow position={[((b.x0 + b.x1) / 2) * MM, ((b.y0 + b.y1) / 2) * MM, ((b.z0 + b.z1) / 2) * MM]}>
                <boxGeometry args={[(b.x1 - b.x0) * MM, (b.y1 - b.y0) * MM, (b.z1 - b.z0) * MM]} />
                {material}
              </mesh>
            </Follows>
          )
        }
        const door = geo.boxes.get(part.owner)
        const towardsLeft = door ? part.center[0] - door.x0 < door.x1 - part.center[0] : true
        const [x, y, z] = part.center
        return (
          <Follows key={i} offset={offset} swing={swings.get(part.owner)} reduced={reduced}>
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
          </Follows>
        )
      })}
    </group>
  )
}
