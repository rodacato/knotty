import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { BufferAttribute, BufferGeometry, type PointsMaterial } from 'three'

const PARTICULAS = 36
const DURACION = 1.1
const GRAVEDAD = -2.4

/** Un "puf" de aserrín donde cae una pieza nueva. */
export function Aserrin({ en, retraso = 0.28 }: { en: [number, number, number]; retraso?: number }) {
  const material = useRef<PointsMaterial>(null)
  const inicio = useRef<number | null>(null)
  const { geometria, velocidades } = useMemo(() => {
    const posiciones = new Float32Array(PARTICULAS * 3)
    const velocidades = new Float32Array(PARTICULAS * 3)
    for (let i = 0; i < PARTICULAS; i++) {
      const angulo = Math.random() * Math.PI * 2
      const rapidez = 0.25 + Math.random() * 0.45
      velocidades.set([Math.cos(angulo) * rapidez, 0.6 + Math.random() * 0.8, Math.sin(angulo) * rapidez], i * 3)
    }
    const geometria = new BufferGeometry()
    geometria.setAttribute('position', new BufferAttribute(posiciones, 3))
    return { geometria, velocidades }
  }, [])

  useFrame(({ clock }) => {
    inicio.current ??= clock.elapsedTime + retraso
    const t = clock.elapsedTime - inicio.current
    if (!material.current) return
    if (t < 0 || t > DURACION) {
      material.current.opacity = 0
      return
    }
    const pos = geometria.getAttribute('position') as BufferAttribute
    for (let i = 0; i < PARTICULAS; i++) {
      const [vx, vy, vz] = [velocidades[i * 3], velocidades[i * 3 + 1], velocidades[i * 3 + 2]]
      pos.setXYZ(i, en[0] + vx * t, Math.max(0, en[1] + vy * t + 0.5 * GRAVEDAD * t * t), en[2] + vz * t)
    }
    pos.needsUpdate = true
    material.current.opacity = 0.85 * (1 - t / DURACION)
  })

  return (
    <points geometry={geometria}>
      <pointsMaterial ref={material} size={0.012} color="#e2c9a2" transparent opacity={0} depthWrite={false} />
    </points>
  )
}
