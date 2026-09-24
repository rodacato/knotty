import { CameraControls, ContactShadows, Environment, Grid, Lightformer, PerformanceMonitor } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { EffectComposer, N8AO } from '@react-three/postprocessing'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Diseno } from '../../domain/diseno/esquema'
import type { Geometria } from '../../domain/diseno/resolver'
import type { Catalogo } from '../../domain/materiales/catalogo'
import { useTienda, type Vista } from '../tienda'
import { Cotas } from './Cotas'
import { Aserrin } from './Aserrin'
import { Pieza } from './Pieza'
import { Saliente } from './Saliente'

const MM = 0.001

interface PropsEscena {
  diseno: Diseno
  geo: Geometria
  catalogo: Catalogo
  /** Piezas nuevas de una propuesta: fantasma ámbar. */
  fantasmas: string[]
  /** Piezas que una propuesta cambia: aristas ámbar. */
  marcadas: string[]
}

/** Cuánto se separa cada pieza en la vista de armado: hacia afuera del centro, sobre todo en la dirección de su espesor, sin bajar del piso. */
function desplazamientos(geo: Geometria, diseno: Diseno, activo: boolean) {
  const cero = new Map(diseno.piezas.map((p) => [p.id, [0, 0, 0] as [number, number, number]]))
  if (!activo) return { empujes: cero, alto: diseno.dimensiones.alto * MM }
  const { ancho, alto, fondo } = diseno.dimensiones
  const centro = { x: ancho / 2, y: alto / 2, z: fondo / 2 }
  const escala = Math.max(ancho, fondo, alto * 0.5)
  // Los cajones salen enteros hacia el frente, como si se abrieran, en lugar de desarmarse.
  const cajones = new Map<string, number>()
  for (const p of diseno.piezas)
    if (p.grupo && p.rol === 'costado-cajon' && p.normal === 'x') {
      const c = geo.cajas.get(p.id)!
      cajones.set(p.grupo, (c.z1 - c.z0) * 0.75)
    }
  const crudos = diseno.piezas.map((p) => {
    const c = geo.cajas.get(p.id)!
    const salida = p.grupo ? cajones.get(p.grupo) : undefined
    if (salida !== undefined) return { id: p.id, c, empuje: { x: 0, y: 0, z: salida } }
    const d = { x: (c.x0 + c.x1) / 2 - centro.x, y: (c.y0 + c.y1) / 2 - centro.y, z: (c.z0 + c.z1) / 2 - centro.z }
    const n = p.normal
    const lado = Math.sign(d[n]) || (n === 'z' ? -1 : 1)
    const empuje = { x: d.x * 0.3, y: d.y * 0.18, z: d.z * 0.3 }
    empuje[n] += lado * escala * 0.22 + d[n] * (n === 'y' ? 0.25 : 0.35)
    return { id: p.id, c, empuje }
  })
  const elevar = Math.max(0, ...crudos.map(({ c, empuje }) => -(c.y0 + empuje.y))) + (crudos.some(({ c, empuje }) => c.y0 + empuje.y < 0) ? 20 : 0)
  const empujes = new Map(crudos.map(({ id, empuje }) => [id, [empuje.x * MM, (empuje.y + elevar) * MM, empuje.z * MM] as [number, number, number]]))
  const tope = Math.max(...crudos.map(({ c, empuje }) => c.y1 + empuje.y + elevar))
  return { empujes, alto: tope * MM }
}

function Camara({ diseno, altoVisible }: { diseno: Diseno; altoVisible: number }) {
  const controles = useRef<CameraControls>(null)
  const vista = useTienda((s) => s.vista)
  const explosion = useTienda((s) => s.explosion)
  const { ancho, alto, fondo } = diseno.dimensiones

  useEffect(() => {
    const c = controles.current
    if (!c) return
    const a = ancho * MM
    const h = altoVisible
    const f = fondo * MM
    const d = Math.max(a * (explosion ? 1.5 : 1), h, f * (explosion ? 1.5 : 1)) * 1.7 + 0.4
    const posiciones: Record<Vista, [number, number, number]> = {
      frente: [0, h / 2, d + f / 2],
      lado: [d + a / 2, h / 2, 0],
      'tres-cuartos': [d * 0.72, h * 0.7 + d * 0.28, d * 0.82],
      arriba: [0, d + h, 0.001],
    }
    const [x, y, z] = posiciones[vista.nombre]
    void c.setLookAt(x, y, z, 0, h / 2, 0, true)
  }, [vista, ancho, alto, fondo, explosion, altoVisible])

  return <CameraControls ref={controles} makeDefault minDistance={0.3} maxDistance={12} maxPolarAngle={Math.PI / 2 - 0.02} smoothTime={0.35} />
}

function useOscuro() {
  const consulta = '(prefers-color-scheme: dark)'
  const [oscuro, setOscuro] = useState(() => matchMedia(consulta).matches)
  useEffect(() => {
    const m = matchMedia(consulta)
    const cambio = () => setOscuro(m.matches)
    m.addEventListener('change', cambio)
    return () => m.removeEventListener('change', cambio)
  }, [])
  return oscuro
}

