import { Check } from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'
import { ATTEMPTS, type Stage } from '../../application/useCases'
import { Button } from '../system/components'
import { useStore } from '../store'

const stages = (withPhotos: boolean, pieceByPiece: boolean): { id: Stage; text: string }[] => [
  ...(withPhotos ? [{ id: 'reading-photos' as const, text: 'Mirando las fotos' }] : []),
  pieceByPiece ? { id: 'designing-pieces', text: 'Diseñando pieza por pieza' } : { id: 'designing', text: 'Pensando el diseño' },
  { id: 'checking', text: 'Midiendo que todo cierre' },
  { id: 'structure', text: 'Revisando la estructura' },
]

/** From here on the wait explains itself; there is no retry while the expert is still answering: its own time limit ends a stuck call. */
const PATIENCE = 30

/** Seconds since the attempt started; `attempt` changes on every retry and restarts the count. */
function useSeconds(attempt: unknown) {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const start = Date.now()
    setSeconds(0)
    const clock = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(clock)
  }, [attempt])
  return seconds
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

/** The outline of a piece of furniture being drawn in pencil while the expert works. */
function Stroke() {
  const line = 'fill-none stroke-graphite [stroke-width:1.6] [stroke-linecap:round] [stroke-linejoin:round] animate-draw'
  return (
    <svg viewBox="0 0 160 200" className="h-48 w-40 text-graphite" aria-hidden>
      <path pathLength={1} strokeDasharray="1" className={line} d="M30 20 h100 v170 h-100 z" />
      <path pathLength={1} strokeDasharray="1" className={`${line} [animation-delay:.3s]`} d="M30 70 h100 M30 120 h100" />
      <path pathLength={1} strokeDasharray="1" className={`${line} [animation-delay:.6s]`} d="M30 170 h100 M40 190 v-20 M120 190 v-20" />
      <path pathLength={1} strokeDasharray="1" className={`${line} [animation-delay:.9s] stroke-amber`} d="M130 20 l18 -12 v170 l-18 12" />
    </svg>
  )
}

export function Analyzing() {
  const stage = useStore((s) => s.stage)
  const cancel = useStore((s) => s.cancel)
  const withPhotos = useStore((s) => (s.draft?.photos.length ?? 0) > 0)
  const controller = useStore((s) => s.controller)
  const seconds = useSeconds(controller)
  // Slowness is measured per attempt: a correction that makes progress is not a stuck expert.
  const attempt = useMemo(() => ({}), [controller, stage?.attempt])
  const attemptSeconds = useSeconds(attempt)
  // Once the expert writes piece by piece, the stage is named that way from then on.
  const [pieceByPiece, setPieceByPiece] = useState(false)
  useEffect(() => {
    if (stage?.name === 'designing-pieces') setPieceByPiece(true)
  }, [stage?.name])
  const STAGES = stages(withPhotos, pieceByPiece)
  const current = STAGES.findIndex((e) => e.id === stage?.name)
  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-8 px-6" aria-live="polite">
      <Stroke />
      <ol className="flex flex-col gap-3">
        {STAGES.map((e, i) => {
          const taken = current > i
          const inProgress = current === i || (stage?.name === 'correcting' && e.id === 'checking')
          return (
            <li key={e.id} className={`flex items-center gap-3 transition ${taken || inProgress ? 'text-graphite' : 'text-graphite-2/50'}`}>
              <span className={`grid size-6 place-items-center rounded-full border ${taken ? 'border-graphite bg-graphite text-bone' : inProgress ? 'border-amber' : 'border-line'}`}>
                {taken ? <Check size={12} weight="bold" /> : inProgress ? <span className="size-2 animate-pulse rounded-full bg-amber" /> : null}
              </span>
              <span className={inProgress ? 'font-medium' : ''}>
                {e.text}
                {e.id === 'reading-photos' && stage?.progress && inProgress && (
                  <span className="numerals text-graphite-2">
                    {' '}
                    ({Math.min(stage.progress.done + 1, stage.progress.total)} de {stage.progress.total})
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ol>
      {stage?.name === 'correcting' && (
        <p className="max-w-xs text-center text-sm text-graphite-2">
          Intento {stage.attempt + 1} de {ATTEMPTS}: el experto está corrigiendo piezas que no cerraban.
        </p>
      )}
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="numerals text-sm text-graphite-2">{clock(seconds)}</p>
        {attemptSeconds >= PATIENCE && (
          <p className="max-w-xs text-sm text-graphite-2">
            {pieceByPiece
              ? 'Este mueble no es un gabinete, así que el experto lo diseña pieza por pieza: puede tardar de 2 a 4 minutos. Sigue trabajando.'
              : stage?.name === 'correcting'
                ? 'Cada corrección vuelve a escribir el diseño completo; tarda lo mismo que el primer intento.'
                : 'Sigue trabajando; esto suele tomar menos de un minuto.'}
          </p>
        )}
        <div className="flex gap-2">
          <Button variant="ghost" onClick={cancel}>
            Cancelar
          </Button>
        </div>
      </div>
    </main>
  )
}
