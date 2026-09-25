import { Line } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { Vector3, type Group } from 'three'
import type { Dimensiones } from '../../domain/diseno/esquema'
import { Label } from './Label'

// Overall dimensions as on a drawing: width at the front, height on the left, depth on the right, tied to the piece by reference lines.

const MM = 0.001
const OFFSET = 70 * MM
/** Reference lines stop a little short of the piece and run a little past the dimension line. */
const GAP = 6 * MM
const OVERSHOOT = 14 * MM
const TICK = 18 * MM
const COLOR = '#8a7a66'
/** Past this, the camera looks along the dimension and it reads as a dot with a label on top: hidden. */
const EDGE_ON = 0.9

type Point = [number, number, number]
const add = (a: Point, b: Point, k = 1): Point => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]

function Dimension({ from, to, out, value, dark }: { from: Point; to: Point; out: Point; value: number; dark: boolean }) {
  const group = useRef<Group>(null)
  const axis = useRef(new Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]).normalize())
  const view = useRef(new Vector3())
  useFrame(({ camera }) => {
    if (!group.current) return
    camera.getWorldDirection(view.current)
    group.current.visible = Math.abs(view.current.dot(axis.current)) < EDGE_ON
  })
  const [a, b] = [add(from, out, OFFSET), add(to, out, OFFSET)]
  const middle: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]
  const text = `${Math.round(value)} mm · ${(value / 10).toLocaleString('es-MX', { maximumFractionDigits: 1 })} cm`
  return (
    <group ref={group}>
      <Line points={[add(from, out, GAP), add(from, out, OFFSET + OVERSHOOT)]} color={COLOR} lineWidth={0.75} dashed dashSize={0.012} gapSize={0.008} transparent opacity={0.7} />
      <Line points={[add(to, out, GAP), add(to, out, OFFSET + OVERSHOOT)]} color={COLOR} lineWidth={0.75} dashed dashSize={0.012} gapSize={0.008} transparent opacity={0.7} />
      <Line points={[a, b]} color={COLOR} lineWidth={1.25} />
      <Line points={[add(a, out, -TICK / 2), add(a, out, TICK / 2)]} color={COLOR} lineWidth={2} />
      <Line points={[add(b, out, -TICK / 2), add(b, out, TICK / 2)]} color={COLOR} lineWidth={2} />
      <Label text={text} position={middle} dark={dark} />
    </group>
  )
}

export function DimensionLines({ dimensions, dark }: { dimensions: Dimensiones; dark: boolean }) {
  const w = dimensions.ancho * MM
  const h = dimensions.alto * MM
  const d = dimensions.fondo * MM
  const y = 2 * MM
  return (
    <group>
      <Dimension from={[0, y, d]} to={[w, y, d]} out={[0, 0, 1]} value={dimensions.ancho} dark={dark} />
      <Dimension from={[0, 0, d]} to={[0, h, d]} out={[-1, 0, 0]} value={dimensions.alto} dark={dark} />
      <Dimension from={[w, y, 0]} to={[w, y, d]} out={[1, 0, 0]} value={dimensions.fondo} dark={dark} />
    </group>
  )
}