export function Escena({ diseno, geo, catalogo, fantasmas, marcadas }: PropsEscena) {
  const seleccion = useTienda((s) => s.seleccion)
  const explosion = useTienda((s) => s.explosion)
  const cotas = useTienda((s) => s.cotas)
  const cambios = useTienda((s) => s.cambios)
  const revelado = useTienda((s) => s.revelado)
  const seleccionar = useTienda((s) => s.seleccionar)
  const [calidad, setCalidad] = useState(true)
  const oscuro = useOscuro()

  const { empujes, alto: altoVisible } = useMemo(() => desplazamientos(geo, diseno, explosion), [geo, diseno, explosion])
  const tipoDe = (material: string) => (catalogo.materiales.find((m) => m.id === material)?.tipo === 'trasera' ? 'trasera' : 'triplay')
  const orden = useMemo(() => [...diseno.piezas].sort((a, b) => geo.cajas.get(a.id)!.y0 - geo.cajas.get(b.id)!.y0).map((p) => p.id), [diseno, geo])

  return (
    <Canvas shadows dpr={[1, calidad ? 2 : 1.25]} camera={{ fov: 35, near: 0.05, far: 60, position: [2.2, 1.8, 2.6] }} gl={{ antialias: true, alpha: true }} onPointerMissed={() => seleccionar(null)}>
      <PerformanceMonitor onDecline={() => setCalidad(false)} onIncline={() => setCalidad(true)} />
      <Camara diseno={diseno} altoVisible={altoVisible} />
      <hemisphereLight args={[oscuro ? '#6b5f52' : '#fff6e8', oscuro ? '#1a1612' : '#b89a78', oscuro ? 0.5 : 0.8]} />
      <directionalLight position={[2.5, 4.5, 3.2]} intensity={oscuro ? 1.6 : 2.1} color="#fff1dc" castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004}>
        <orthographicCamera attach="shadow-camera" args={[-2.5, 2.5, 2.5, -2.5, 0.1, 12]} />
      </directionalLight>
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2} position={[0, 4, 2]} scale={[6, 2, 1]} color="#fff4e2" />
        <Lightformer form="rect" intensity={0.8} position={[-4, 1.5, 0]} rotation-y={Math.PI / 2} scale={[4, 3, 1]} color="#ffe2c0" />
        <Lightformer form="rect" intensity={0.6} position={[4, 1.5, -1]} rotation-y={-Math.PI / 2} scale={[4, 3, 1]} color="#dfe7ff" />
      </Environment>

      <group position={[(-diseno.dimensiones.ancho / 2) * MM, 0, (-diseno.dimensiones.fondo / 2) * MM]}>
        {diseno.piezas.map((p) => (
          <Pieza
            key={`${p.id}-${revelado}`}
            pieza={p}
            caja={geo.cajas.get(p.id)!}
            tono={tipoDe(p.material)}
            desplazamiento={empujes.get(p.id)!}
            seleccionada={seleccion === p.id}
            atenuada={!!seleccion && seleccion !== p.id}
            fantasma={fantasmas.includes(p.id)}
            marcada={marcadas.includes(p.id)}
            resaltar={cambios.modificadas.includes(p.id) ? cambios.vez : 0}
            nueva={cambios.agregadas.includes(p.id)}
            retraso={cambios.agregadas.includes(p.id) ? 0 : orden.indexOf(p.id) * 70}
            onSeleccionar={seleccionar}
          />
        ))}
        {cambios.eliminadas.map(({ pieza, caja }) => (
          <Saliente key={`${pieza.id}-${cambios.vez}`} caja={caja} />
        ))}
        {cambios.agregadas
          .filter((id) => geo.cajas.has(id))
          .map((id) => {
            const c = geo.cajas.get(id)!
            const [dx, dy, dz] = empujes.get(id) ?? [0, 0, 0]
            return <Aserrin key={`${id}-${cambios.vez}`} en={[((c.x0 + c.x1) / 2) * MM + dx, c.y0 * MM + dy, ((c.z0 + c.z1) / 2) * MM + dz]} />
          })}
        {cotas && !explosion && <Cotas dimensiones={diseno.dimensiones} />}
      </group>

      <ContactShadows position={[0, 0.0005, 0]} opacity={oscuro ? 0.6 : 0.45} scale={6} blur={2.4} far={2.5} color="#3a2a1a" />
      <Grid
        position={[0, 0, 0]}
        args={[20, 20]}
        cellSize={0.1}
        cellThickness={0.6}
        cellColor={oscuro ? '#3a332c' : '#d9ccb8'}
        sectionSize={0.5}
        sectionThickness={1}
        sectionColor={oscuro ? '#4a4038' : '#c9b89e'}
        fadeDistance={9}
        fadeStrength={1.5}
        infiniteGrid
      />
      {calidad && (
        <EffectComposer multisampling={0}>
          <N8AO aoRadius={0.25} distanceFalloff={0.6} intensity={2.2} quality="medium" halfRes />
        </EffectComposer>
      )}
    </Canvas>
  )
}
