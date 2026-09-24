import { Html, Line } from '@react-three/drei'
import type { Dimensiones } from '../../domain/diseno/esquema'

const MM = 0.001
const SEPARACION = 70 * MM
const MARCA = 18 * MM
const COLOR = '#8a7a66'

type Punto = [number, number, number]

function Cota({ desde, hasta, marca, valor }: { desde: Punto; hasta: Punto; marca: Punto; valor: number }) {
  const medio: Punto = [(desde[0] + hasta[0]) / 2, (desde[1] + hasta[1]) / 2, (desde[2] + hasta[2]) / 2]
  const tic = (p: Punto): Punto[] => [
    [p[0] - marca[0], p[1] - marca[1], p[2] - marca[2]],
    [p[0] + marca[0], p[1] + marca[1], p[2] + marca[2]],
  ]
  return (
    <group>
      <Line points={[desde, hasta]} color={COLOR} lineWidth={1} />
      <Line points={tic(desde)} color={COLOR} lineWidth={1.5} />
      <Line points={tic(hasta)} color={COLOR} lineWidth={1.5} />
      <Html position={medio} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
        <span className="cifras whitespace-nowrap rounded-full border border-linea bg-hueso/90 px-2 py-0.5 text-[11px] text-grafito-2 shadow-sm backdrop-blur">
          {Math.round(valor)} mm · {(valor / 10).toLocaleString('es-MX', { maximumFractionDigits: 1 })} cm
        </span>
      </Html>
    </group>
  )
}

/** Cotas generales como en un plano: ancho al frente, alto a la izquierda, fondo a la derecha. */
export function Cotas({ dimensiones }: { dimensiones: Dimensiones }) {
  const a = dimensiones.ancho * MM
  const h = dimensiones.alto * MM
  const f = dimensiones.fondo * MM
  const y = 2 * MM
  return (
    <group>
      <Cota desde={[0, y, f + SEPARACION]} hasta={[a, y, f + SEPARACION]} marca={[0, 0, MARCA]} valor={dimensiones.ancho} />
      <Cota desde={[-SEPARACION, 0, f]} hasta={[-SEPARACION, h, f]} marca={[MARCA, 0, 0]} valor={dimensiones.alto} />
      <Cota desde={[a + SEPARACION, y, 0]} hasta={[a + SEPARACION, y, f]} marca={[MARCA, 0, 0]} valor={dimensiones.fondo} />
    </group>
  )
}
