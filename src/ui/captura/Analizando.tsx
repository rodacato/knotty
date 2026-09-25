import { ArrowClockwise, Check } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import type { Etapa } from '../../application/casosDeUso'
import { Boton } from '../sistema/componentes'
import { useTienda } from '../tienda'

const etapas = (conFotos: boolean): { id: Etapa; texto: string }[] => [
  { id: 'mirando-fotos', texto: conFotos ? 'Mirando las fotos' : 'Pensando el diseño' },
  { id: 'revisando', texto: 'Midiendo que todo cierre' },
  { id: 'estructura', texto: 'Revisando la estructura' },
]

/** A partir de aquí se avisa que tarda; a partir de LENTO se ofrece reintentar. */
const PACIENCIA = 45
const LENTO = 120

/** Segundos desde que empezó el intento; `intento` cambia en cada reintento y reinicia la cuenta. */
function useSegundos(intento: unknown) {
  const [segundos, setSegundos] = useState(0)
  useEffect(() => {
    const inicio = Date.now()
    setSegundos(0)
    const reloj = setInterval(() => setSegundos(Math.floor((Date.now() - inicio) / 1000)), 1000)
    return () => clearInterval(reloj)
  }, [intento])
  return segundos
}

const reloj = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

/** El contorno de un mueble dibujándose a lápiz mientras el experto trabaja. */
function Trazo() {
  const linea = 'fill-none stroke-grafito [stroke-width:1.6] [stroke-linecap:round] [stroke-linejoin:round] animate-trazo'
  return (
    <svg viewBox="0 0 160 200" className="h-48 w-40 text-grafito" aria-hidden>
      <path pathLength={1} strokeDasharray="1" className={linea} d="M30 20 h100 v170 h-100 z" />
      <path pathLength={1} strokeDasharray="1" className={`${linea} [animation-delay:.3s]`} d="M30 70 h100 M30 120 h100" />
      <path pathLength={1} strokeDasharray="1" className={`${linea} [animation-delay:.6s]`} d="M30 170 h100 M40 190 v-20 M120 190 v-20" />
      <path pathLength={1} strokeDasharray="1" className={`${linea} [animation-delay:.9s] stroke-ambar`} d="M130 20 l18 -12 v170 l-18 12" />
    </svg>
  )
}

export function Analizando() {
  const etapa = useTienda((s) => s.etapa)
  const cancelar = useTienda((s) => s.cancelar)
  const reintentar = useTienda((s) => s.reintentarReconstruccion)
  const conFotos = useTienda((s) => (s.borrador?.fotos.length ?? 0) > 0)
  const controlador = useTienda((s) => s.controlador)
  const segundos = useSegundos(controlador)
  const ETAPAS = etapas(conFotos)
  const actual = ETAPAS.findIndex((e) => e.id === etapa?.nombre)
  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-8 px-6" aria-live="polite">
      <Trazo />
      <ol className="flex flex-col gap-3">
        {ETAPAS.map((e, i) => {
          const hecha = actual > i
          const enCurso = actual === i || (etapa?.nombre === 'corrigiendo' && i === 1)
          return (
            <li key={e.id} className={`flex items-center gap-3 transition ${hecha || enCurso ? 'text-grafito' : 'text-grafito-2/50'}`}>
              <span className={`grid size-6 place-items-center rounded-full border ${hecha ? 'border-grafito bg-grafito text-hueso' : enCurso ? 'border-ambar' : 'border-linea'}`}>
                {hecha ? <Check size={12} weight="bold" /> : enCurso ? <span className="size-2 animate-pulse rounded-full bg-ambar" /> : null}
              </span>
              <span className={enCurso ? 'font-medium' : ''}>{e.texto}</span>
            </li>
          )
        })}
      </ol>
      {etapa?.nombre === 'corrigiendo' && <p className="text-sm text-grafito-2">Ajustando algunas piezas que no cerraban (intento {etapa.intento + 1})…</p>}
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="cifras text-sm text-grafito-2">{reloj(segundos)}</p>
        {segundos >= LENTO ? (
          <p className="max-w-xs text-sm text-grafito-2">Está tardando más de lo normal. Puede que el experto se haya atorado: vuelve a pedirlo con lo mismo.</p>
        ) : (
          segundos >= PACIENCIA && <p className="max-w-xs text-sm text-grafito-2">Armar el modelo completo toma a veces uno o dos minutos.</p>
        )}
        <div className="flex gap-2">
          {segundos >= LENTO && (
            <Boton variante="primario" onClick={reintentar}>
              <ArrowClockwise weight="bold" /> Reintentar
            </Boton>
          )}
          <Boton variante="fantasma" onClick={cancelar}>
            Cancelar
          </Boton>
        </div>
      </div>
    </main>
  )
}
