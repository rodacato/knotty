import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { BufferAttribute, BufferGeometry, type PointsMaterial } from 'three'

const PARTICLES = 36
const DURATION = 1.1
const GRAVITY = -2.4

/** A "poof" of sawdust where a new piece lands. */
export function Sawdust({ en, delay = 0.28 }: { en: [number, number, number]; delay?: number }) {
  const material = useRef<PointsMaterial>(null)
  const inicio = useRef<number | null>(null)
  const { geometry, speeds } = useMemo(() => {
    const positions = new Float32Array(PARTICLES * 3)
    const speeds = new Float32Array(PARTICLES * 3)
    for (let i = 0; i < PARTICLES; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 0.25 + Math.random() * 0.45
      speeds.set([Math.cos(angle) * speed, 0.6 + Math.random() * 0.8, Math.sin(angle) * speed], i * 3)
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(positions, 3))
    return { geometry, speeds }
  }, [])

  useFrame(({ clock, invalidate }) => {
    inicio.current ??= clock.elapsedTime + delay
    const t = clock.elapsedTime - inicio.current
    if (!material.current) return
    if (t <= DURATION) invalidate()
    if (t < 0 || t > DURATION) {
      material.current.opacity = 0
      return
    }
    const pos = geometry.getAttribute('position') as BufferAttribute
    for (let i = 0; i < PARTICLES; i++) {
      const [vx, vy, vz] = [speeds[i * 3], speeds[i * 3 + 1], speeds[i * 3 + 2]]
      pos.setXYZ(i, en[0] + vx * t, Math.max(0, en[1] + vy * t + 0.5 * GRAVITY * t * t), en[2] + vz * t)
    }
    pos.needsUpdate = true
    material.current.opacity = 0.85 * (1 - t / DURATION)
  })

  return (
    <points geometry={geometry}>
      <pointsMaterial ref={material} size={0.012} color="#e2c9a2" transparent opacity={0} depthWrite={false} />
    </points>
  )
}
