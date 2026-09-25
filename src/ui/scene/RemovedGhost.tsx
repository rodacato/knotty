import { animated, useSpring } from '@react-spring/three'
import type { Box } from '../../domain/design/resolve'

const MM = 0.001

/** The ghost of a removed piece: it rises a little and fades away. */
export function RemovedGhost({ box }: { box: Box }) {
  const center: [number, number, number] = [((box.x0 + box.x1) / 2) * MM, ((box.y0 + box.y1) / 2) * MM, ((box.z0 + box.z1) / 2) * MM]
  const size: [number, number, number] = [(box.x1 - box.x0) * MM, (box.y1 - box.y0) * MM, (box.z1 - box.z0) * MM]
  const { opacity, y } = useSpring({ from: { opacity: 0.5, y: center[1] }, to: { opacity: 0, y: center[1] + 0.08 }, config: { duration: 900 } })
  return (
    <animated.mesh position-x={center[0]} position-y={y} position-z={center[2]} scale={size} raycast={() => null}>
      <boxGeometry />
      <animated.meshBasicMaterial color="#b4452f" transparent opacity={opacity} depthWrite={false} />
    </animated.mesh>
  )
}
