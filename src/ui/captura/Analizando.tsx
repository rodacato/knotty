import { Check } from '@phosphor-icons/react'
import type { Etapa } from '../../application/casosDeUso'
import { Boton } from '../sistema/componentes'
import { useTienda } from '../tienda'

const ETAPAS: { id: Etapa; texto: string }[] = [
  { id: 'mirando-fotos', texto: 'Mirando las fotos' },
  { id: 'revisando', texto: 'Revisando que todo cierre' },
  { id: 'estructura', texto: 'Revisando la estructura' },
]

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
      <Boton variante="fantasma" onClick={cancelar}>
        Cancelar
      </Boton>
    </main>
  )
}
