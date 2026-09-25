import { useMemo } from 'react'
import type { Design } from '../../domain/design/schema'
import { hardwareParts } from '../../domain/design/hardware'
import type { Geometry } from '../../domain/design/resolve'

// Runners and hinges drawn in metal, so a drawer shows what it slides on and a door what it swings on.

const MM = 0.001
const METAL = { color: '#a19e98', metalness: 0.75, roughness: 0.35 }
/** The hinge arm, from the cup toward the side it is screwed to. */
const ARM = { length: 45, width: 16, thickness: 10 }

export function Hardware({ design, geo, offsets, selected }: { design: Design; geo: Geometry; offsets: Map<string, [number, number, number]>; selected: string | null }) {
  const parts = useMemo(() => hardwareParts(design, geo.boxes), [design, geo])
  return (
    <group>
      {parts.map((part, i) => {
        const [dx, dy, dz] = offsets.get(part.owner) ?? [0, 0, 0]
        // With a piece selected, only its own hardware stays solid, like the pieces.
        const faded = !!selected && selected !== part.owner
        const material = <meshStandardMaterial {...METAL} transparent={faded} opacity={faded ? 0.15 : 1} />
        if (part.kind === 'runner') {
          const b = part.box
          return (
            <mesh key={i} castShadow position={[((b.x0 + b.x1) / 2) * MM + dx, ((b.y0 + b.y1) / 2) * MM + dy, ((b.z0 + b.z1) / 2) * MM + dz]}>
              <boxGeometry args={[(b.x1 - b.x0) * MM, (b.y1 - b.y0) * MM, (b.z1 - b.z0) * MM]} />
              {material}
            </mesh>
          )
        }
        const door = geo.boxes.get(part.owner)
        const towardsLeft = door ? part.center[0] - door.x0 < door.x1 - part.center[0] : true
        const [x, y, z] = part.center
        return (
          <group key={i} position={[x * MM + dx, y * MM + dy, z * MM + dz]}>
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
      })}
    </group>
  )
}
