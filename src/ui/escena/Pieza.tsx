import { animated, useSpring } from '@react-spring/three'
import { Edges } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { MeshStandardMaterial, Texture } from 'three'
import type { Eje, Pieza as TPieza } from '../../domain/diseno/esquema'
import type { Caja } from '../../domain/diseno/resolver'
import { textura, type TipoTextura, type Tono } from './texturas'

const MM = 0.001
/** Ejes (u, v) de cada cara de BoxGeometry, en el orden de sus materiales: +x, −x, +y, −y, +z, −z. */
const CARAS: { normal: Eje; u: Eje; v: Eje }[] = [
  { normal: 'x', u: 'z', v: 'y' },
  { normal: 'x', u: 'z', v: 'y' },
  { normal: 'y', u: 'x', v: 'z' },
  { normal: 'y', u: 'x', v: 'z' },
  { normal: 'z', u: 'x', v: 'y' },
  { normal: 'z', u: 'x', v: 'y' },
]
const TAMANO_VETA = 0.45
const CAIDA = 0.35

function texturasDeCaras(p: TPieza, caja: Caja, tono: Tono): Texture[] {
  const m = { x: caja.x1 - caja.x0, y: caja.y1 - caja.y0, z: caja.z1 - caja.z0 }
  if (p.confianza === 'baja')
    return CARAS.map((cara) => {
      const t = textura('boceto', tono).clone()
      t.repeat.set(Math.max(0.2, (m[cara.u] * MM) / 0.25), Math.max(0.2, (m[cara.v] * MM) / 0.25))
      t.needsUpdate = true
      return t
    })
  const [a, b] = (['x', 'y', 'z'] as Eje[]).filter((e) => e !== p.normal)
  const largo = m[a] >= m[b] ? a : b
  const vetaEn = p.veta === 'ancho' ? (largo === a ? b : a) : largo
  return CARAS.map((cara) => {
    const esCara = cara.normal === p.normal
    const tipo: TipoTextura = esCara ? (vetaEn === cara.u ? 'veta-u' : 'veta-v') : p.normal === cara.u ? 'capas-u' : 'capas-v'
    const t = textura(tipo, tono).clone()
    if (esCara) t.repeat.set((m[cara.u] * MM) / TAMANO_VETA, (m[cara.v] * MM) / TAMANO_VETA)
    else t.repeat.set(p.normal === cara.u ? 1 : (m[cara.u] * MM) / TAMANO_VETA, p.normal === cara.v ? 1 : (m[cara.v] * MM) / TAMANO_VETA)
    t.offset.set((caja.x0 + caja.z0) * 0.00037, (caja.y0 + caja.x0) * 0.00053)
    t.needsUpdate = true
    return t
  })
}

export interface PropsPieza {
  pieza: TPieza
  caja: Caja
  tono: Tono
  desplazamiento: [number, number, number]
  seleccionada: boolean
  atenuada: boolean
  fantasma: boolean
  marcada: boolean
  resaltar: number
  /** Pieza recién agregada: cae a su lugar. */
  nueva: boolean
  /** Retraso de la aparición del boceto a la madera; el padre remonta la pieza para repetirla. */
  retraso: number
  onSeleccionar: (id: string) => void
}

export function Pieza({ pieza, caja, tono, desplazamiento, seleccionada, atenuada, fantasma, marcada, resaltar, nueva, retraso, onSeleccionar }: PropsPieza) {
  const [sobre, setSobre] = useState(false)
  const tamano: [number, number, number] = [(caja.x1 - caja.x0) * MM, (caja.y1 - caja.y0) * MM, (caja.z1 - caja.z0) * MM]
  const centro: [number, number, number] = [((caja.x0 + caja.x1) / 2) * MM, ((caja.y0 + caja.y1) / 2) * MM, ((caja.z0 + caja.z1) / 2) * MM]
  const mapas = useMemo(() => texturasDeCaras(pieza, caja, tono), [pieza, caja, tono])

  const boceto = pieza.confianza === 'baja'
  const opacidadFinal = atenuada ? 0.12 : fantasma ? 0.55 : boceto ? 0.92 : 1
  const destino: [number, number, number] = [centro[0] + desplazamiento[0], centro[1] + desplazamiento[1], centro[2] + desplazamiento[2]]
  const { posicion, escala } = useSpring({
    from: nueva ? { posicion: [destino[0], destino[1] + CAIDA, destino[2]], escala: tamano.map((t) => t * 0.92) } : { posicion: destino, escala: tamano },
    to: { posicion: destino, escala: tamano },
    config: nueva ? { mass: 1.2, tension: 260, friction: 13 } : { mass: 1, tension: 170, friction: 16 },
  })
  const { opacidad } = useSpring({ from: { opacidad: 0 }, to: { opacidad: opacidadFinal }, delay: retraso, config: { tension: 120, friction: 20 } })
  const [{ brillo }] = useSpring(() => ({ from: { brillo: resaltar ? 1 : 0 }, to: { brillo: 0 }, config: { duration: 1800 }, reset: true }), [resaltar])

  const materiales = useRef<(MeshStandardMaterial | null)[]>([])
  useEffect(() => () => mapas.forEach((m) => m.dispose()), [mapas])
  useFrame(() => {
    const o = opacidad.get()
    const e = brillo.get() * 0.55 + (sobre && !seleccionada ? 0.08 : 0)
    for (const m of materiales.current) {
      if (!m) continue
      const transparente = o < 0.995
      if (m.transparent !== transparente) {
        m.transparent = transparente
        m.needsUpdate = true
      }
      m.opacity = o
      m.emissiveIntensity = e
    }
  })

  const alTocar = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onSeleccionar(pieza.id)
  }

  return (
    <animated.mesh
      position={posicion as never}
      scale={escala as never}
      castShadow={!atenuada}
      receiveShadow
      onClick={alTocar}
      onPointerOver={(e) => (e.stopPropagation(), setSobre(true), (document.body.style.cursor = 'pointer'))}
      onPointerOut={() => (setSobre(false), (document.body.style.cursor = ''))}
    >
      <boxGeometry />
      {mapas.map((mapa, i) => (
        <meshStandardMaterial
          key={i}
          ref={(m) => void (materiales.current[i] = m)}
          attach={`material-${i}`}
          map={mapa}
          roughness={0.78}
          metalness={0}
          transparent
          opacity={0}
          depthWrite={opacidadFinal > 0.5}
          color={fantasma ? '#f2b56b' : '#ffffff'}
          emissive="#d98a2b"
        />
      ))}
      <Edges
        threshold={15}
        color={seleccionada || fantasma || marcada ? '#d98a2b' : '#2b2825'}
        lineWidth={seleccionada ? 2.5 : marcada || boceto ? 1.8 : 1}
        transparent
        opacity={atenuada ? 0.15 : seleccionada || marcada || boceto ? 1 : 0.45}
      />
    </animated.mesh>
  )
}
