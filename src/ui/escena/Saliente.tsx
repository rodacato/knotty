import { animated, useSpring } from '@react-spring/three'
import type { Caja } from '../../domain/diseno/resolver'

const MM = 0.001

/** El fantasma de una pieza eliminada: se eleva un poco y se desvanece. */
export function Saliente({ caja }: { caja: Caja }) {
  const centro: [number, number, number] = [((caja.x0 + caja.x1) / 2) * MM, ((caja.y0 + caja.y1) / 2) * MM, ((caja.z0 + caja.z1) / 2) * MM]
  const tamano: [number, number, number] = [(caja.x1 - caja.x0) * MM, (caja.y1 - caja.y0) * MM, (caja.z1 - caja.z0) * MM]
  const { opacidad, y } = useSpring({ from: { opacidad: 0.5, y: centro[1] }, to: { opacidad: 0, y: centro[1] + 0.08 }, config: { duration: 900 } })
  return (
    <animated.mesh position-x={centro[0]} position-y={y} position-z={centro[2]} scale={tamano} raycast={() => null}>
      <boxGeometry />
      <animated.meshBasicMaterial color="#b4452f" transparent opacity={opacidad} depthWrite={false} />
    </animated.mesh>
  )
}
