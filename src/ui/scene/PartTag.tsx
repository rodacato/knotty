import { Line } from '@react-three/drei'
import type { Box } from '../../domain/design/resolve'
import { Label } from './Label'

// The part being edited, named on the drawing (UI-93): a leader line from the front of its pieces to an ink tag, as the north star points at the legs.

type Point = [number, number, number]
const MM = 0.001
const INK = '#161412'

/** Where the leader starts and where its tag sits, from the boxes of the part's pieces (mm) and how far each is pushed (m); null without pieces. */
export function tagPlacement(boxes: { box: Box; push: Point }[]): { anchor: Point; tag: Point } | null {
  if (!boxes.length) return null
  const placed = boxes.map(({ box, push }) => ({ lo: [box.x0 * MM + push[0], box.y0 * MM + push[1], box.z0 * MM + push[2]], hi: [box.x1 * MM + push[0], box.y1 * MM + push[1], box.z1 * MM + push[2]] }))
  // The front-left piece: the line lands on something the eye sees, and the tag goes off the left side, clear of the width's dimension along the front.
  const front = Math.max(...placed.map((p) => p.hi[2]))
  const near = placed.filter((p) => p.hi[2] >= front - 0.03)
  const piece = near.reduce((a, b) => (b.lo[0] < a.lo[0] ? b : a))
  const anchor: Point = [(piece.lo[0] + piece.hi[0]) / 2, piece.lo[1] + (piece.hi[1] - piece.lo[1]) / 2, piece.hi[2]]
  const tag: Point = [anchor[0] - 0.42, anchor[1] - 0.02, anchor[2] + 0.34]
  return { anchor, tag }
}

export function PartTag({ name, boxes }: { name: string; boxes: { box: Box; push: Point }[] }) {
  const placed = tagPlacement(boxes)
  if (!placed) return null
  return (
    <group>
      <Line points={[placed.anchor, placed.tag]} color={INK} lineWidth={4} depthTest={false} renderOrder={9} />
      <mesh position={placed.anchor} renderOrder={9}>
        <sphereGeometry args={[0.014, 12, 12]} />
        <meshBasicMaterial color={INK} depthTest={false} />
      </mesh>
      <Label text={name} position={placed.tag} height={0.032} tag />
    </group>
  )
}
