import { Line } from '@react-three/drei'
import { useEffect, useMemo, useState } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'
import type { Dimensiones } from '../../domain/diseno/esquema'

const MM = 0.001
const SEPARACION = 70 * MM
const MARCA = 18 * MM
const COLOR = '#8a7a66'
const ALTO_ETIQUETA = 0.021

type Punto = [number, number, number]

/** Etiqueta dibujada en un lienzo: siempre del mismo tamaño en pantalla y sin montar DOM dentro de la escena. */
function Etiqueta({ texto, posicion, oscuro }: { texto: string; posicion: Punto; oscuro: boolean }) {
  const [fuentesListas, setFuentesListas] = useState(false)
  useEffect(() => void document.fonts.ready.then(() => setFuentesListas(true)), [])
  const { mapa, proporcion } = useMemo(() => {
    const escala = 3
    const lienzo = document.createElement('canvas')
    const ctx = lienzo.getContext('2d')!
    const fuente = `500 ${13 * escala}px "JetBrains Mono Variable", ui-monospace, monospace`
    ctx.font = fuente
    const ancho = ctx.measureText(texto).width + 22 * escala
    const alto = 24 * escala
    lienzo.width = ancho
    lienzo.height = alto
    ctx.font = fuente
    ctx.fillStyle = oscuro ? 'rgba(39, 35, 31, 0.94)' : 'rgba(245, 240, 232, 0.94)'
    ctx.strokeStyle = oscuro ? 'rgba(239, 231, 218, 0.18)' : 'rgba(43, 40, 37, 0.14)'
    ctx.lineWidth = escala
    ctx.beginPath()
    ctx.roundRect(escala, escala, ancho - 2 * escala, alto - 2 * escala, alto / 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = oscuro ? '#d8cdbd' : '#5e574f'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(texto, ancho / 2, alto / 2 + escala)
    const mapa = new CanvasTexture(lienzo)
    mapa.colorSpace = SRGBColorSpace
    return { mapa, proporcion: ancho / alto, fuentesListas }
  }, [texto, fuentesListas, oscuro])
  useEffect(() => () => mapa.dispose(), [mapa])
  return (
    <sprite position={posicion} scale={[ALTO_ETIQUETA * proporcion, ALTO_ETIQUETA, 1]} renderOrder={10}>
      <spriteMaterial map={mapa} sizeAttenuation={false} depthTest={false} transparent />
    </sprite>
  )
}

function Cota({ desde, hasta, marca, valor, oscuro }: { desde: Punto; hasta: Punto; marca: Punto; valor: number; oscuro: boolean }) {
  const medio: Punto = [(desde[0] + hasta[0]) / 2, (desde[1] + hasta[1]) / 2, (desde[2] + hasta[2]) / 2]
  const tic = (p: Punto): Punto[] => [
    [p[0] - marca[0], p[1] - marca[1], p[2] - marca[2]],
    [p[0] + marca[0], p[1] + marca[1], p[2] + marca[2]],
  ]
  const texto = `${Math.round(valor)} mm · ${(valor / 10).toLocaleString('es-MX', { maximumFractionDigits: 1 })} cm`
  return (
    <group>
      <Line points={[desde, hasta]} color={COLOR} lineWidth={1} />
      <Line points={tic(desde)} color={COLOR} lineWidth={1.5} />
      <Line points={tic(hasta)} color={COLOR} lineWidth={1.5} />
      <Etiqueta texto={texto} posicion={medio} oscuro={oscuro} />
    </group>
  )
}

/** Cotas generales como en un plano: ancho al frente, alto a la izquierda, fondo a la derecha. */
export function Cotas({ dimensiones, oscuro }: { dimensiones: Dimensiones; oscuro: boolean }) {
  const a = dimensiones.ancho * MM
  const h = dimensiones.alto * MM
  const f = dimensiones.fondo * MM
  const y = 2 * MM
  return (
    <group>
      <Cota desde={[0, y, f + SEPARACION]} hasta={[a, y, f + SEPARACION]} marca={[0, 0, MARCA]} valor={dimensiones.ancho} oscuro={oscuro} />
      <Cota desde={[-SEPARACION, 0, f]} hasta={[-SEPARACION, h, f]} marca={[MARCA, 0, 0]} valor={dimensiones.alto} oscuro={oscuro} />
      <Cota desde={[a + SEPARACION, y, 0]} hasta={[a + SEPARACION, y, f]} marca={[MARCA, 0, 0]} valor={dimensiones.fondo} oscuro={oscuro} />
    </group>
  )
}
